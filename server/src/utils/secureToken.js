import crypto from "node:crypto";

// High-entropy opaque tokens for guest order access (confirmation links).
// Only the SHA-256 hash is ever persisted — the raw value exists solely in
// the one response returned to the browser at order-creation time.
export function generateToken() {
  return crypto.randomBytes(24).toString("hex"); // 192 bits
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function safeCompareHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
