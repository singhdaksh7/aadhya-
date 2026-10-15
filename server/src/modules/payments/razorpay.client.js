import Razorpay from "razorpay";
import { env } from "../../config/env.js";
import { getCredential, getActiveEnvironment } from "../integrations/credential.service.js";

let client = null;
let clientFingerprint = null;

// Lazily constructed so the app can boot (and its tests can mock this
// module) without real Razorpay credentials present — see payment.service.js
// for how callers are expected to check `isRazorpayConfigured()` first.
const usable = (data) => Boolean(data?.keyId && data?.keySecret);

// Which credentials the storefront uses:
//  1. Admin-selected mode (TEST/LIVE) -> exactly that environment, never the other one
//     and never the env-var fallback. Missing/disabled/incomplete -> not configured.
//  2. No mode selected yet (pre-existing installs) -> legacy order: LIVE, then TEST,
//     then RAZORPAY_* env vars.
export async function getRazorpayConfig() {
  const mode = await getActiveEnvironment("RAZORPAY").catch(() => null);
  if (mode === "TEST" || mode === "LIVE") {
    const selected = await getCredential("RAZORPAY", mode).catch(() => null);
    return selected && usable(selected.data) ? { ...selected.data, environment: mode } : null;
  }
  for (const environment of ["LIVE", "TEST"]) {
    const configured = await getCredential("RAZORPAY", environment).catch(() => null);
    if (configured && usable(configured.data)) return { ...configured.data, environment };
  }
  return env.razorpay.isConfigured ? { keyId: env.razorpay.keyId, keySecret: env.razorpay.keySecret, webhookSecret: env.razorpay.webhookSecret, environment: "ENV" } : null;
}

export function buildRazorpayClient(config) {
  return new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
}
export async function getRazorpayClient() {
  const config = await getRazorpayConfig();
  if (!config?.keyId || !config?.keySecret) return null;
  const fingerprint = `${config.keyId}:${config.keySecret}`;
  if (!client || clientFingerprint !== fingerprint) {
    client = buildRazorpayClient(config);
    clientFingerprint = fingerprint;
  }
  return client;
}

export async function isRazorpayConfigured() {
  return Boolean(await getRazorpayConfig());
}
