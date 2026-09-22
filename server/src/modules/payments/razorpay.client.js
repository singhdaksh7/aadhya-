import Razorpay from "razorpay";
import { env } from "../../config/env.js";

let client = null;

// Lazily constructed so the app can boot (and its tests can mock this
// module) without real Razorpay credentials present — see payment.service.js
// for how callers are expected to check `isRazorpayConfigured()` first.
export function getRazorpayClient() {
  if (!env.razorpay.isConfigured) return null;
  if (!client) {
    client = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
  }
  return client;
}

export function isRazorpayConfigured() {
  return env.razorpay.isConfigured;
}
