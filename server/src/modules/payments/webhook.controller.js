import crypto from "node:crypto";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { prisma } from "../../lib/prisma.js";
import { verifyRazorpayWebhookSignature, finalizePaidPayment, markPaymentFailed } from "./payment.service.js";
import { getRazorpayConfig } from "./razorpay.client.js";
import { logWebhookDelivery } from "../integrations/webhook-log.service.js";

const log = (entry) => logWebhookDelivery({ provider: "razorpay", ...entry });

// Razorpay webhooks arrive with a JSON body but signature verification
// needs the exact raw bytes — app.js mounts this route with express.raw()
// ahead of the global express.json() so req.body is a Buffer here.
export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const rawBody = req.body; // Buffer

  if (!(await getRazorpayConfig())?.webhookSecret) {
    // Not configured yet — acknowledge so Razorpay doesn't hammer retries,
    // but do nothing. Logged, not silently swallowed.
    // eslint-disable-next-line no-console
    console.warn("[webhook] Razorpay webhook secret not configured — ignoring incoming webhook");
    await log({ signatureResult: "NOT_CONFIGURED", result: "IGNORED", errorSummary: "Webhook secret is not configured" });
    return res.status(200).json({ received: true, processed: false });
  }

  const signature = req.headers["x-razorpay-signature"];
  if (!(await verifyRazorpayWebhookSignature(rawBody, signature))) {
    // Logged without the signature/body value itself — an invalid signature
    // is a security-relevant event (forged/replayed webhook attempt).
    // eslint-disable-next-line no-console
    console.warn("[webhook] rejected Razorpay webhook: invalid signature", { ip: req.ip });
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

  const eventType = payload.event;
  const entity = payload.payload?.payment?.entity || payload.payload?.order?.entity || {};
  const entityId = entity.id || crypto.createHash("sha256").update(rawBody).digest("hex").slice(0, 24);
  const eventId = `${eventType}:${entityId}`;
  const reference = entity.order_id || entity.id || null;

  // Idempotency fast path — checked before insert to avoid a logged
  // constraint-violation on every ordinary retry. The insert is still
  // wrapped below as a safety net for the rare simultaneous-delivery race.
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: "razorpay", eventId } },
  });
  if (existing) {
    await log({ eventType, eventId, signatureResult: "VERIFIED", result: "DUPLICATE", reference });
    return res.status(200).json({ received: true, processed: false, duplicate: true });
  }

  let eventRow;
  try {
    eventRow = await prisma.webhookEvent.create({
      data: {
        provider: "razorpay",
        eventId,
        eventType,
        metadata: {
          orderId: entity.order_id || null,
          paymentId: entity.id || null,
        },
      },
    });
  } catch {
    await log({ eventType, eventId, signatureResult: "VERIFIED", result: "DUPLICATE", reference });
    return res.status(200).json({ received: true, processed: false, duplicate: true });
  }

  try {
    let result = "IGNORED";
    if (eventType === "payment.captured") {
      const providerOrderId = entity.order_id;
      if (providerOrderId) {
        await finalizePaidPayment({
          providerOrderId,
          providerPaymentId: entity.id,
          method: entity.method,
          rawReference: entity.id,
          amountPaise: typeof entity.amount === "number" ? entity.amount : undefined,
        });
        result = "PROCESSED";
      }
    } else if (eventType === "payment.failed") {
      const providerOrderId = entity.order_id;
      if (providerOrderId) {
        // eslint-disable-next-line no-console
        console.error("[webhook] payment.failed", { providerOrderId, reason: entity.error_description || entity.error_code || "unknown" });
        await markPaymentFailed({ providerOrderId });
        result = "PROCESSED";
      }
    }
    // Other event types (e.g. refund.processed) are accepted but not acted on
    // — refunds are explicitly out of scope.
    await log({ eventType, eventId, signatureResult: "VERIFIED", result, reference });
    return res.status(200).json({ received: true, processed: result === "PROCESSED" });
  } catch (err) {
    await log({ eventType, eventId, signatureResult: "VERIFIED", result: "FAILED", reference, errorSummary: err.message });
    if (err.isApiError) {
      // Business rejection (unknown order, amount mismatch): retrying cannot fix it,
      // so keep the idempotency row and acknowledge.
      return res.status(200).json({ received: true, processed: false });
    }
    // Unexpected failure (DB blip etc.): release the idempotency row so Razorpay's
    // retry is processed instead of being swallowed as a duplicate.
    await prisma.webhookEvent.delete({ where: { id: eventRow.id } }).catch(() => {});
    throw err;
  }
});
