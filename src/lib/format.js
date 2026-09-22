export function formatInr(amount) {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}
