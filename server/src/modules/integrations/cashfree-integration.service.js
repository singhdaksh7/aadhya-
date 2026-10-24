import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { describeCredential, getActiveEnvironment, markTest, getCredential } from "./credential.service.js";
import { SUPPORTED_CASHFREE_EVENTS, listWebhookDeliveries } from "./webhook-log.service.js";
import { getCashfreeConfig, cashfreeRequest, CashfreeError, CASHFREE_API_VERSION } from "../payments/cashfree.client.js";

const WEBHOOK_PATH = "/api/webhooks/cashfree";
const BASE_URL = { TEST: "https://sandbox.cashfree.com/pg", LIVE: "https://api.cashfree.com/pg" };

// The URL Admin pastes into the Cashfree dashboard. Derived, never typed: an explicit API_PUBLIC_URL
// wins, otherwise the origin this request actually reached us on.
export function webhookUrlFor(req) {
  const origin = env.apiPublicUrl || `${req.protocol}://${req.get("host")}`;
  return `${origin}${WEBHOOK_PATH}`;
}

async function environmentSummary(environment) {
  const d = await describeCredential("CASHFREE", environment);
  if (!d) {
    return { environment, configured: false, enabled: false, appId: null, secretKeyMask: null, lastTestedAt: null, testStatus: null };
  }
  return {
    environment,
    configured: Boolean(d.appId && d.hasSecretKey),
    enabled: d.row.isActive,
    appId: d.appId,
    secretKeyMask: d.secretKeyMask,
    decryptable: d.decryptable,
    lastTestedAt: d.row.lastTestedAt,
    testStatus: d.row.testStatus,
  };
}

export async function cashfreeSummary(req) {
  const [adminMode, active, test, live, paymentsRow, lastDelivery, lastVerified] = await Promise.all([
    getActiveEnvironment("CASHFREE"),
    getCashfreeConfig().catch(() => null),
    environmentSummary("TEST"),
    environmentSummary("LIVE"),
    prisma.siteSetting.findUnique({ where: { key: "payments" } }),
    prisma.webhookDeliveryLog.findFirst({ where: { provider: "cashfree" }, orderBy: { createdAt: "desc" } }),
    prisma.webhookDeliveryLog.findFirst({ where: { provider: "cashfree", signatureResult: "VERIFIED" }, orderBy: { createdAt: "desc" } }),
  ]);
  const payments = paymentsRow?.value || {};
  // Default is TEST (sandbox) until the owner explicitly switches to LIVE.
  const mode = adminMode === "LIVE" ? "LIVE" : "TEST";
  return {
    mode,
    modeSource: adminMode ? "admin" : "default",
    liveReady: Boolean(live.configured && live.enabled),
    environments: { TEST: test, LIVE: live },
    paymentMethods: { cashfreeEnabled: payments.cashfreeEnabled ?? true, codEnabled: payments.codEnabled ?? true },
    onlinePaymentAvailable: Boolean(active) && (payments.cashfreeEnabled ?? true),
    apiVersion: CASHFREE_API_VERSION,
    webhook: {
      url: webhookUrlFor(req),
      events: SUPPORTED_CASHFREE_EVENTS,
      lastReceivedAt: lastDelivery?.createdAt || null,
      lastEventType: lastVerified?.eventType || null,
      lastEventAt: lastVerified?.createdAt || null,
      lastSignature: lastDelivery?.signatureResult || null,
      lastResult: lastDelivery?.result || null,
      waitingForFirstSignedEvent: !lastVerified,
    },
  };
}

