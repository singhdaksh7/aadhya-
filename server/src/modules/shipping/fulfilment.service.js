import { prisma } from "../../lib/prisma.js";
import { getShippingProvider } from "./provider.service.js";
import { sendShippingStatusEmail } from "../email/email.service.js";
import { ApiError } from "../../utils/ApiError.js";

// Required before any provider (non-MANUAL) shipment-create call is allowed
// to proceed — an incomplete pickup profile at Shiprocket's end fails the
// order create with an opaque provider error, so we catch it early with a
// clear 400 instead.
const REQUIRED_PICKUP_FIELDS = ["name", "phone", "address", "city", "state", "postalCode"];
// Only Shiprocket (the one live external provider) needs a registered
// pickup location; MANUAL and any test-double provider name are exempt.
export function assertPickupConfigured(settings) {
  if ((settings.provider || "MANUAL") !== "SHIPROCKET") return;
  const pickup = settings.pickup || {};
  const missing = REQUIRED_PICKUP_FIELDS.filter((f) => !String(pickup[f] || "").trim());
  if (missing.length) {
    throw ApiError.badRequest(`Pickup location is incomplete. Missing: ${missing.join(", ")}. Configure it under Shipping Settings before creating a shipment.`);
  }
}

// RTO is an in-flight return state (the package is on its way back), not a
// dead end — it must still be able to advance to RTO_DELIVERED. Only these
// three are genuinely final.
const terminal = new Set(["DELIVERED", "CANCELLED", "RTO_DELIVERED"]);
export const normalizeShippingStatus = (raw) => ({ shipped: "IN_TRANSIT", in_transit: "IN_TRANSIT", out_for_delivery: "OUT_FOR_DELIVERY", delivered: "DELIVERED", failed_attempt: "FAILED_ATTEMPT", rto: "RTO", rto_delivered: "RTO_DELIVERED", cancelled: "CANCELLED", picked_up: "PICKED_UP", pickup_scheduled: "PICKUP_SCHEDULED" }[String(raw || "").toLowerCase()] || "PENDING");
export function buildShipmentPayload(order, settings = {}) {
  const physicalItems = order.items.filter((item) => item.bookFormatSnapshot !== "PDF").map((item) => ({ name: item.productNameSnapshot, sku: item.variantSkuSnapshot || item.bookFormatSkuSnapshot || item.skuSnapshot || null, quantity: item.quantity, sellingPrice: Number(item.unitPrice), discount: 0, tax: 0 }));
  return { idempotencyKey: `${order.id}:standard`, order: { id: order.id, number: order.orderNumber, date: order.createdAt, paymentMethod: order.paymentMethod, codAmount: order.paymentMethod === "cod" ? Number(order.totalAmount) : 0 }, customer: { name: order.customerName, email: order.customerEmail, phone: order.customerPhone, alternatePhone: order.customerAlternatePhone || null }, shippingAddress: order.address, billingAddress: order.billingAddress || order.address, items: physicalItems, package: settings.packageDefaults || { weight: 0.5, length: 20, width: 15, height: 10 }, pickup: settings.pickup || null };
}
export async function attemptAutomaticShipment(orderId) {
  const settingsRow = await prisma.siteSetting.findUnique({ where: { key: "shippingBusiness" } }); const settings = settingsRow?.value || {};
  if (!settings.autoCreateShipment) return null;
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, address: true, billingAddress: true, shipment: true } });
  if (!order || !order.address || !order.items.some((i) => i.bookFormatSnapshot !== "PDF")) return null;
  if (order.shipment && (terminal.has(order.shipment.status) || ["CREATED", "PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(order.shipment.status))) return order.shipment;
  // Unique orderId is the durable idempotency key; a concurrent webhook is
  // reduced to the already-created row instead of sending a second order.
  try { await prisma.shipment.create({ data: { orderId, provider: settings.provider || "MANUAL", status: "CREATING" } }); } catch { return prisma.shipment.findUnique({ where: { orderId } }); }
  try {
    assertPickupConfigured(settings);
    const result = await getShippingProvider(settings.provider || "MANUAL").createShipment({ order, input: buildShipmentPayload(order, settings), settings });
    let shipment = await prisma.shipment.update({ where: { orderId }, data: { ...result, status: result.status || "CREATED", lastError: null } });
    // Chain AWB generation / pickup scheduling only when explicitly enabled
    // and fully awaited — no detached promises past the end of this call.
    if (settings.autoGenerateAwb && shipment.providerShipmentId && !shipment.awb) {
      shipment = await generateAwbForShipment(shipment.id, settings).catch(() => shipment);
    }
    if (settings.autoSchedulePickup && shipment.awb) {
      shipment = await schedulePickupForShipment(shipment.id, settings).catch(() => shipment);
    }
    return shipment;
  } catch (error) { return prisma.shipment.update({ where: { orderId }, data: { status: "CREATION_FAILED", lastError: sanitizeProviderError(error) } }); }
}

// Never leaks raw provider stack traces, request bodies, or credentials into
// a field that admins/customers can see — only a short, safe message.
export function sanitizeProviderError(error) {
  const message = error?.message || "";
  if (/password|token|secret|authorization|bearer/i.test(message)) return "Shipment operation failed (provider request rejected).";
  return message.slice(0, 300) || "Shipment operation failed.";
}

async function loadShipmentAndSettings(shipmentId) {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) throw ApiError.notFound("Shipment not found");
  const settingsRow = await prisma.siteSetting.findUnique({ where: { key: "shippingBusiness" } });
  const settings = settingsRow?.value || {};
  return { shipment, settings };
}

// Idempotent: re-clicking "Generate AWB" on an already-AWB'd shipment does
// not call the provider again.
export async function generateAwbForShipment(shipmentId, settingsOverride = null) {
  const { shipment, settings } = await loadShipmentAndSettings(shipmentId);
  const effectiveSettings = settingsOverride || settings;
  if (shipment.awb) return shipment;
  if (!shipment.providerShipmentId) throw ApiError.badRequest("Create the shipment before generating an AWB.");
  try {
    const provider = getShippingProvider(shipment.provider || "MANUAL");
    const result = await provider.generateAwb(shipment, effectiveSettings);
    return await prisma.shipment.update({ where: { id: shipmentId }, data: { awb: result.awb, carrier: result.carrier || shipment.carrier, trackingNumber: result.awb || shipment.trackingNumber, status: "PICKUP_SCHEDULED" === shipment.status ? shipment.status : shipment.status, lastError: null } });
  } catch (error) {
    await prisma.shipment.update({ where: { id: shipmentId }, data: { lastError: sanitizeProviderError(error) } });
    throw error;
  }
}

// Idempotent: a shipment that already has a pickup scheduled (status
// PICKUP_SCHEDULED or further along) is not re-submitted to the provider.
const PICKUP_DONE_STATUSES = new Set(["PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"]);
export async function schedulePickupForShipment(shipmentId, settingsOverride = null) {
  const { shipment, settings } = await loadShipmentAndSettings(shipmentId);
  const effectiveSettings = settingsOverride || settings;
  if (PICKUP_DONE_STATUSES.has(shipment.status)) return shipment;
  if (!shipment.awb) throw ApiError.badRequest("Generate an AWB before scheduling pickup.");
  try {
    const provider = getShippingProvider(shipment.provider || "MANUAL");
    await provider.schedulePickup(shipment, effectiveSettings);
    return await prisma.shipment.update({ where: { id: shipmentId }, data: { status: "PICKUP_SCHEDULED", lastError: null } });
  } catch (error) {
    await prisma.shipment.update({ where: { id: shipmentId }, data: { lastError: sanitizeProviderError(error) } });
    throw error;
  }
}

// Streams/returns label data without ever exposing provider credentials to
// the caller — only the label payload the provider already returned.
export async function getLabelForShipment(shipmentId) {
  const { shipment, settings } = await loadShipmentAndSettings(shipmentId);
  if (!shipment.providerShipmentId) throw ApiError.badRequest("Create the shipment before requesting a label.");
  const provider = getShippingProvider(shipment.provider || "MANUAL");
  try {
    return await provider.getLabel(shipment, settings);
  } catch (error) {
    throw ApiError.badRequest(sanitizeProviderError(error));
  }
}

export async function refreshTrackingForShipment(shipmentId) {
  const { shipment, settings } = await loadShipmentAndSettings(shipmentId);
  if (!shipment.providerShipmentId) return shipment;
  const provider = getShippingProvider(shipment.provider || "MANUAL");
  try {
    const tracking = await provider.getTracking(shipment, settings);
    return await applyTrackingUpdate({
      provider: shipment.provider,
      providerShipmentId: shipment.providerShipmentId,
      rawStatus: tracking.rawStatus,
      trackingNumber: tracking.trackingNumber,
      trackingUrl: tracking.trackingUrl,
    });
  } catch (error) {
    await prisma.shipment.update({ where: { id: shipmentId }, data: { lastError: sanitizeProviderError(error) } });
    throw error;
  }
}
export async function applyTrackingUpdate({ provider, providerShipmentId, rawStatus, trackingNumber, trackingUrl, estimatedDelivery }) {
  const shipment = await prisma.shipment.findFirst({ where: { provider, OR: [{ providerShipmentId }, { trackingNumber }] }, include: { order: { include: { items: true } } } });
  if (!shipment || terminal.has(shipment.status)) return shipment;
  const status = normalizeShippingStatus(rawStatus);
  const updated = await prisma.shipment.update({ where: { id: shipment.id }, data: { status, rawProviderStatus: rawStatus != null ? String(rawStatus) : shipment.rawProviderStatus, trackingNumber: trackingNumber || shipment.trackingNumber, trackingUrl: trackingUrl || shipment.trackingUrl, estimatedDelivery: estimatedDelivery || shipment.estimatedDelivery, deliveredDate: status === "DELIVERED" ? new Date() : undefined } });
  const orderStatus = status === "DELIVERED" ? "DELIVERED" : ["IN_TRANSIT", "OUT_FOR_DELIVERY", "PICKED_UP"].includes(status) ? "SHIPPED" : null;
  if (orderStatus && shipment.order.status !== "DELIVERED") await prisma.order.update({ where: { id: shipment.orderId }, data: { status: orderStatus } });
  if (["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"].includes(status)) await sendShippingStatusEmail(shipment.orderId, status);
  if (status === "RTO_DELIVERED") {
    // Restocks the order's items and opens a refund-eligible return for
    // prepaid orders. Awaited (rather than fire-and-forget) so this
    // completes before the webhook handler returns — a fire-and-forget
    // version here left the promise running past the end of the request,
    // racing subsequent DB writes (visible as cross-test pollution when
    // this fires directly before another test's setup). Still never
    // allowed to fail the webhook response.
    const { handleRtoDelivered } = await import("../returns/returns.service.js");
    await handleRtoDelivered(shipment.orderId).catch((err) => console.error("RTO restock failed:", err.message));
  }
  return updated;
}
