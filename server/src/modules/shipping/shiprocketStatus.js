// The ONE mapping from Shiprocket's tracking statuses to this application's states.
//
// Shiprocket sends both a numeric status id (current_status_id / shipment_status_id) and a text status.
// The numeric id is the stable key, so it is used first; the text is only a fallback for payloads that
// omit the id. Anything unknown is "known:false": it is recorded but changes nothing and emails nobody.
//
// Result fields:
//   shipmentStatus  value stored on Shipment.status (app vocabulary), or null to leave it alone
//   orderStatus     order status this implies (applied forward-only, by the shared status function), or null
//   event           an extra customer email that is not an order-status change, or null
//   label           human label for logs/Admin
//
// Status ids below are the commonly documented Shiprocket shipment status ids. They could not be
// re-verified against Shiprocket's own (browser-rendered) docs from this environment, which is exactly why
// unknown ids are harmless and why the first real webhook should be checked against this table.

const S = (label, shipmentStatus, orderStatus = null, event = null) => ({ known: true, label, shipmentStatus, orderStatus, event });

export const SHIPROCKET_BY_ID = {
  1: S("AWB assigned", "CREATED"),
  2: S("Label generated", "CREATED"),
  3: S("Pickup scheduled", "PICKUP_SCHEDULED"),
  4: S("Pickup queued", "PICKUP_SCHEDULED"),
  5: S("Manifest generated", "PICKUP_SCHEDULED"),
  6: S("Shipped", "IN_TRANSIT", "SHIPPED"),
  7: S("Delivered", "DELIVERED", "DELIVERED"),
  8: S("Cancelled", "CANCELLED"),
  9: S("RTO initiated", "RTO"),
  10: S("RTO delivered", "RTO_DELIVERED"),
  11: S("Pending", null),
  12: S("Lost", null),
  13: S("Pickup error", null),
  14: S("RTO acknowledged", "RTO"),
  15: S("Pickup rescheduled", "PICKUP_SCHEDULED"),
  16: S("Cancellation requested", null),
  17: S("Out for delivery", "OUT_FOR_DELIVERY", "OUT_FOR_DELIVERY"),
  18: S("In transit", "IN_TRANSIT", "SHIPPED", "ORDER_IN_TRANSIT"),
  19: S("Out for pickup", "PICKUP_SCHEDULED"),
  20: S("Pickup exception", null),
  21: S("Undelivered", "FAILED_ATTEMPT", null, "ORDER_UNDELIVERED"),
  22: S("Delayed", null),
  23: S("Partial delivered", null),
  24: S("Destroyed", null),
  25: S("Damaged", null),
  38: S("Reached destination hub", "IN_TRANSIT", "SHIPPED"),
  40: S("RTO NDR", "RTO"),
  41: S("RTO out for delivery", "RTO"),
  42: S("Picked up", "PICKED_UP", "SHIPPED"),
  45: S("Cancelled before dispatch", "CANCELLED"),
  46: S("RTO in transit", "RTO"),
};

export const SHIPROCKET_BY_TEXT = {
  AWB_ASSIGNED: SHIPROCKET_BY_ID[1],
  PICKUP_SCHEDULED: SHIPROCKET_BY_ID[3],
  PICKUP_GENERATED: SHIPROCKET_BY_ID[3],
  PICKUP_QUEUED: SHIPROCKET_BY_ID[4],
  MANIFEST_GENERATED: SHIPROCKET_BY_ID[5],
  SHIPPED: SHIPROCKET_BY_ID[6],
  DELIVERED: SHIPROCKET_BY_ID[7],
  CANCELED: SHIPROCKET_BY_ID[8],
  CANCELLED: SHIPROCKET_BY_ID[8],
  RTO_INITIATED: SHIPROCKET_BY_ID[9],
  RTO_DELIVERED: SHIPROCKET_BY_ID[10],
  RTO_ACKNOWLEDGED: SHIPROCKET_BY_ID[14],
  OUT_FOR_DELIVERY: SHIPROCKET_BY_ID[17],
  IN_TRANSIT: SHIPROCKET_BY_ID[18],
  OUT_FOR_PICKUP: SHIPROCKET_BY_ID[19],
  UNDELIVERED: SHIPROCKET_BY_ID[21],
  DELAYED: SHIPROCKET_BY_ID[22],
  REACHED_AT_DESTINATION_HUB: SHIPROCKET_BY_ID[38],
  REACHED_DESTINATION_HUB: SHIPROCKET_BY_ID[38],
  PICKED_UP: SHIPROCKET_BY_ID[42],
  PICKUP_COMPLETE: SHIPROCKET_BY_ID[42],
};

const textKey = (v) => String(v ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export function resolveShiprocketStatus(payload = {}) {
  const idRaw = payload.current_status_id ?? payload.shipment_status_id;
  const id = Number(idRaw);
  if (Number.isInteger(id) && SHIPROCKET_BY_ID[id]) return { ...SHIPROCKET_BY_ID[id], statusId: id };
  const text = textKey(payload.current_status || payload.shipment_status);
  if (text && SHIPROCKET_BY_TEXT[text]) return { ...SHIPROCKET_BY_TEXT[text], statusId: Number.isInteger(id) ? id : null };
  return { known: false, label: payload.current_status || payload.shipment_status || (Number.isInteger(id) ? `status ${id}` : "unknown"), shipmentStatus: null, orderStatus: null, event: null, statusId: Number.isInteger(id) ? id : null };
}

// Table shown to Admin so the mapping is never a black box.
export function describeShiprocketMapping() {
  const rows = [];
  for (const [id, m] of Object.entries(SHIPROCKET_BY_ID)) {
    rows.push({ id: Number(id), shiprocket: m.label, becomes: m.orderStatus || m.shipmentStatus || "no change", email: m.orderStatus ? `${m.orderStatus} email` : m.event ? `${m.event}` : "none" });
  }
  return rows;
}
