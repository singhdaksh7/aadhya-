import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { describeCredential, getActiveEnvironment, markTest, getCredential } from "./credential.service.js";
import { SUPPORTED_RAZORPAY_EVENTS, listWebhookDeliveries } from "./webhook-log.service.js";
import { getRazorpayConfig, buildRazorpayClient } from "../payments/razorpay.client.js";

const WEBHOOK_PATH = "/api/webhooks/razorpay";
const PREFIX = { TEST: "rzp_test_", LIVE: "rzp_live_" };

// The URL Admin pastes into the Razorpay dashboard. Derived, never typed: an explicit
// API_PUBLIC_URL wins, otherwise the origin this request actually reached us on
// (Traefik forwards Host/Proto; TRUST_PROXY makes req.protocol honest). A domain change
// therefore updates this automatically.
export function webhookUrlFor(req) {
  const origin = env.apiPublicUrl || `${req.protocol}://${req.get("host")}`;
  return `${origin}${WEBHOOK_PATH}`;
}

async function environmentSummary(environment) {
  const d = await describeCredential("RAZORPAY", environment);
  if (!d) {
    return { environment, configured: false, enabled: false, keyId: null, keySecretMask: null, webhookSecretConfigured: false, webhookSecretMask: null, lastTestedAt: null, testStatus: null };
  }
  return {
    environment,
    configured: Boolean(d.keyId && d.hasKeySecret),
    enabled: d.row.isActive,
    keyId: d.keyId,
    keySecretMask: d.keySecretMask,
    webhookSecretConfigured: d.hasWebhookSecret,
    webhookSecretMask: d.webhookSecretMask,
    decryptable: d.decryptable,
    lastTestedAt: d.row.lastTestedAt,
    testStatus: d.row.testStatus,
  };
}

export async function razorpaySummary(req) {
  const [adminMode, active, test, live, paymentsRow, lastDelivery, lastVerified, verifiedCount] = await Promise.all([
    getActiveEnvironment("RAZORPAY"),
    getRazorpayConfig().catch(() => null),
    environmentSummary("TEST"),
    environmentSummary("LIVE"),
    prisma.siteSetting.findUnique({ where: { key: "payments" } }),
    prisma.webhookDeliveryLog.findFirst({ where: { provider: "razorpay" }, orderBy: { createdAt: "desc" } }),
    prisma.webhookDeliveryLog.findFirst({ where: { provider: "razorpay", signatureResult: "VERIFIED" }, orderBy: { createdAt: "desc" } }),
    prisma.webhookEvent.count({ where: { provider: "razorpay" } }),
  ]);
  const activeEnv = adminMode || (active && ["TEST", "LIVE"].includes(active.environment) ? active.environment : null);
  const selected = activeEnv === "LIVE" ? live : activeEnv === "TEST" ? test : null;
  const payments = paymentsRow?.value || {};
  // Pre-existing installs have webhook events recorded before the delivery log existed.
  const legacyEvent = !lastVerified && verifiedCount ? await prisma.webhookEvent.findFirst({ where: { provider: "razorpay" }, orderBy: { processedAt: "desc" } }) : null;
  return {
    mode: activeEnv,
    modeSource: adminMode ? "admin" : active ? (active.environment === "ENV" ? "environment" : "legacy") : "none",
    usingEnvironmentVariables: active?.environment === "ENV",
    environments: { TEST: test, LIVE: live },
    paymentMethods: { razorpayEnabled: payments.razorpayEnabled ?? true, codEnabled: payments.codEnabled ?? true },
    webhook: {
      url: webhookUrlFor(req),
      events: SUPPORTED_RAZORPAY_EVENTS,
      secretConfigured: Boolean(selected?.webhookSecretConfigured) || Boolean(active?.webhookSecret),
      lastReceivedAt: lastDelivery?.createdAt || legacyEvent?.processedAt || null,
      lastEventType: lastVerified?.eventType || legacyEvent?.eventType || null,
      lastEventAt: lastVerified?.createdAt || legacyEvent?.processedAt || null,
      lastSignature: lastDelivery?.signatureResult || (legacyEvent ? "VERIFIED" : null),
      lastResult: lastDelivery?.result || (legacyEvent ? "PROCESSED" : null),
      waitingForFirstSignedEvent: !lastVerified && !verifiedCount,
    },
  };
}

// Map a Razorpay SDK failure to a safe, secret-free outcome.
function classifyFailure(err) {
  const status = err?.statusCode;
  if (status === 401) return "AUTH_FAILED";
  if (!status) return "UNREACHABLE";
  return "INVALID_CONFIG";
}

