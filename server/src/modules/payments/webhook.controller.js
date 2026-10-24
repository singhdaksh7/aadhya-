import crypto from "node:crypto";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { prisma } from "../../lib/prisma.js";
import { verifyCashfreeWebhookSignature, syncCashfreePayment, markPaymentFailed } from "./payment.service.js";
import { getCashfreeConfig } from "./cashfree.client.js";
import { logWebhookDelivery } from "../integrations/webhook-log.service.js";

const log = (entry) => logWebhookDelivery({ provider: "cashfree", ...entry });

// Cashfree signs the exact raw bytes: app.js mounts this route with express.raw() ahead of the global
// express.json(), so req.body is a Buffer here.
//
// Trust model: the signature proves the request came from Cashfree, and then the payment state is
// re-read from Cashfree's API (syncCashfreePayment) before anything is marked paid. A payload alone
// never changes an order.
export const handleCashfreeWebhook = asyncHandler(async (req, res) => {
  const rawBody = req.body; // Buffer
  const signature = req.headers["x-webhook-signature"];
  const timestamp = req.headers["x-webhook-timestamp"];

  const config = Buffer.isBuffer(rawBody) ? await getCashfreeConfig() : null;
  if (!config?.secretKey) {
    await log({ signatureResult: "NOT_CONFIGURED", result: "REJECTED", errorSummary: "Cashfree is not configured" });
    return res.status(400).json({ success: false, error: { message: "Webhook not accepted" } });
  }

  if (!verifyCashfreeWebhookSignature(rawBody, timestamp, signature, config.secretKey)) {
    // eslint-disable-next-line no-console
    console.warn("[webhook] rejected Cashfree webhook: invalid signature", { ip: req.ip });
    await log({ signatureResult: "FAILED", result: "REJECTED", errorSummary: signature ? "Signature did not match" : "Signature header missing" });
    return res.status(400).json({ success: false, error: { message: "Invalid webhook signature" } });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    await log({ signatureResult: "VERIFIED", result: "FAILED", errorSummary: "Malformed webhook payload" });
    return res.status(400).json({ success: false, error: { message: "Malformed webhook payload" } });
  }

  const eventType = payload.type;
  const providerOrderId = payload.data?.order?.order_id || null;
  const cfPaymentId = payload.data?.payment?.cf_payment_id != null ? String(payload.data.payment.cf_payment_id) : null;
  const paymentStatus = payload.data?.payment?.payment_status || null;
  // Cashfree's own idempotency header when present (webhook version 2025-01-01+), else a stable
  // fingerprint of the event so a redelivery is recognised as a duplicate.
  const headerKey = req.headers["x-idempotency-key"] || req.headers["x-idempotency-header"];
  const eventId = headerKey
    ? String(headerKey).slice(0, 120)
    : `${eventType}:${providerOrderId}:${cfPaymentId}:${paymentStatus}:${crypto.createHash("sha256").update(rawBody).digest("hex").slice(0, 16)}`;
  const reference = providerOrderId || cfPaymentId;

  const existing = await prisma.webhookEvent.findUnique({ where: { provider_eventId: { provider: "cashfree", eventId } } });
  if (existing) {
    await log({ eventType, eventId, signatureResult: "VERIFIED", result: "DUPLICATE", reference });
    return res.status(200).json({ received: true, processed: false, duplicate: true });
  }

  let eventRow;
  try {
    eventRow = await prisma.webhookEvent.create({
      data: { provider: "cashfree", eventId, eventType: eventType || "UNKNOWN", metadata: { orderId: providerOrderId, paymentId: cfPaymentId } },
    });
  } catch {
    await log({ eventType, eventId, signatureResult: "VERIFIED", result: "DUPLICATE", reference });
    return res.status(200).json({ received: true, processed: false, duplicate: true });
  }

  try {
    let result = "IGNORED";
    if (providerOrderId && eventType === "PAYMENT_SUCCESS_WEBHOOK") {
      // Confirmed against Cashfree's API inside; throws if Cashfree can't be reached so it is retried.
      await syncCashfreePayment(providerOrderId);
      result = "PROCESSED";
    } else if (providerOrderId && (eventType === "PAYMENT_FAILED_WEBHOOK" || eventType === "PAYMENT_USER_DROPPED_WEBHOOK")) {
      // eslint-disable-next-line no-console
      console.error("[webhook] cashfree payment not completed", { providerOrderId, status: paymentStatus });
      await markPaymentFailed({ providerOrderId });
      result = "PROCESSED";
    }
    await log({ eventType, eventId, signatureResult: "VERIFIED", result, reference });
    return res.status(200).json({ received: true, processed: result === "PROCESSED" });
  } catch (err) {
    await log({ eventType, eventId, signatureResult: "VERIFIED", result: "FAILED", reference, errorSummary: err.message });
    // Unknown order: retrying cannot fix it, so keep the idempotency row and acknowledge.
    if (err.isApiError && err.statusCode === 404) {
      return res.status(200).json({ received: true, processed: false });
    }
    // Provider unreachable / unexpected failure: release the idempotency row so Cashfree's retry is processed.
    await prisma.webhookEvent.delete({ where: { id: eventRow.id } }).catch(() => {});
    return res.status(500).json({ success: false, error: { message: "Temporary failure, please retry" } });
  }
});
