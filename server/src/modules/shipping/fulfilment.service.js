import { prisma } from "../../lib/prisma.js";
import { getShippingProvider } from "./provider.service.js";
import { sendShippingStatusEmail } from "../email/email.service.js";

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
    const result = await getShippingProvider(settings.provider || "MANUAL").createShipment({ order, input: buildShipmentPayload(order, settings), settings });
    return await prisma.shipment.update({ where: { orderId }, data: { ...result, status: result.status || "CREATED", lastError: null } });
  } catch (error) { return prisma.shipment.update({ where: { orderId }, data: { status: "CREATION_FAILED", lastError: "Shipment creation failed" } }); }
}
export async function applyTrackingUpdate({ provider, providerShipmentId, rawStatus, trackingNumber, trackingUrl, estimatedDelivery }) {
  const shipment = await prisma.shipment.findFirst({ where: { provider, OR: [{ providerShipmentId }, { trackingNumber }] }, include: { order: { include: { items: true } } } });
  if (!shipment || terminal.has(shipment.status)) return shipment;
  const status = normalizeShippingStatus(rawStatus);
  const updated = await prisma.shipment.update({ where: { id: shipment.id }, data: { status, trackingNumber: trackingNumber || shipment.trackingNumber, trackingUrl: trackingUrl || shipment.trackingUrl, estimatedDelivery: estimatedDelivery || shipment.estimatedDelivery, deliveredDate: status === "DELIVERED" ? new Date() : undefined } });
  const orderStatus = status === "DELIVERED" ? "DELIVERED" : ["IN_TRANSIT", "OUT_FOR_DELIVERY", "PICKED_UP"].includes(status) ? "SHIPPED" : null;
  if (orderStatus && shipment.order.status !== "DELIVERED") await prisma.order.update({ where: { id: shipment.orderId }, data: { status: orderStatus } });
  if (["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"].includes(status)) await sendShippingStatusEmail(shipment.orderId, status);
  return updated;
}
