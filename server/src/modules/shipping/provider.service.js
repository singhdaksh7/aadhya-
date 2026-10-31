import crypto from "node:crypto";
import { ApiError } from "../../utils/ApiError.js";
import { getCredential } from "../integrations/credential.service.js";
import { prisma } from "../../lib/prisma.js";

const manual = {
  async createShipment({ input }) { return { provider: "MANUAL", providerShipmentId: null, carrier: input.carrier || "Manual fulfilment", trackingNumber: input.trackingNumber || null, trackingUrl: input.trackingUrl || null, awb: input.awb || null, estimatedDelivery: input.estimatedDelivery || null, status: "CREATED" }; },
  async cancelShipment() { return { cancelled: true }; }, async getTracking(shipment) { return { status: shipment.status, trackingNumber: shipment.trackingNumber }; }, async getLabel() { return null; }, async schedulePickup() { return { supported: false }; }, async getRates() { return []; }, async getServiceability() { return { couriers: [], recommendedCourierCompanyId: null }; }, async testConnection() { return { ok: true }; }, verifyWebhook() { return false; },
};

function providerError(response) { const message = response?.message || response?.error || response?.errors?.[0]?.message; return new Error(message ? `Carrier request failed: ${message}` : "Carrier request failed."); }
async function shiprocketCredentials(environment = "LIVE") { const credential = await getCredential("SHIPROCKET", environment).catch(() => null) || await getCredential("SHIPROCKET", environment === "LIVE" ? "TEST" : "LIVE").catch(() => null); if (!credential?.data?.apiEmail || !credential.data.apiPassword) throw ApiError.badRequest("SHIPROCKET is not configured."); return credential.data; }
// Operational diagnostics (never credentials): last successful auth, last provider error, last serviceability
// check. Stored in SiteSetting so the Admin Integrations page can show them. Best effort; never blocks a call.
export async function recordShiprocketDiagnostic(patch) {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: "shiprocketDiagnostics" } });
    const value = { ...(row?.value || {}), ...patch };
    await prisma.siteSetting.upsert({ where: { key: "shiprocketDiagnostics" }, create: { key: "shiprocketDiagnostics", value }, update: { value } });
  } catch { /* diagnostics must never break fulfilment */ }
}
const safeMessage = (e) => String(e?.message || "Request failed").replace(/(password|token|secret|authorization|bearer)[^,;]*/gi, "[redacted]").slice(0, 240);

async function shiprocketRequest(path, { method = "GET", body, environment, timeoutMs = 20000 } = {}) {
  const credentials = await shiprocketCredentials(environment); const base = (credentials.apiBaseUrl || "https://apiv2.shiprocket.in/v1/external").replace(/\/$/, "");
  const op = `${method} ${String(path).split("?")[0]}`;
  try {
    const login = await fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: credentials.apiEmail, password: credentials.apiPassword }), signal: AbortSignal.timeout(timeoutMs) }); const auth = await login.json().catch(() => null); if (!login.ok || !auth?.token) throw providerError(auth);
    await recordShiprocketDiagnostic({ lastAuthAt: new Date().toISOString(), lastAuthOk: true });
    const response = await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${auth.token}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) }); const json = await response.json().catch(() => null); if (!response.ok || json?.status_code >= 400) throw providerError(json); return json;
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    const wrapped = timedOut ? new Error("Carrier request timed out. Try again in a moment.") : error;
    await recordShiprocketDiagnostic({ lastError: { message: safeMessage(wrapped), at: new Date().toISOString(), operation: op } });
    throw wrapped;
  }
}
function shiprocketAddress(address = {}) { return { name: address.fullName, address: [address.addressLine1, address.addressLine2, address.landmark].filter(Boolean).join(", "), city: address.city, state: address.state, pincode: String(address.postalCode), country: address.country || "India", email: address.email || undefined, phone: address.phone }; }

