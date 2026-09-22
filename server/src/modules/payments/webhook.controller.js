import crypto from "node:crypto";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { prisma } from "../../lib/prisma.js";
import { verifyRazorpayWebhookSignature, finalizePaidPayment, markPaymentFailed } from "./payment.service.js";
import { env } from "../../config/env.js";

// Razorpay webhooks arrive with a JSON body but signature verification
// needs the exact raw bytes — app.js mounts this route with express.raw()
// ahead of the global express.json() so req.body is a Buffer here.
export const handleRazorpayWebhook = asyncHandler(async (req, res) => {
  const rawBody = req.body; // Buffer

  if (!env.razorpay.webhookSecret) {
    // Not configured yet — acknowledge so Razorpay doesn't hammer retries,
    // but do nothing. Logged, not silently swallowed.
    // eslint-disable-next-line no-console
    console.warn("[webhook] RAZORPAY_WEBHOOK_SECRET not set — ignoring incoming webhook");
    return res.status(200).json({ received: true, processed: false });
  }

  const signature = req.headers["x-razorpay-signature"];
  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ success: false, error: { message: "Invalid webhook signature" } });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ success: false, error: { message: "Malformed webhook payload" } });
  }

  const eventType = payload.event;
  const entity = payload.payload?.payment?.entity || payload.payload?.order?.entity || {};
  const entityId = entity.id || crypto.createHash("sha256").update(rawBody).digest("hex").slice(0, 24);
  const eventId = `${eventType}:${entityId}`;

  // Idempotency fast path — checked before insert to avoid a logged
  // constraint-violation on every ordinary retry. The insert is still
  // wrapped below as a safety net for the rare simultaneous-delivery race.
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: "razorpay", eventId } },
  });
  if (existing) {
    return res.status(200).json({ received: true, processed: false, duplicate: true });
  }

  try {
    await prisma.webhookEvent.create({
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
    return res.status(200).json({ received: true, processed: false, duplicate: true });
  }

  if (eventType === "payment.captured") {
    const providerOrderId = entity.order_id;
    if (providerOrderId) {
      await finalizePaidPayment({
        providerOrderId,
        providerPaymentId: entity.id,
        method: entity.method,
        rawReference: entity.id,
      });
    }
  } else if (eventType === "payment.failed") {
    const providerOrderId = entity.order_id;
    if (providerOrderId) await markPaymentFailed({ providerOrderId });
  }
  // Other event types (e.g. refund.processed) are accepted but not acted on
  // in this phase — refunds are explicitly out of scope.

  res.status(200).json({ received: true, processed: true });
});
