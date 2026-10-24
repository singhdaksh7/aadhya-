import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { getCredentialRaw, saveCredential, deleteCredential, describeCredential } from "./credential.service.js";
import { listWebhookDeliveries } from "./webhook-log.service.js";
import { WEBHOOK_TOKEN_PROVIDER } from "../shipping/shipment-status.webhook.js";
import { describeShiprocketMapping } from "../shipping/shiprocketStatus.js";

// Neutral path on purpose: Shiprocket does not accept callback URLs containing "shiprocket", "kartrocket", "sr" or "kr".
const WEBHOOK_PATH = "/api/webhooks/shipment-status";

export function shipmentWebhookUrl(req) {
  const origin = env.apiPublicUrl || `${req.protocol}://${req.get("host")}`;
  return `${origin}${WEBHOOK_PATH}`;
}

export async function shiprocketWebhookSummary(req) {
  const [token, credentials, lastDelivery, lastVerified, settingsRow] = await Promise.all([
    describeCredential(WEBHOOK_TOKEN_PROVIDER, "DEFAULT"),
    prisma.integrationCredential.findMany({ where: { provider: "SHIPROCKET" } }),
    prisma.webhookDeliveryLog.findFirst({ where: { provider: "shiprocket" }, orderBy: { createdAt: "desc" } }),
    prisma.webhookDeliveryLog.findFirst({ where: { provider: "shiprocket", signatureResult: "VERIFIED" }, orderBy: { createdAt: "desc" } }),
    prisma.siteSetting.findUnique({ where: { key: "shippingBusiness" } }),
  ]);
  return {
    enabled: (settingsRow?.value?.provider || "MANUAL") === "SHIPROCKET",
    credentials: credentials.map((c) => ({ environment: c.environment, isActive: c.isActive, lastTestedAt: c.lastTestedAt, testStatus: c.testStatus })),
    webhook: {
      url: shipmentWebhookUrl(req),
      header: "x-api-key",
      tokenConfigured: Boolean(token && token.row.isActive && token.decryptable),
      lastReceivedAt: lastDelivery?.createdAt || null,
      lastEventType: lastVerified?.eventType || null,
      lastResult: lastDelivery?.result || null,
      lastSignature: lastDelivery?.signatureResult || null,
      waitingForFirstEvent: !lastVerified,
    },
    mapping: describeShiprocketMapping(),
  };
}

export async function generateShiprocketWebhookToken(adminId) {
  const existing = await describeCredential(WEBHOOK_TOKEN_PROVIDER, "DEFAULT");
  const webhookToken = crypto.randomBytes(32).toString("base64url");
  await saveCredential(WEBHOOK_TOKEN_PROVIDER, "DEFAULT", { webhookToken, enabled: true }, adminId);
  await prisma.adminAuditLog.create({ data: { adminId, action: existing ? "SHIPROCKET_WEBHOOK_TOKEN_ROTATED" : "SHIPROCKET_WEBHOOK_TOKEN_CREATED", provider: "SHIPROCKET", metadata: {} } });
  return { webhookToken, shownOnce: true, rotated: Boolean(existing) };
}

export async function removeShiprocketWebhookToken(adminId) {
  if (!(await getCredentialRaw(WEBHOOK_TOKEN_PROVIDER, "DEFAULT"))) throw ApiError.badRequest("No webhook token is configured.");
  await deleteCredential(WEBHOOK_TOKEN_PROVIDER, "DEFAULT", adminId);
  await prisma.adminAuditLog.create({ data: { adminId, action: "SHIPROCKET_WEBHOOK_TOKEN_REMOVED", provider: "SHIPROCKET", metadata: {} } });
  return { removed: true };
}

export async function shiprocketWebhookEvents(limit) {
  const rows = await listWebhookDeliveries("shiprocket", limit);
  return rows.map((r) => ({ id: r.id, time: r.createdAt, event: r.eventType, signature: r.signatureResult, result: r.result, reference: r.reference, error: r.errorSummary }));
}

// Local checks only: we cannot make Shiprocket send an event, so we never claim one arrived.
export async function verifyShiprocketWebhookSetup(req) {
  const summary = await shiprocketWebhookSummary(req);
  const checks = [];
  const add = (key, label, pass, detail) => checks.push({ key, label, pass, detail });
  add("token", "Webhook security token configured", summary.webhook.tokenConfigured, summary.webhook.tokenConfigured ? "Requests must carry this token in x-api-key" : "Generate a token and paste it into Shiprocket");
  let reachable = false;
  let detail = "Could not reach the webhook URL from the server";
  try {
    const res = await fetch(summary.webhook.url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}", signal: AbortSignal.timeout(8000) });
    reachable = res.status === 401;
    detail = res.status === 401 ? "Endpoint reachable and rejecting requests without the token" : `Endpoint answered HTTP ${res.status}`;
  } catch {
    /* keep default detail */
  }
  add("endpoint", "Webhook endpoint reachable and enforcing the token", reachable, detail);
  add("url", "URL has no restricted words", !/shiprocket|kartrocket|\/sr|\/kr/i.test(summary.webhook.url.replace(/^https?:\/\/[^/]+/, "")), "Shiprocket rejects URLs containing shiprocket, kartrocket, sr or kr");
  const ready = checks.every((c) => c.pass);
  return {
    ready,
    checks,
    waitingForFirstEvent: summary.webhook.waitingForFirstEvent,
    message: ready ? (summary.webhook.waitingForFirstEvent ? "Waiting for the first event from Shiprocket." : "Setup verified. Events have been received.") : "Setup incomplete - see the failed checks.",
  };
}
