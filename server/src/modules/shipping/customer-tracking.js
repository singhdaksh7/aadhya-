import { customerStatusLabel, milestoneForStatus } from "./shipment-milestones.js";

const HIDDEN = new Set(["PENDING", "CREATING", "FAILED", "CREATION_FAILED"]);

// What a customer may know about a shipment: courier, AWB, a friendly status and the milestone timeline. There is
// deliberately no courier/Shiprocket link: customers follow their order on this website. Never the provider ids, raw provider status, error text, actor, source or webhook ids.
export function customerTrackingView(shipment) {
  if (!shipment || HIDDEN.has(shipment.status)) return null;
  const events = (shipment.events || []).slice().sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
  return {
    courier: shipment.carrier || null,
    awb: shipment.awb || shipment.trackingNumber || null,
    status: milestoneForStatus(shipment.status),
    statusLabel: customerStatusLabel(shipment.status),
    estimatedDelivery: shipment.estimatedDelivery || null,
    deliveredAt: shipment.deliveredDate || null,
    events: events.map((e) => ({ status: e.status, label: e.label, at: e.occurredAt })),
  };
}

// Order object safe to return to the customer / a guest holding the order token.
export function toCustomerOrder(order) {
  if (!order) return order;
  // eslint-disable-next-line no-unused-vars
  const { accessTokenHash, shipment, statusHistory, ...safe } = order;
  const out = { ...safe, tracking: customerTrackingView(shipment) };
  if (statusHistory) out.timeline = statusHistory.map((h) => ({ status: h.toStatus, at: h.changedAt }));
  return out;
}
