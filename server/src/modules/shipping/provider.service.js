import { ApiError } from "../../utils/ApiError.js";
// Provider seam: orders call this contract, never a carrier SDK directly.
// MANUAL is intentionally fully operational without third-party credentials.
const manual = {
  async createShipment({ input }) { return { provider: "MANUAL", providerShipmentId: null, carrier: input.carrier || "Manual fulfilment", trackingNumber: input.trackingNumber || null, trackingUrl: input.trackingUrl || null, awb: input.awb || null, estimatedDelivery: input.estimatedDelivery || null, status: "CREATED" }; },
  async cancelShipment() { return { cancelled: true }; },
  async getTracking(shipment) { return { status: shipment.status, trackingNumber: shipment.trackingNumber }; },
  async getRates() { return []; },
  async testConnection() { return { ok: true }; },
};
export function getShippingProvider(name = "MANUAL") { if (name === "MANUAL") return manual; throw ApiError.badRequest(`Shipping provider ${name} is not configured.`); }
