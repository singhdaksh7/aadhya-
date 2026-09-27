// Single source of truth for which OrderStatus transitions are legal.
// PENDING -> CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED is the happy
// path; CANCELLED is reachable from any non-terminal status. Nothing else
// is allowed — callers must go through canTransition()/assertTransition()
// rather than writing `status` directly.
export const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

const ALLOWED_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) return false;
  return ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

export function assertTransition(fromStatus, toStatus) {
  if (!canTransition(fromStatus, toStatus)) {
    const err = new Error(`Cannot move order from ${fromStatus} to ${toStatus}.`);
    err.statusCode = 409;
    err.isApiError = true;
    throw err;
  }
}