const shiprocket = {
  async testConnection({ environment } = {}) { await shiprocketRequest("/courier/serviceability/?pickup_postcode=110001&delivery_postcode=110001&weight=0.5&cod=0", { environment }); return { ok: true }; },
  // Official external API: GET /courier/serviceability/ (pickup_postcode, delivery_postcode, weight[kg], cod[0|1]).
  async getServiceability({ pickupPostcode, deliveryPostcode, package: pkg, cod, declaredValue, settings = {} }) {
    const qs = new URLSearchParams({ pickup_postcode: String(pickupPostcode), delivery_postcode: String(deliveryPostcode), weight: String(pkg.weight), cod: cod ? "1" : "0" });
    if (declaredValue) qs.set("declared_value", String(Math.round(Number(declaredValue))));
    for (const [k, v] of [["length", pkg.length], ["breadth", pkg.breadth], ["height", pkg.height]]) if (v) qs.set(k, String(v));
    const result = await shiprocketRequest(`/courier/serviceability/?${qs}`, { environment: settings.environment }).catch(async (e) => { await recordShiprocketDiagnostic({ lastServiceability: { at: new Date().toISOString(), ok: false, error: safeMessage(e), pickupPostcode: String(pickupPostcode), deliveryPostcode: String(deliveryPostcode) } }); throw e; });
    const data = result?.data || {};
    const couriers = (data.available_courier_companies || []).map((c) => ({ courierCompanyId: c.courier_company_id, name: c.courier_name, rate: Number(c.rate ?? c.freight_charge ?? 0), estimatedDeliveryDays: c.estimated_delivery_days ?? null, etd: c.etd ?? null, cod: c.cod === 1 || c.cod === true, rating: c.rating ?? null, chargeableWeight: c.charge_weight ?? null }));
    await recordShiprocketDiagnostic({ lastServiceability: { at: new Date().toISOString(), ok: true, couriers: couriers.length, pickupPostcode: String(pickupPostcode), deliveryPostcode: String(deliveryPostcode) } });
    return { couriers, recommendedCourierCompanyId: data.recommended_courier_company_id ?? null };
  },
  // Read-only: the pickup addresses registered in the Shiprocket account (Settings -> Pickup Addresses).
  async getPickupLocations({ settings = {} } = {}) {
    const result = await shiprocketRequest("/settings/company/pickup", { environment: settings.environment });
    const list = result?.data?.shipping_address || [];
    return list.map((l) => ({ nickname: l.pickup_location, name: l.name || null, phone: l.phone || null, address: [l.address, l.address_2].filter(Boolean).join(", ") || null, city: l.city || null, state: l.state || null, pincode: l.pin_code || null, verified: l.phone_verified === 1 || l.phone_verified === true }));
  },
  async createShipment({ input, settings }) {
    const shipping = shiprocketAddress(input.shippingAddress), billing = shiprocketAddress(input.billingAddress || input.shippingAddress);
    const payload = { order_id: input.order.number, order_date: new Date(input.order.date).toISOString().slice(0, 10), pickup_location: settings.pickup?.location || settings.pickupLocation || "Primary", billing_customer_name: billing.name, billing_last_name: "", billing_address: billing.address, billing_city: billing.city, billing_pincode: billing.pincode, billing_state: billing.state, billing_country: billing.country, billing_email: billing.email || input.customer.email, billing_phone: billing.phone || input.customer.phone, shipping_is_billing: false, shipping_customer_name: shipping.name, shipping_last_name: "", shipping_address: shipping.address, shipping_city: shipping.city, shipping_pincode: shipping.pincode, shipping_state: shipping.state, shipping_country: shipping.country, shipping_email: shipping.email || input.customer.email, shipping_phone: shipping.phone || input.customer.phone, order_items: input.items.map((item) => ({ name: item.name, sku: item.sku || item.name.slice(0, 80), units: item.quantity, selling_price: Number(item.sellingPrice), discount: Number(item.discount || 0), tax: Number(item.tax || 0), hsn: "" })), payment_method: input.order.paymentMethod === "cod" ? "COD" : "Prepaid", sub_total: input.items.reduce((sum, item) => sum + Number(item.sellingPrice) * item.quantity, 0), length: Number(input.package.length), breadth: Number(input.package.breadth ?? input.package.width), height: Number(input.package.height), weight: Number(input.package.weight) };
    const created = await shiprocketRequest("/orders/create/adhoc", { method: "POST", body: payload, environment: settings.environment }); const shipmentId = created.shipment_id || created.shipment?.id; let awbResult = null; const courierId = input.courierCompanyId || settings.courierCompanyId; if (shipmentId && courierId) awbResult = await shiprocketRequest("/courier/assign/awb", { method: "POST", body: { shipment_id: shipmentId, courier_company_id: Number(courierId) }, environment: settings.environment });
    return { provider: "SHIPROCKET", providerOrderId: String(created.order_id || input.order.number), providerShipmentId: shipmentId ? String(shipmentId) : null, awb: awbResult?.response?.data?.awb_code || awbResult?.awb_code || null, trackingNumber: awbResult?.response?.data?.awb_code || awbResult?.awb_code || null, carrier: awbResult?.response?.data?.courier_name || null, status: "CREATED" };
  },
  async generateAwb(shipment, settings = {}) { if (!settings.courierCompanyId) throw ApiError.badRequest("Set a Shiprocket courier company before generating an AWB."); const result = await shiprocketRequest("/courier/assign/awb", { method: "POST", body: { shipment_id: Number(shipment.providerShipmentId), courier_company_id: Number(settings.courierCompanyId) }, environment: settings.environment }); return { awb: result?.response?.data?.awb_code || result?.awb_code, carrier: result?.response?.data?.courier_name || null }; },
  async schedulePickup(shipment, settings = {}) { const result = await shiprocketRequest("/courier/generate/pickup", { method: "POST", body: { shipment_id: [Number(shipment.providerShipmentId)] }, environment: settings.environment }); return { supported: true, pickupStatus: result?.pickup_status || "PICKUP_SCHEDULED" }; },
  async getTracking(shipment, settings = {}) { const result = await shiprocketRequest(`/courier/track/shipment/${encodeURIComponent(shipment.providerShipmentId)}`, { environment: settings.environment }); const tracking = result?.tracking_data || result; return { rawStatus: tracking.shipment_status || tracking.shipment_track?.[0]?.current_status, trackingNumber: shipment.awb || tracking.shipment_track?.[0]?.awb_code, trackingUrl: tracking.track_url || null, raw: result }; },
  async getLabel(shipment, settings = {}) { return shiprocketRequest("/courier/generate/label", { method: "POST", body: { shipment_id: [Number(shipment.providerShipmentId)] }, environment: settings.environment }); },
  // Cancels at Shiprocket. Success is returned ONLY when the provider answered 2xx without an error status;
  // anything else throws so the caller leaves internal state untouched and the Admin can retry.
  async cancelShipment(shipment, settings = {}) {
    const result = shipment.awb
      ? await shiprocketRequest("/orders/cancel/shipment/awbs", { method: "POST", body: { awbs: [String(shipment.awb)] }, environment: settings.environment })
      : await shiprocketRequest("/orders/cancel", { method: "POST", body: { ids: [Number(shipment.providerOrderId)] }, environment: settings.environment });
    if (!result || (result.status_code != null && Number(result.status_code) >= 400)) throw new Error("Carrier request failed: cancellation was not confirmed.");
    return { cancelled: true };
  },  verifyWebhook(raw, signature, secret) { if (!signature || !secret) return false; const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex"); return expected.length === String(signature).length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature))); },
};
export function getShippingProvider(name = "MANUAL") { if (name === "MANUAL") return manual; if (name === "SHIPROCKET") return shiprocket; if (name === "DELHIVERY") throw ApiError.badRequest("DELHIVERY is disabled: the contracted API account, endpoint, and webhook-signature specification are required before enabling it."); throw ApiError.badRequest(`Shipping provider ${name} is not configured.`); }