// Tests the credentials of the REQUESTED environment (not whichever is active).
export async function testRazorpayConnection(environment, adminId) {
  const stored = await getCredential("RAZORPAY", environment).catch(() => null);
  const data = stored?.data;
  let outcome;
  if (!data?.keyId || !data?.keySecret) outcome = "MISSING_CREDENTIALS";
  else if (!data.keyId.startsWith(PREFIX[environment])) outcome = "INVALID_CONFIG";
  else {
    try {
      await buildRazorpayClient(data).orders.all({ count: 1 });
      outcome = "CONNECTED";
    } catch (err) {
      outcome = classifyFailure(err);
    }
  }
  const row = stored ? await markTest("RAZORPAY", environment, outcome === "CONNECTED" ? "SUCCESS" : "FAILED", adminId) : null;
  return { environment, outcome, testStatus: row?.testStatus || null, lastTestedAt: row?.lastTestedAt || null };
}

// Local verification only. Razorpay offers no API to fire a signed test event, so this
// never pretends to: it confirms Tushaqsa is ready, then reports whether a real signed
// event has ever arrived.
export async function verifyWebhookSetup(req) {
  const summary = await razorpaySummary(req);
  const checks = [];
  const add = (key, label, pass, detail) => checks.push({ key, label, pass, detail });
  const active = summary.mode ? summary.environments[summary.mode] : null;
  add("credentials", "API credentials configured for the active mode", Boolean(active?.configured), active?.configured ? `${summary.mode} mode` : "Add a Key ID and Key Secret for the selected mode");
  add("secret", "Webhook secret configured", summary.webhook.secretConfigured, summary.webhook.secretConfigured ? "Signatures can be verified" : "Set or generate a webhook secret");
  // Self-call: an unsigned request must be refused (400) when the secret is configured.
  let reachable = false;
  let detail = "Could not reach the webhook URL from the server";
  try {
    const res = await fetch(summary.webhook.url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}", signal: AbortSignal.timeout(8000) });
    reachable = res.status === 400;
    detail = res.status === 400 ? "Endpoint reachable and rejecting unsigned requests" : `Endpoint answered HTTP ${res.status}`;
  } catch {
    /* keep default detail */
  }
  add("endpoint", "Webhook endpoint reachable and enforcing signatures", reachable, detail);
  add("events", "Handler supports the required events", true, SUPPORTED_RAZORPAY_EVENTS.map((e) => e.event).join(", "));
  const ready = checks.every((c) => c.pass);
  return {
    ready,
    checks,
    waitingForFirstSignedEvent: summary.webhook.waitingForFirstSignedEvent,
    message: ready ? (summary.webhook.waitingForFirstSignedEvent ? "Waiting for first signed Razorpay event." : "Setup verified. Signed events have been received.") : "Setup incomplete - see the failed checks.",
  };
}

export async function razorpayWebhookEvents(limit) {
  const rows = await listWebhookDeliveries("razorpay", limit);
  return rows.map((r) => ({ id: r.id, time: r.createdAt, event: r.eventType, signature: r.signatureResult, result: r.result, reference: r.reference, error: r.errorSummary }));
}

// Validation for the dedicated Razorpay endpoint: only provided fields are checked,
// because Admin may replace one secret at a time.
export function validateRazorpayPatch(environment, existingKeyId, body) {
  const errors = {};
  const str = (v) => (typeof v === "string" ? v.trim() : undefined);
  const keyId = str(body.keyId);
  const keySecret = str(body.keySecret);
  const webhookSecret = str(body.webhookSecret);
  if (!["TEST", "LIVE"].includes(environment)) errors.environment = "Environment must be TEST or LIVE.";
  if (keyId) {
    const other = environment === "TEST" ? PREFIX.LIVE : PREFIX.TEST;
    if (keyId.startsWith(other)) errors.keyId = `This looks like a ${environment === "TEST" ? "LIVE" : "TEST"} Razorpay key. Select ${environment === "TEST" ? "LIVE" : "TEST"} or use a ${environment} key.`;
    else if (!keyId.startsWith(PREFIX[environment])) errors.keyId = `A ${environment} Key ID starts with ${PREFIX[environment]}.`;
    if (keyId !== existingKeyId && !keySecret) errors.keySecret = "Enter the Key Secret that belongs to the new Key ID.";
  }
  if (keySecret && !keyId && !existingKeyId) errors.keyId = "Enter the Key ID together with the Key Secret.";
  if (webhookSecret && webhookSecret.length < 8) errors.webhookSecret = "Webhook secret must be at least 8 characters.";
  if (Object.keys(errors).length) throw ApiError.badRequest("Please check your Razorpay settings.", errors);
  return { keyId: keyId || undefined, keySecret: keySecret || undefined, webhookSecret: webhookSecret || undefined };
}
