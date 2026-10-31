import { prisma } from "../../lib/prisma.js";
import { getShippingProvider } from "./provider.service.js";
import { notifyOrderEvent } from "../mailer/mailer.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { recordMilestone, milestoneForStatus, raiseShipmentAlert } from "./shipment-milestones.js";
import { requireConfirmedPackage, lockOrderPackage, unlockOrderPackage, toShiprocketPackage } from "./package.service.js";

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

const orderNumberOf = (orderId) => prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } }).then((o) => o?.orderNumber || null).catch(() => null);

// RTO is an in-flight return state (the package is on its way back), not a
// dead end — it must still be able to advance to RTO_DELIVERED. Only these
// three are genuinely final.
const terminal = new Set(["DELIVERED", "CANCELLED", "RTO_DELIVERED"]);
export const normalizeShippingStatus = (raw) => ({ shipped: "IN_TRANSIT", in_transit: "IN_TRANSIT", out_for_delivery: "OUT_FOR_DELIVERY", delivered: "DELIVERED", failed_attempt: "FAILED_ATTEMPT", rto: "RTO", rto_delivered: "RTO_DELIVERED", cancelled: "CANCELLED", picked_up: "PICKED_UP", pickup_scheduled: "PICKUP_SCHEDULED" }[String(raw || "").toLowerCase()] || "PENDING");
export function buildShipmentPayload(order, settings = {}, confirmedPackage = null, extra = {}) {
  const physicalItems = order.items.filter((item) => item.bookFormatSnapshot !== "PDF").map((item) => ({ name: item.productNameSnapshot, sku: item.variantSkuSnapshot || item.bookFormatSkuSnapshot || item.skuSnapshot || null, quantity: item.quantity, sellingPrice: Number(item.unitPrice), discount: 0, tax: 0 }));
  return { idempotencyKey: `${order.id}:standard`, order: { id: order.id, number: order.orderNumber, date: order.createdAt, paymentMethod: order.paymentMethod, codAmount: order.paymentMethod === "cod" ? Number(order.totalAmount) : 0 }, customer: { name: order.customerName, email: order.customerEmail, phone: order.customerPhone, alternatePhone: order.customerAlternatePhone || null }, shippingAddress: order.address, billingAddress: order.billingAddress || order.address, items: physicalItems, package: confirmedPackage ? toShiprocketPackage(confirmedPackage) : (settings.packageDefaults || { weight: 0.5, length: 20, width: 15, height: 10 }), pickup: settings.pickup || null, courierCompanyId: extra.courierCompanyId || null };
}
export async function attemptAutomaticShipment(orderId) {
  const settingsRow = await prisma.siteSetting.findUnique({ where: { key: "shippingBusiness" } }); const settings = settingsRow?.value || {};
  if (!settings.autoCreateShipment) return null;
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, address: true, billingAddress: true, shipment: true } });
  if (!order || !order.address || !order.items.some((i) => i.bookFormatSnapshot !== "PDF")) return null;
  if (order.shipment && (terminal.has(order.shipment.status) || ["CREATED", "PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(order.shipment.status))) return order.shipment;
  // Unique orderId is the durable idempotency key; a concurrent webhook is
  // reduced to the already-created row instead of sending a second order.
  // Shiprocket never ships on guessed package data: wait for the Admin-confirmed package snapshot.
  let confirmedPackage = null;
  if ((settings.provider || "MANUAL") === "SHIPROCKET") {
    confirmedPackage = await prisma.orderShipmentPackage.findUnique({ where: { orderId } });
    if (!confirmedPackage) return null;
  }
  try { await prisma.shipment.create({ data: { orderId, provider: settings.provider || "MANUAL", status: "CREATING" } }); } catch { return prisma.shipment.findUnique({ where: { orderId } }); }
  try {
    assertPickupConfigured(settings);
    const result = await getShippingProvider(settings.provider || "MANUAL").createShipment({ order, input: buildShipmentPayload(order, settings, confirmedPackage), settings });
    if (confirmedPackage) await lockOrderPackage(orderId);
    let shipment = await prisma.shipment.update({ where: { orderId }, data: { ...result, status: result.status || "CREATED", lastError: null } });
    await recordMilestone(shipment, "CREATED");
    if (shipment.awb) await recordMilestone(shipment, "AWB_ASSIGNED");
    // Chain AWB generation / pickup scheduling only when explicitly enabled
    // and fully awaited — no detached promises past the end of this call.
    if (settings.autoGenerateAwb && shipment.providerShipmentId && !shipment.awb) {
      shipment = await generateAwbForShipment(shipment.id, settings).catch(() => shipment);
    }
    if (settings.autoSchedulePickup && shipment.awb) {
      shipment = await schedulePickupForShipment(shipment.id, settings).catch(() => shipment);
    }
    return shipment;
  } catch (error) {
    const failed = await prisma.shipment.update({ where: { orderId }, data: { status: "CREATION_FAILED", lastError: sanitizeProviderError(error) } });
    await raiseShipmentAlert("SHIPMENT_CREATION_FAILED", { orderId, orderNumber: order.orderNumber, detail: failed.lastError });
    return failed;
  }
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
export async function generateAwbForShipment(shipmentId, settingsOverride = null, { courierCompanyId = null } = {}) {
  const { shipment, settings } = await loadShipmentAndSettings(shipmentId);
  const effectiveSettings = { ...(settingsOverride || settings), ...(courierCompanyId ? { courierCompanyId } : {}) };
  if (shipment.awb) return shipment;
  if (!shipment.providerShipmentId) throw ApiError.badRequest("Create the shipment before generating an AWB.");
  try {
    const provider = getShippingProvider(shipment.provider || "MANUAL");
    const result = await provider.generateAwb(shipment, effectiveSettings);
    if (!result.awb) throw new Error("Shiprocket did not return an AWB. Check the courier selection and wallet balance, then retry.");
    const updated = await prisma.shipment.update({ where: { id: shipmentId }, data: { awb: result.awb, carrier: result.carrier || shipment.carrier, trackingNumber: result.awb || shipment.trackingNumber, lastError: null } });
    await recordMilestone(updated, "AWB_ASSIGNED");
    return updated;
  } catch (error) {
    const lastError = sanitizeProviderError(error);
    await prisma.shipment.update({ where: { id: shipmentId }, data: { lastError } });
    await raiseShipmentAlert("AWB_FAILED", { orderId: shipment.orderId, orderNumber: await orderNumberOf(shipment.orderId), detail: lastError });
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
    const pickup = await provider.schedulePickup(shipment, effectiveSettings);
    const updated = await prisma.shipment.update({ where: { id: shipmentId }, data: { status: "PICKUP_SCHEDULED", pickupStatus: pickup?.pickupStatus || "PICKUP_SCHEDULED", lastError: null } });
    await recordMilestone(updated, "PICKUP_SCHEDULED");
    return updated;
  } catch (error) {
    const lastError = sanitizeProviderError(error);
    await prisma.shipment.update({ where: { id: shipmentId }, data: { lastError, pickupStatus: "FAILED" } });
    await raiseShipmentAlert("PICKUP_FAILED", { orderId: shipment.orderId, orderNumber: await orderNumberOf(shipment.orderId), detail: lastError });
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
// Legacy/generic provider path (manual "refresh tracking", generic webhook): free-text status in, same
// shared pipeline out.
export async function applyTrackingUpdate({ provider, providerShipmentId, rawStatus, trackingNumber, trackingUrl, estimatedDelivery, source = "SYSTEM", providerEventId = null }) {
  const shipment = await prisma.shipment.findFirst({ where: { provider, OR: [{ providerShipmentId }, { trackingNumber }] } });
  if (!shipment) return shipment;
  const status = normalizeShippingStatus(rawStatus);
  const orderStatus = status === "DELIVERED" ? "DELIVERED" : status === "OUT_FOR_DELIVERY" ? "OUT_FOR_DELIVERY" : ["IN_TRANSIT", "PICKED_UP"].includes(status) ? "SHIPPED" : null;
  return applyResolvedShipmentUpdate(shipment, {
    shipmentStatus: status,
    orderStatus,
    event: status === "IN_TRANSIT" ? "ORDER_IN_TRANSIT" : null,
    rawStatus,
    trackingNumber,
    trackingUrl,
    estimatedDelivery,
    source,
    providerEventId,
  });
}

// The shared pipeline every tracking update goes through (courier webhook, manual refresh, generic webhook):
//   1. persist the shipment facts   2. move the ORDER status forward through the one status function
//   3. let that function send the (deduplicated) customer email   4. handle return-to-origin restocking.
// Terminal shipments are left alone, and the order status is forward-only, so out-of-order or repeated
// courier events can never move an order backwards or email twice.
export async function applyResolvedShipmentUpdate(shipment, { shipmentStatus, orderStatus, event, milestone: milestoneOverride = null, alert = null, rawStatus, trackingNumber, trackingUrl, estimatedDelivery, source = "SYSTEM", providerEventId = null }) {
  if (!shipment || terminal.has(shipment.status)) return shipment;
  const data = { rawProviderStatus: rawStatus != null ? String(rawStatus).slice(0, 120) : shipment.rawProviderStatus, lastSyncedAt: new Date() };
  if (shipmentStatus) data.status = shipmentStatus;
  if (trackingNumber) {
    data.trackingNumber = trackingNumber;
    if (!shipment.awb) data.awb = trackingNumber;
  }
  if (trackingUrl) data.trackingUrl = trackingUrl;
  if (estimatedDelivery) data.estimatedDelivery = estimatedDelivery;
  if (shipmentStatus === "DELIVERED") data.deliveredDate = new Date();
  if (["PICKED_UP", "IN_TRANSIT"].includes(shipmentStatus) && !shipment.shippedDate) data.shippedDate = new Date();
  const updated = await prisma.shipment.update({ where: { id: shipment.id }, data });

  // Customer timeline + Admin exceptions. A milestone is recorded once, so replays cannot re-alert.
  const milestone = milestoneOverride || milestoneForStatus(shipmentStatus);
  if (alert) await raiseShipmentAlert(alert, { orderId: shipment.orderId, orderNumber: await orderNumberOf(shipment.orderId), detail: String(rawStatus || "Courier reported a problem") });
  if (milestone) {
    const recorded = await recordMilestone(updated, milestone);
    if (recorded && (milestone === "DELIVERY_FAILED" || milestone === "RTO_INITIATED")) {
      await raiseShipmentAlert(milestone, { orderId: shipment.orderId, orderNumber: await orderNumberOf(shipment.orderId), detail: milestone === "RTO_INITIATED" ? "The courier is returning the package to the pickup address." : "The courier could not deliver the package." });
    }
  }

  const { changeOrderStatus } = await import("../orders/order.service.js");
  if (orderStatus) {
    await changeOrderStatus(shipment.orderId, orderStatus, { source, force: true, shipmentId: shipment.id, providerEventId }).catch((err) => console.error("Order status update from tracking failed:", err.message));
  }
  // Optional milestone emails that are not an order-status change (in transit, delivery attempt failed).
  if (event) await notifyOrderEvent(shipment.orderId, event, { source, providerEventId });

  if (shipmentStatus === "RTO_DELIVERED") {
    // Restocks the order's items and opens a refund-eligible return for prepaid orders. Awaited so it
    // finishes before the webhook handler returns; never allowed to fail the webhook response.
    const { handleRtoDelivered } = await import("../returns/returns.service.js");
    await handleRtoDelivered(shipment.orderId).catch((err) => console.error("RTO restock failed:", err.message));
  }
  return updated;
}

// Cancels the provider shipment. Internal state changes ONLY after the provider confirms; a failure is stored,
// alerted and leaves the shipment exactly as it was so the Admin can retry.
export async function cancelShipmentForOrder(orderId) {
  const shipment = await prisma.shipment.findUnique({ where: { orderId } });
  if (!shipment?.providerShipmentId) throw ApiError.badRequest("There is no provider shipment to cancel for this order.");
  if (shipment.status === "CANCELLED") return shipment;
  if (!["CREATED", "PICKUP_SCHEDULED"].includes(shipment.status)) throw ApiError.badRequest("This shipment can no longer be cancelled here because the courier has already collected it or it is closed. Contact Shiprocket support.");
  const settingsRow = await prisma.siteSetting.findUnique({ where: { key: "shippingBusiness" } });
  const settings = settingsRow?.value || {};
  try {
    await getShippingProvider(shipment.provider || "MANUAL").cancelShipment(shipment, settings);
  } catch (error) {
    const lastError = sanitizeProviderError(error);
    await prisma.shipment.update({ where: { id: shipment.id }, data: { lastError } });
    await raiseShipmentAlert("CANCELLATION_FAILED", { orderId, orderNumber: await orderNumberOf(orderId), detail: lastError });
    throw error;
  }
  const updated = await prisma.shipment.update({ where: { id: shipment.id }, data: { status: "CANCELLED", cancelledAt: new Date(), lastError: null } });
  await recordMilestone(updated, "CANCELLED");
  await unlockOrderPackage(orderId);
  return updated;
}
