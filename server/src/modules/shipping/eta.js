// Shiprocket reports estimated delivery as text such as "Nov 04, 2026". Returns a Date at noon UTC (so any
// timezone renders the same calendar day) or null when it cannot be understood.
export function parseEtd(text) {
  if (!text) return null;
  const t = Date.parse(String(text));
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12));
}
