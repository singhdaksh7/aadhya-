import { prisma } from "../../lib/prisma.js";

const RETENTION_DAYS = 90;
const REJECTED_CAP_PER_HOUR = 200;

// Events Tushaqsa's Razorpay handler genuinely acts on. Anything else is accepted
// (200) and recorded as IGNORED. Keep this list in sync with webhook.controller.js.
export const SUPPORTED_RAZORPAY_EVENTS = [
  { event: "payment.captured", effect: "Marks the payment and order as paid, confirms the order and sends the invoice. Safe to receive more than once." },
  { event: "payment.failed", effect: "Records the failed payment attempt so the order stays unpaid and can be retried." },
];

// Best-effort: logging must never break webhook handling. Stores no payloads,
// signatures or secrets - only event type/ids, outcome and a short error summary.
export async function logWebhookDelivery(entry) {
  try {
    if (entry.result === "REJECTED") {
      // Unauthenticated endpoint: stop forged-request floods from filling the table.
      const recent = await prisma.webhookDeliveryLog.count({ where: { provider: entry.provider, result: "REJECTED", createdAt: { gt: new Date(Date.now() - 3600_000) } } });
      if (recent >= REJECTED_CAP_PER_HOUR) return;
    }
    await prisma.webhookDeliveryLog.create({
      data: {
        provider: entry.provider,
        eventType: entry.eventType || null,
        eventId: entry.eventId || null,
        signatureResult: entry.signatureResult,
        result: entry.result,
        reference: entry.reference || null,
        errorSummary: entry.errorSummary ? String(entry.errorSummary).slice(0, 200) : null,
      },
    });
    if (Math.random() < 0.02) {
      await prisma.webhookDeliveryLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86_400_000) } } });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[webhook] could not write delivery log:", err.message);
  }
}

export async function listWebhookDeliveries(provider, limit = 25) {
  return prisma.webhookDeliveryLog.findMany({ where: { provider }, orderBy: { createdAt: "desc" }, take: Math.min(Math.max(limit, 1), 100) });
}
