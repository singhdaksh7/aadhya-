import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { round2 } from "../../utils/money.js";
import { ApiError } from "../../utils/ApiError.js";

// All admin-configurable shipping/COD defaults live here — nothing in this
// module hardcodes a specific rupee amount. Values are always resolved
// through getShippingSettings(), which reads the SiteSetting("shipping") row
// and falls back to env vars only when the DB has no value at all.
const FALLBACK_SETTINGS = {
  shippingEnabled: true,
  standardShippingAmount: env.shipping.standardAmount,
  freeShippingThreshold: env.shipping.freeThreshold,
  dispatchEstimate: "1-2 business days",
  deliveryEstimate: "3-7 business days",
  codEnabled: true,
  codMinOrderValue: 0,
  codMaxOrderValue: 50000,
  codFee: 0,
};

export async function getShippingSettings() {
  try {
    const rows = await prisma.siteSetting.findMany({ where: { key: { in: ["shipping", "payments"] } } });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const shipping = map.shipping || {};
    const payments = map.payments || {};
    return {
      ...FALLBACK_SETTINGS,
      ...shipping,
      codEnabled: payments.codEnabled ?? FALLBACK_SETTINGS.codEnabled,
      codMinOrderValue: payments.codMinOrderValue ?? FALLBACK_SETTINGS.codMinOrderValue,
      codMaxOrderValue: payments.codMaxOrderValue ?? FALLBACK_SETTINGS.codMaxOrderValue,
      codFee: payments.codFee ?? FALLBACK_SETTINGS.codFee,
    };
  } catch {
    return { ...FALLBACK_SETTINGS };
  }
}

// Finds the most specific active zone for a shipping address: an exact
// postal-code match beats a state-only match. Returns null when nothing
// covers the address — callers must decide how to fall back (flat default
// shipping, but COD is treated as unsupported for an unmatched zone).
export async function findZoneForAddress({ state, postalCode }) {
  const zones = await prisma.shippingZone.findMany({
    where: { active: true },
    include: { rates: { where: { active: true } } },
  });

  const normalizedState = (state || "").trim().toLowerCase();
  const normalizedPostal = (postalCode || "").trim();

  let stateMatch = null;
  for (const zone of zones) {
    if (zone.postalCodes?.some((pc) => pc === normalizedPostal)) return zone;
    if (!stateMatch && zone.states?.some((s) => s.trim().toLowerCase() === normalizedState)) {
      stateMatch = zone;
    }
  }
  return stateMatch;
}

function pickRate(zone, subtotal) {
  if (!zone?.rates?.length) return null;
  // Prefer the rate whose freeAbove threshold the subtotal already clears
  // (so a zone can offer tiered "free above X" rates); otherwise the first
  // active rate for the zone.
  const applicable = zone.rates.find((r) => r.freeAbove != null && subtotal >= Number(r.freeAbove));
  return applicable || zone.rates[0];
}

// Server-authoritative shipping computation. `zone` may be null (no zone
// configured/matched) in which case the flat settings-driven fee applies.
export function computeShippingAmount(subtotal, settings, zone) {
  if (!settings.shippingEnabled) return { amount: 0, deliveryEstimate: settings.deliveryEstimate };
  if (subtotal <= 0) return { amount: 0, deliveryEstimate: settings.deliveryEstimate };

  const rate = pickRate(zone, subtotal);
  if (rate) {
    const freeAbove = rate.freeAbove != null ? Number(rate.freeAbove) : null;
    const amount = freeAbove != null && subtotal >= freeAbove ? 0 : round2(Number(rate.rate));
    return { amount, deliveryEstimate: rate.deliveryEstimate || settings.deliveryEstimate };
  }

  const amount = subtotal >= settings.freeShippingThreshold ? 0 : round2(settings.standardShippingAmount);
  return { amount, deliveryEstimate: settings.deliveryEstimate };
}

// Server-authoritative COD eligibility. Every reason for rejection is
// checked here so the client can never smuggle a COD order past any of
// these rules by tampering with the request.
export async function checkCodEligibility({ items, totalAmount, state, postalCode }) {
  const settings = await getShippingSettings();

  if (!settings.codEnabled) {
    return { eligible: false, reason: "Cash on Delivery is currently disabled." };
  }

  const hasDigitalItem = (items || []).some((i) => i.isDigital);
  if (hasDigitalItem) {
    return { eligible: false, reason: "Cash on Delivery is not available for digital items." };
  }

  const min = Number(settings.codMinOrderValue ?? 0);
  const max = Number(settings.codMaxOrderValue ?? Infinity);
  if (totalAmount < min) {
    return { eligible: false, reason: `Cash on Delivery requires a minimum order value of ₹${min}.` };
  }
  if (totalAmount > max) {
    return { eligible: false, reason: `Cash on Delivery is not available for orders above ₹${max}.` };
  }

  const zone = await findZoneForAddress({ state, postalCode });
  if (!zone) {
    return { eligible: false, reason: "Cash on Delivery is not available for this delivery address." };
  }
  if (!zone.codSupported) {
    return { eligible: false, reason: "Cash on Delivery is not available in your shipping zone." };
  }

  return { eligible: true, zone, codFee: round2(Number(settings.codFee ?? 0)) };
}

export async function assertCodEligible(args) {
  const result = await checkCodEligibility(args);
  if (!result.eligible) throw ApiError.badRequest(result.reason);
  return result;
}

// --- Admin zone/rate management -------------------------------------------

export async function listZones() {
  return prisma.shippingZone.findMany({ include: { rates: true }, orderBy: { createdAt: "asc" } });
}

export async function createZone({ name, states, postalCodes, codSupported, active }) {
  return prisma.shippingZone.create({
    data: {
      name,
      states: states || [],
      postalCodes: postalCodes || [],
      codSupported: codSupported ?? true,
      active: active ?? true,
    },
  });
}

export async function updateZone(id, data) {
  const zone = await prisma.shippingZone.findUnique({ where: { id } });
  if (!zone) throw ApiError.notFound("Shipping zone not found");
  return prisma.shippingZone.update({ where: { id }, data });
}

export async function deleteZone(id) {
  const zone = await prisma.shippingZone.findUnique({ where: { id } });
  if (!zone) throw ApiError.notFound("Shipping zone not found");
  await prisma.shippingZone.delete({ where: { id } });
  return { success: true };
}

export async function createRate(zoneId, { rate, freeAbove, deliveryEstimate, active }) {
  const zone = await prisma.shippingZone.findUnique({ where: { id: zoneId } });
  if (!zone) throw ApiError.notFound("Shipping zone not found");
  return prisma.shippingRate.create({
    data: { zoneId, rate, freeAbove: freeAbove ?? null, deliveryEstimate: deliveryEstimate ?? null, active: active ?? true },
  });
}

export async function updateRate(id, data) {
  const rate = await prisma.shippingRate.findUnique({ where: { id } });
  if (!rate) throw ApiError.notFound("Shipping rate not found");
  return prisma.shippingRate.update({ where: { id }, data });
}

export async function deleteRate(id) {
  const rate = await prisma.shippingRate.findUnique({ where: { id } });
  if (!rate) throw ApiError.notFound("Shipping rate not found");
  await prisma.shippingRate.delete({ where: { id } });
  return { success: true };
}
