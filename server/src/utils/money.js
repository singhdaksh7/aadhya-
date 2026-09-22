// All money in the database and in service-layer math is Decimal rupees
// (matching Product.price's existing convention). Razorpay's API speaks in
// integer paise, so these two helpers are the only place that boundary is
// crossed — never do ad-hoc float math on money anywhere else.
export function rupeesToPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

export function paiseToRupees(paise) {
  return Math.round(paise) / 100;
}

export function round2(amount) {
  return Math.round(Number(amount) * 100) / 100;
}
