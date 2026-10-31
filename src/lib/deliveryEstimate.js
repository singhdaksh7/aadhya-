const KEY = "aadhya:lastPincode";
export const PIN_RE = /^\d{6}$/;

export function readSavedPincode() {
  try {
    const v = window.localStorage.getItem(KEY);
    return v && PIN_RE.test(v) ? v : "";
  } catch {
    return "";
  }
}

export function savePincode(pin) {
  try {
    if (PIN_RE.test(pin)) window.localStorage.setItem(KEY, pin);
  } catch {
    /* storage unavailable: ignore */
  }
}

const shortDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

// "4 Nov – 6 Nov" (or just "4 Nov" when earliest and latest fall on the same day).
export function formatEtaRange(eta) {
  if (!eta) return "";
  const a = shortDate(eta.earliest);
  const b = shortDate(eta.latest || eta.earliest);
  if (!a && !b) return "";
  if (!a || !b || a === b) return a || b;
  return `${a} – ${b}`;
}
