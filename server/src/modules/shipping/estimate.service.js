// Public delivery estimate. Never exposes courier names, rates, ids or provider payloads.
import { prisma } from "../../lib/prisma.js";
import { getShippingProvider } from "./provider.service.js";
import { isShiprocketConfigured } from "./fulfilment-state.js";
import { resolveItemShipping, suggestPackage, toShiprocketPackage } from "./package-calc.js";

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 2; // Shiprocket's etd is a point estimate; show a small window.
const DEFAULT_WEIGHT_KG = 0.5;
const OK_TTL_MS = 3 * 60 * 60 * 1000;
const BAD_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 2000;
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

const UNKNOWN = { serviceable: null, estimatedDelivery: null, days: null, codAvailable: null };

// Calendar dates are handled as 'YYYY-MM-DD' strings via UTC midnight to avoid DST/timezone drift.
const toDayNumber = (s) => Math.round(Date.parse(`${s}T00:00:00Z`) / DAY_MS);
const fromDayNumber = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);

export function todayInStoreZone(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// 'Nov 04, 2026' (Shiprocket) or ISO 'YYYY-MM-DD[...]' -> 'YYYY-MM-DD' or null.
export function parseEtd(etd) {
  if (!etd || typeof etd !== "string") return null;
  const s = etd.trim();
  let y, m, d;
  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (match) { y = +match[1]; m = +match[2] - 1; d = +match[3]; }
  else if ((match = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s)) && match[1].toLowerCase() in MONTHS) { m = MONTHS[match[1].toLowerCase()]; d = +match[2]; y = +match[3]; }
  else if ((match = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})$/.exec(s)) && match[2].toLowerCase() in MONTHS) { d = +match[1]; m = MONTHS[match[2].toLowerCase()]; y = +match[3]; }
  else return null;
  const dt = new Date(Date.UTC(y, m, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** Cheapest courier with rate > 0; ties go to the earlier delivery. Optionally only COD-capable couriers. */
export function pickCheapest(couriers, { cod = false } = {}) {
  const days = (c) => {
    const parsed = parseEtd(c.etd);
    if (parsed) return toDayNumber(parsed);
    const n = c.estimatedDeliveryDays == null || c.estimatedDeliveryDays === "" ? NaN : Number(c.estimatedDeliveryDays);
    return Number.isFinite(n) ? n : Infinity; // different scales, but only ever compared within one lookup
  };
  const candidates = (Array.isArray(couriers) ? couriers : []).filter((c) => Number(c?.rate) > 0 && (!cod || c.cod === true));
  if (!candidates.length) return null;
  return candidates.reduce((best, c) => (Number(c.rate) < Number(best.rate) || (Number(c.rate) === Number(best.rate) && days(c) < days(best)) ? c : best));
}

/** earliest = base + buffer, latest = earliest + 2 days; days = whole days from today. */
export function computeWindow({ etd, estimatedDeliveryDays, today, bufferDays = 1 }) {
  const t = toDayNumber(today);
  let base = parseEtd(etd) ? toDayNumber(parseEtd(etd)) : null;
  if (base == null) {
    const n = estimatedDeliveryDays == null || estimatedDeliveryDays === "" ? NaN : Number(estimatedDeliveryDays);
    if (!Number.isFinite(n) || n < 0) return null;
    base = t + Math.round(n);
  }
  const buffer = Number.isFinite(Number(bufferDays)) && Number(bufferDays) >= 0 ? Math.round(Number(bufferDays)) : 1;
  const earliest = Math.max(base + buffer, t);
  const latest = earliest + WINDOW_DAYS;
  return {
    estimatedDelivery: { earliest: fromDayNumber(earliest), latest: fromDayNumber(latest) },
    days: { min: earliest - t, max: latest - t },
  };
}

// ---- cache ----
const cache = new Map();
export function clearEstimateCache() { cache.clear(); }
function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) { cache.delete(key); return null; }
  return hit.value;
}
function cacheSet(key, value, ttl) {
  cache.delete(key);
  while (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value); // oldest first
  cache.set(key, { value, expires: Date.now() + ttl });
}

