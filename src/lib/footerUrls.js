// URL safety helpers for admin-entered footer links. Mirrors the server schema:
// relative ("/x"), http(s), and (contact rows only) tel: / mailto:. Anything else
// (javascript:, data:, protocol-relative //host, ...) is rejected.

export function isSafeFooterUrl(value, { allowTelMailto = false } = {}) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  if (/[\s\u0000-\u001f]/.test(v)) return false;
  if (v.startsWith("//")) return false;
  if (v.startsWith("/")) return true;
  if (allowTelMailto && /^(tel|mailto):\S+$/i.test(v)) return true;
  try {
    const u = new URL(v);
    return (u.protocol === "http:" || u.protocol === "https:") && Boolean(u.hostname);
  } catch {
    return false;
  }
}

export const isExternalUrl = (v) => /^https?:\/\//i.test(String(v || ""));
export const isTelOrMailto = (v) => /^(tel|mailto):/i.test(String(v || ""));

// Returns an error message for an admin form field, or "" when empty/valid.
export function footerUrlError(value, { allowTelMailto = false } = {}) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (isSafeFooterUrl(v, { allowTelMailto })) return "";
  return allowTelMailto
    ? "Use a relative path (/page), http(s) link, tel: or mailto:"
    : "Use a relative path (/page) or an http(s) link";
}

export const sortByOrder = (list) =>
  [...list].sort((a, b) => (Number(a?.sortOrder) || 0) - (Number(b?.sortOrder) || 0));