// Safe connection test: asks Cashfree for an order that cannot exist. Valid credentials get a clean
// "order not found"; bad credentials get 401/403. No order is created and nothing is charged.
export async function testCashfreeConnection(environment, adminId) {
  const stored = await getCredential("CASHFREE", environment).catch(() => null);
  const data = stored?.data;
  let outcome;
  if (!data?.appId || !data?.secretKey) outcome = "MISSING_CREDENTIALS";
  else {
    try {
      await cashfreeRequest({ appId: data.appId, secretKey: data.secretKey, baseUrl: BASE_URL[environment] }, "GET", `/orders/tushaqsa_connection_check_${Date.now().toString(36)}`);
      outcome = "CONNECTED";
    } catch (err) {
      if (err instanceof CashfreeError && err.status === 404) outcome = "CONNECTED";
      else if (err instanceof CashfreeError && (err.status === 401 || err.status === 403)) outcome = "AUTH_FAILED";
      else if (err instanceof CashfreeError && err.status === 0) outcome = "UNREACHABLE";
      else outcome = "INVALID_CONFIG";
    }
  }
  const row = stored ? await markTest("CASHFREE", environment, outcome === "CONNECTED" ? "SUCCESS" : "FAILED", adminId) : null;
  return { environment, outcome, testStatus: row?.testStatus || null, lastTestedAt: row?.lastTestedAt || null };
}

// Local verification only: Cashfree can send a test event from its dashboard, but we never pretend
// to have received one. Confirms we are ready and that unsigned requests are refused.
export async function verifyWebhookSetup(req) {
  const summary = await cashfreeSummary(req);
  const checks = [];
  const add = (key, label, pass, detail) => checks.push({ key, label, pass, detail });
  const active = summary.environments[summary.mode];
  add("credentials", "API credentials configured for the active mode", Boolean(active?.configured && active?.enabled), active?.configured ? `${summary.mode} mode` : "Add an App ID and Secret Key for the selected mode");
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
  add("events", "Handler supports the required events", true, SUPPORTED_CASHFREE_EVENTS.map((e) => e.event).join(", "));
  const ready = checks.every((c) => c.pass);
  return {
    ready,
    checks,
    waitingForFirstSignedEvent: summary.webhook.waitingForFirstSignedEvent,
    message: ready ? (summary.webhook.waitingForFirstSignedEvent ? "Waiting for the first signed Cashfree event." : "Setup verified. Signed events have been received.") : "Setup incomplete - see the failed checks.",
  };
}

export async function cashfreeWebhookEvents(limit) {
  const rows = await listWebhookDeliveries("cashfree", limit);
  return rows.map((r) => ({ id: r.id, time: r.createdAt, event: r.eventType, signature: r.signatureResult, result: r.result, reference: r.reference, error: r.errorSummary }));
}

// Only provided fields are checked: Admin may replace the Secret Key alone. Heuristics only fire on
// the clear Cashfree naming patterns (test app ids start with TEST; secret keys contain _test_ / _prod_).
export function validateCashfreePatch(environment, existingAppId, body) {
  const errors = {};
  const str = (v) => (typeof v === "string" ? v.trim() : undefined);
  const appId = str(body.appId);
  const secretKey = str(body.secretKey);
  if (!["TEST", "LIVE"].includes(environment)) errors.environment = "Environment must be TEST or LIVE.";
  if (appId) {
    if (environment === "LIVE" && /^TEST/i.test(appId)) errors.appId = "This looks like a TEST (sandbox) App ID. Use a production App ID for LIVE.";
    if (appId !== existingAppId && !secretKey) errors.secretKey = "Enter the Secret Key that belongs to the new App ID.";
  }
  if (secretKey) {
    if (environment === "LIVE" && /_test_/i.test(secretKey)) errors.secretKey = "This looks like a TEST (sandbox) Secret Key. Use a production Secret Key for LIVE.";
    if (environment === "TEST" && /_prod_/i.test(secretKey)) errors.secretKey = "This looks like a LIVE (production) Secret Key. Use a sandbox Secret Key for TEST.";
    if (!appId && !existingAppId) errors.appId = "Enter the App ID together with the Secret Key.";
  }
  if (Object.keys(errors).length) throw ApiError.badRequest("Please check your Cashfree settings.", errors);
  return { appId: appId || undefined, secretKey: secretKey || undefined };
}
