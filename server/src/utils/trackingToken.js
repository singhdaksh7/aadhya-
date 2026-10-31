import crypto from "node:crypto";
import { env } from "../config/env.js";

// A stateless proof that the holder was sent the tracking link for this order (it is in the customer's email).
// HMAC of the order number under a server secret: no PII in the URL, nothing stored, and it only unlocks the
// customer-safe tracking view, never anything about payment or addresses beyond what /track-order returns.
export function trackingToken(orderNumber) {
  return crypto.createHmac("sha256", env.jwt.refreshSecret).update(`track:${orderNumber}`).digest("hex").slice(0, 40);
}

export function verifyTrackingToken(orderNumber, token) {
  if (typeof token !== "string" || token.length !== 40) return false;
  const expected = trackingToken(orderNumber);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}