async function resolvePackage(items, settings) {
  const tareGrams = Number.isInteger(settings.packagingTareGrams) ? settings.packagingTareGrams : 0;
  const fallbackKg = Number(settings.packageDefaults?.weight) > 0 ? Number(settings.packageDefaults.weight) : DEFAULT_WEIGHT_KG;
  const out = { weight: fallbackKg };
  if (!Array.isArray(items) || !items.length) return out;

  const slugs = [...new Set(items.map((i) => i.slug))];
  const select = { id: true, slug: true, name: true, shipWeightGrams: true, shipLengthMm: true, shipWidthMm: true, shipHeightMm: true };
  const products = await prisma.product.findMany({ where: { slug: { in: slugs }, isActive: true, productType: "PHYSICAL" }, select });
  const P = new Map(products.map((p) => [p.slug, p]));
  const variantIds = [...new Set(items.map((i) => i.variantId).filter(Boolean))];
  const variants = variantIds.length ? await prisma.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, productId: true, shipWeightGrams: true, shipLengthMm: true, shipWidthMm: true, shipHeightMm: true } }) : [];
  const V = new Map(variants.map((v) => [v.id, v]));

  const lines = [];
  for (const item of items) {
    const product = P.get(item.slug);
    if (!product) continue; // unknown, inactive or digital: ignored
    const variant = item.variantId ? V.get(item.variantId) : null;
    lines.push({ key: `${item.slug}:${item.variantId || ""}`, name: product.name, quantity: item.quantity, shipping: resolveItemShipping({ variant: variant?.productId === product.id ? variant : null, product }) });
  }
  if (!lines.length) return out;

  const s = suggestPackage(lines, { tareGrams });
  if (s.weightGrams != null) out.weight = Number((s.weightGrams / 1000).toFixed(3));
  if (s.lengthMm != null && s.widthMm != null && s.heightMm != null) {
    const sr = toShiprocketPackage(s);
    Object.assign(out, { length: sr.length, breadth: sr.breadth, height: sr.height });
  }
  return out;
}

const weightBucket = (kg) => Math.max(1, Math.ceil(kg / 0.5 - 1e-9));

export async function estimateDelivery({ pincode, items, cod = false }, { now = new Date() } = {}) {
  const row = await prisma.siteSetting.findUnique({ where: { key: "shippingBusiness" } });
  const settings = row?.value || {};
  const pickup = String(settings.pickup?.postalCode || "").trim();
  if (settings.provider !== "SHIPROCKET" || !/^\d{6}$/.test(pickup) || !(await isShiprocketConfigured())) return { ...UNKNOWN };

  try {
    const pkg = await resolvePackage(items, settings);
    const key = `${pickup}|${pincode}|${weightBucket(pkg.weight)}|${cod ? 1 : 0}`;
    const cached = cacheGet(key);
    if (cached) return cached;

    let result;
    let ttl = OK_TTL_MS;
    try {
      const lookup = await getShippingProvider("SHIPROCKET").getServiceability({ pickupPostcode: pickup, deliveryPostcode: pincode, package: pkg, cod: false, settings });
      const couriers = lookup?.couriers || [];
      const codAvailable = couriers.some((c) => c.cod === true);
      const chosen = pickCheapest(couriers, { cod });
      const window = chosen && computeWindow({ etd: chosen.etd, estimatedDeliveryDays: chosen.estimatedDeliveryDays, today: todayInStoreZone(now), bufferDays: settings.dispatchBufferDays ?? 1 });
      if (chosen && window) result = { serviceable: true, ...window, codAvailable };
      else {
        ttl = BAD_TTL_MS;
        result = { serviceable: false, estimatedDelivery: null, days: null, codAvailable, message: cod && couriers.length && !codAvailable ? "Cash on delivery is not available for this pincode." : "We can't deliver to this pincode yet." };
      }
    } catch {
      ttl = BAD_TTL_MS;
      result = { ...UNKNOWN, message: "Delivery estimate is unavailable right now." };
    }
    cacheSet(key, result, ttl);
    return result;
  } catch {
    return { ...UNKNOWN, message: "Delivery estimate is unavailable right now." };
  }
}
