import Razorpay from "razorpay";
import { env } from "../../config/env.js";
import { getCredential } from "../integrations/credential.service.js";

let client = null;
let clientFingerprint = null;

// Lazily constructed so the app can boot (and its tests can mock this
// module) without real Razorpay credentials present — see payment.service.js
// for how callers are expected to check `isRazorpayConfigured()` first.
export async function getRazorpayConfig() {
  const configured = await getCredential("RAZORPAY", "LIVE").catch(() => null) || await getCredential("RAZORPAY", "TEST").catch(() => null);
  if (configured) return { ...configured.data, environment: configured.row.environment };
  return env.razorpay.isConfigured ? { keyId: env.razorpay.keyId, keySecret: env.razorpay.keySecret, webhookSecret: env.razorpay.webhookSecret, environment: "ENV" } : null;
}
export async function getRazorpayClient() {
  const config = await getRazorpayConfig();
  if (!config?.keyId || !config?.keySecret) return null;
  const fingerprint = `${config.keyId}:${config.keySecret}`;
  if (!client || clientFingerprint !== fingerprint) {
    client = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
    clientFingerprint = fingerprint;
  }
  return client;
}

export async function isRazorpayConfigured() {
  return Boolean(await getRazorpayConfig());
}
