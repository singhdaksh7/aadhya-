import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { getCredential } from "../integrations/credential.service.js";
import { logWebhookDelivery } from "../integrations/webhook-log.service.js";
import { resolveShiprocketStatus } from "./shiprocketStatus.js";
import { applyResolvedShipmentUpdate } from "./fulfilment.service.js";

// Courier tracking webhook. The path is deliberately neutral: Shiprocket refuses callback URLs that
// contain "shiprocket", "kartrocket", "sr" or "kr".
//
// Security (per Shiprocket's webhook settings): Shiprocket sends the token you configured in the
// `x-api-key` header; there is no signature or timestamp. The token is stored encrypted, compared in
// constant time (over SHA-256 digests so length never leaks), and never logged.
//
// Processing order: authenticate -> parse -> de-duplicate -> locate order/shipment -> map status ->
// apply (order status + at most one email per milestone). Authenticated requests always get 200 (also for
// unknown shipments/statuses) so Shiprocket does not retry something we can never act on.

const PROVIDER = "shiprocket-status";
const log = (entry) => logWebhookDelivery({ provider: "shiprocket", ...entry });

export const WEBHOOK_TOKEN_PROVIDER = "SHIPROCKET_WEBHOOK";

export async function getShipmentWebhookToken() {
  const cred = await getCredential(WEBHOOK_TOKEN_PROVIDER, "DEFAULT").catch(() => null);
  return cred?.data?.webhookToken || null;
}

const digest = (v) => crypto.createHash("sha256").update(String(v)).digest();
export function tokensMatch(expected, provided) {
  if (!expected || typeof provided !== "string" || !provided) return false;
  return crypto.timingSafeEqual(digest(expected), digest(provided));
}

async function locateShipment(payload) {
  const awb = String(payload.awb || "").trim();
  const srOrderId = payload.sr_order_id != null ? String(payload.sr_order_id) : "";
  const orderNumber = String(payload.order_id || "").trim();
  const or = [];
  if (awb) or.push({ awb }, { trackingNumber: awb });
  if (srOrderId) or.push({ providerOrderId: srOrderId });
  let shipment = or.length ? await prisma.shipment.findFirst({ where: { OR: or } }) : null;
  if (shipment) return shipment;
  // The owner may have shipped from Shiprocket's own panel without creating the shipment here: match on
  // our order number (sent to Shiprocket as order_id) and record the shipment so tracking info is kept.
  if (orderNumber) {
    const order = await prisma.order.findUnique({ where: { orderNumber }, include: { shipment: true } });
    if (order?.shipment) return order.shipment;
    if (order) {
      try {
        return await prisma.shipment.create({
          data: { orderId: order.id, provider: "SHIPROCKET", status: "CREATED", awb: awb || null, trackingNumber: awb || null, carrier: payload.courier_name || null, providerOrderId: srOrderId || null },
        });
      } catch {
        return prisma.shipment.findUnique({ where: { orderId: order.id } });
      }
    }
  }
  return null;
}

export async function handleShipmentStatusWebhook(req, res) {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  const expected = await getShipmentWebhookToken();
  if (!expected || !tokensMatch(expected, req.headers["x-api-key"])) {
    await log({ signatureResult: expected ? "FAILED" : "NOT_CONFIGURED", result: "REJECTED", errorSummary: expected ? "Security token did not match" : "Webhook token is not configured" });
    return res.status(401).json({ success: false });
  }

  let payload;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    await log({ signatureResult: "VERIFIED", result: "FAILED", errorSummary: "Malformed payload" });
    return res.status(400).json({ success: false });
  }
  if (!payload || typeof payload !== "object") {
    await log({ signatureResult: "VERIFIED", result: "FAILED", errorSummary: "Unexpected payload" });
    return res.status(400).json({ success: false });
  }

  const status = resolveShiprocketStatus(payload);
  const reference = String(payload.awb || payload.order_id || "").slice(0, 80) || null;
  const eventType = String(payload.current_status || payload.shipment_status || status.label || "tracking").slice(0, 80);
  // Same awb + same status + same courier timestamp = same event (Shiprocket can deliver it more than once).
  const eventId = crypto
    .createHash("sha256")
    .update([payload.awb, payload.current_status_id ?? payload.shipment_status_id, payload.current_timestamp, payload.sr_order_id].join("|"))
    .digest("hex");

  try {
    await prisma.webhookEvent.create({ data: { provider: PROVIDER, eventId, eventType, metadata: { awb: payload.awb || null, statusId: status.statusId } } });
  } catch {
    await log({ eventType, eventId, signatureResult: "VERIFIED", result: "DUPLICATE", reference });
    return res.status(200).end();
  }

  try {
    // Reverse (customer return) shipments are tracked by the returns flow; they must not move the original order.
    if (Number(payload.is_return) === 1 || payload.is_return === true) {
      await log({ eventType, eventId, signatureResult: "VERIFIED", result: "IGNORED", reference, errorSummary: "Return shipment" });
      return res.status(200).end();
    }
    if (!status.known) {
      await log({ eventType, eventId, signatureResult: "VERIFIED", result: "IGNORED", reference, errorSummary: "Unmapped status" });
      return res.status(200).end();
    }
    const shipment = await locateShipment(payload);
    if (!shipment) {
      await log({ eventType, eventId, signatureResult: "VERIFIED", result: "IGNORED", reference, errorSummary: "No matching order/shipment" });
      return res.status(200).end();
    }
    // The courier name goes on the shipment first so the customer email can show it.
    if (payload.courier_name && !shipment.carrier) {
      const carrier = String(payload.courier_name).slice(0, 120);
      await prisma.shipment.update({ where: { id: shipment.id }, data: { carrier } }).catch(() => {});
      shipment.carrier = carrier;
    }
    await applyResolvedShipmentUpdate(shipment, {
      shipmentStatus: status.shipmentStatus,
      orderStatus: status.orderStatus,
      event: status.event,
      milestone: status.milestone || null,
      alert: status.alert || null,
      rawStatus: payload.current_status || payload.shipment_status || status.label,
      trackingNumber: payload.awb ? String(payload.awb) : undefined,
      estimatedDelivery: payload.etd && !Number.isNaN(Date.parse(payload.etd)) ? new Date(payload.etd) : undefined,
      source: "SHIPROCKET",
      providerEventId: eventId,
    });
    await log({ eventType, eventId, signatureResult: "VERIFIED", result: "PROCESSED", reference });
    return res.status(200).end();
  } catch (err) {
    await log({ eventType, eventId, signatureResult: "VERIFIED", result: "FAILED", reference, errorSummary: err.message });
    // Unexpected failure: release the idempotency row so Shiprocket's retry is processed, and ask for one.
    await prisma.webhookEvent.delete({ where: { provider_eventId: { provider: PROVIDER, eventId } } }).catch(() => {});
    return res.status(500).json({ success: false });
  }
}
