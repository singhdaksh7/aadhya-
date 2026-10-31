import { prisma } from "../../lib/prisma.js";
import { createAdminNotification } from "../admin-notifications/admin-notification.service.js";

// Canonical shipment milestone layer.
//
//   Shiprocket status (shiprocketStatus.js)  ->  Shipment.status (stored vocabulary)  ->  milestone key (here)
//
// A milestone is what customers see on the tracking timeline and what Admin alerts key off. Provider
// payloads, actors and webhook ids never enter this table.

export const MILESTONES = {
  CREATED: { label: "Shipment created", order: 1 },
  AWB_ASSIGNED: { label: "Courier assigned", order: 2 },
  PICKUP_SCHEDULED: { label: "Pickup scheduled", order: 3 },
  PICKED_UP: { label: "Picked up by the courier", order: 4 },
  IN_TRANSIT: { label: "In transit", order: 5 },
  OUT_FOR_DELIVERY: { label: "Out for delivery", order: 6 },
  DELIVERED: { label: "Delivered", order: 7 },
  DELIVERY_FAILED: { label: "Delivery attempt unsuccessful", order: 6.5 },
  RTO_INITIATED: { label: "Returning to sender", order: 8 },
  RTO_DELIVERED: { label: "Returned to sender", order: 9 },
  CANCELLED: { label: "Shipment cancelled", order: 10 },
};

// Stored Shipment.status -> milestone key. Statuses not listed (PENDING, CREATING, FAILED, CREATION_FAILED) are not
// milestones.
const STATUS_TO_MILESTONE = {
  CREATED: "CREATED",
  PICKUP_SCHEDULED: "PICKUP_SCHEDULED",
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "IN_TRANSIT",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  FAILED_ATTEMPT: "DELIVERY_FAILED",
  RTO: "RTO_INITIATED",
  RTO_DELIVERED: "RTO_DELIVERED",
  CANCELLED: "CANCELLED",
};

export const milestoneForStatus = (status) => STATUS_TO_MILESTONE[status] || null;
export const customerStatusLabel = (status) => {
  const key = milestoneForStatus(status);
  if (key) return MILESTONES[key].label;
  if (status === "CREATION_FAILED" || status === "FAILED") return "Being prepared";
  return "Being prepared";
};

// Records a milestone once per shipment (unique shipmentId+status). Safe to call repeatedly: webhook replays,
// admin retries and out-of-order scans never create duplicates.
export async function recordMilestone(shipment, key, at = new Date()) {
  const def = MILESTONES[key];
  if (!def || !shipment?.id) return null;
  try {
    return await prisma.shipmentEvent.create({ data: { shipmentId: shipment.id, orderId: shipment.orderId, status: key, label: def.label, occurredAt: at } });
  } catch {
    return null; // already recorded
  }
}

// Admin alerts: only for exceptions that need a human. Normal scans never call this. Dedupes against an
// unread alert with the same title for the same order so retries and webhook replays do not spam.
const ALERTS = {
  SHIPMENT_CREATION_FAILED: { title: "Shipment creation failed", severity: "CRITICAL" },
  AWB_FAILED: { title: "AWB assignment failed", severity: "CRITICAL" },
  PICKUP_FAILED: { title: "Pickup scheduling failed", severity: "WARNING" },
  DELIVERY_FAILED: { title: "Delivery attempt failed", severity: "WARNING" },
  RTO_INITIATED: { title: "Return to origin started", severity: "WARNING" },
  CANCELLATION_FAILED: { title: "Shipment cancellation failed", severity: "WARNING" },
  NEEDS_PACKAGE_DETAILS: { title: "Order needs package details", severity: "WARNING" },
  NO_COURIER_AVAILABLE: { title: "No courier available", severity: "WARNING" },
};

export async function raiseShipmentAlert(kind, { orderId, orderNumber = null, detail = "" }) {
  const def = ALERTS[kind];
  if (!def || !orderId) return null;
  try {
    const existing = await prisma.adminNotification.findFirst({ where: { type: "SHIPMENT_FAILED", entityType: "order", entityId: orderId, title: def.title, isRead: false } });
    if (existing) return existing;
    const ref = orderNumber ? `Order ${orderNumber}` : "An order";
    return await createAdminNotification({ type: "SHIPMENT_FAILED", title: def.title, message: `${ref}: ${String(detail || def.title).slice(0, 300)}`, severity: def.severity, entityType: "order", entityId: orderId });
  } catch (err) {
    console.error("Shipment alert failed:", err.message);
    return null;
  }
}
