import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { getCredential } from "../integrations/credential.service.js";
import { applyTrackingUpdate } from "./fulfilment.service.js";

export async function handleShippingWebhook(req, res) {
  const provider = String(req.params.provider || "").toUpperCase(); const raw = req.body;
  const credential = await getCredential(provider, "LIVE").catch(() => null);
  const secret = credential?.data?.webhookSecret;
  const signature = req.headers["x-shipping-signature"];
  if (!secret || !signature) return res.status(401).json({ success: false });
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  if (expected.length !== String(signature).length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)))) return res.status(401).json({ success: false });
  let payload; try { payload = JSON.parse(raw.toString("utf8")); } catch { return res.status(400).json({ success: false }); }
  const eventId = String(payload.eventId || payload.id || crypto.createHash("sha256").update(raw).digest("hex"));
  try { await prisma.webhookEvent.create({ data: { provider: `shipping:${provider}`, eventId, eventType: String(payload.status || payload.event || "tracking") } }); } catch { return res.json({ received: true, duplicate: true }); }
  await applyTrackingUpdate({ provider, providerShipmentId: payload.providerShipmentId || payload.shipmentId || payload.orderId, rawStatus: payload.status, trackingNumber: payload.trackingNumber || payload.awb, trackingUrl: payload.trackingUrl, estimatedDelivery: payload.estimatedDelivery ? new Date(payload.estimatedDelivery) : undefined });
  return res.json({ received: true });
}
