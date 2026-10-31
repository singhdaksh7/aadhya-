import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { getShippingProvider } from "./provider.service.js";
import { resolveItemShipping, suggestPackage, validatePackage, classifyConfirmation, volumetricWeightGrams, toShiprocketPackage, DEFAULT_VOLUMETRIC_DIVISOR } from "./package-calc.js";

const mmToCm = (mm) => (mm == null ? null : Number((mm / 10).toFixed(1)));
const cmToMm = (cm) => Math.round(Number(cm) * 10);
const gToKg = (g) => (g == null ? null : Number((g / 1000).toFixed(3)));
const kgToG = (kg) => Math.round(Number(kg) * 1000);

export async function getShippingSettings() {
  const row = await prisma.siteSetting.findUnique({ where: { key: "shippingBusiness" } });
  return row?.value || {};
}

// Admin-facing view (kg / cm) of a canonical (g / mm) package.
export const packageView = (p) => p && ({ weightKg: gToKg(p.weightGrams), lengthCm: mmToCm(p.lengthMm), widthCm: mmToCm(p.widthMm), heightCm: mmToCm(p.heightMm) });

async function loadOrder(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, address: true, shipment: true, shipmentPackage: true } });
  if (!order) throw ApiError.notFound("Order not found");
  return order;
}

async function buildLines(order) {
  const physical = order.items.filter((i) => i.bookFormatSnapshot !== "PDF");
  const productIds = [...new Set(physical.map((i) => i.productId).filter(Boolean))];
  const variantIds = [...new Set(physical.map((i) => i.variantId).filter(Boolean))];
  const [products, variants, formats] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, shipWeightGrams: true, shipLengthMm: true, shipWidthMm: true, shipHeightMm: true } }),
    prisma.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, shipWeightGrams: true, shipLengthMm: true, shipWidthMm: true, shipHeightMm: true } }),
    prisma.bookFormatOption.findMany({ where: { productId: { in: productIds } }, select: { productId: true, format: true, weightGrams: true } }),
  ]);
  const P = new Map(products.map((p) => [p.id, p])), V = new Map(variants.map((v) => [v.id, v]));
  return physical.map((item) => {
    const bookFormat = item.bookFormatSnapshot ? formats.find((f) => f.productId === item.productId && f.format === item.bookFormatSnapshot) : null;
    const shipping = resolveItemShipping({ variant: V.get(item.variantId), product: P.get(item.productId), bookFormat });
    return { key: item.id, name: item.variantNameSnapshot ? `${item.productNameSnapshot} (${item.variantNameSnapshot})` : item.productNameSnapshot, quantity: item.quantity, shipping };
  });
}

export async function getOrderPackageContext(orderId) {
  const order = await loadOrder(orderId);
  const settings = await getShippingSettings();
  const tareGrams = Number.isInteger(settings.packagingTareGrams) ? settings.packagingTareGrams : 0;
  const divisor = Number(settings.volumetricDivisor) > 0 ? Number(settings.volumetricDivisor) : DEFAULT_VOLUMETRIC_DIVISOR;
  const lines = await buildLines(order);
  const suggestion = suggestPackage(lines, { tareGrams });
  const presets = await prisma.packagePreset.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const saved = order.shipmentPackage;
  const withVol = (p) => p && p.lengthMm ? { ...packageView(p), volumetricWeightKg: gToKg(volumetricWeightGrams(p, divisor)) } : p && packageView(p);
  return {
    orderId,
    provider: settings.provider || "MANUAL",
    cod: order.paymentMethod === "cod",
    packagingTareGrams: tareGrams,
    volumetricDivisor: divisor,
    volumetricNote: "Volumetric weight is an estimate. The courier's chargeable weight (shown with each courier option) is what is billed.",
    items: lines.map((l) => ({ name: l.name, quantity: l.quantity, weightKg: gToKg(l.shipping.weightGrams), lengthCm: mmToCm(l.shipping.lengthMm), widthCm: mmToCm(l.shipping.widthMm), heightCm: mmToCm(l.shipping.heightMm), complete: l.shipping.complete })),
    suggestion: { ...suggestion, ...withVol(suggestion), weightKg: gToKg(suggestion.weightGrams), productWeightKg: gToKg(suggestion.productWeightGrams), tareKg: gToKg(suggestion.tareGrams) },
    confirmed: saved ? { ...withVol(saved), source: saved.source, presetName: saved.presetName, confirmedAt: saved.confirmedAt, confirmedBy: saved.confirmedBy, locked: !!saved.lockedAt } : null,
    presets: presets.map((p) => ({ id: p.id, name: p.name, lengthCm: mmToCm(p.lengthMm), widthCm: mmToCm(p.widthMm), heightCm: mmToCm(p.heightMm), tareKg: gToKg(p.tareGrams) })),
  };
}

export const confirmPackageSchema = z.object({
  weightKg: z.coerce.number().finite(),
  lengthCm: z.coerce.number().finite(),
  widthCm: z.coerce.number().finite(),
  heightCm: z.coerce.number().finite(),
  presetId: z.string().uuid().optional().nullable(),
});

export async function confirmOrderPackage(orderId, input, adminId = null) {
  const order = await loadOrder(orderId);
  if (order.shipmentPackage?.lockedAt) throw ApiError.badRequest("A shipment has already been created from this package. Cancel that shipment before changing the package.");
  const pkg = { weightGrams: kgToG(input.weightKg), lengthMm: cmToMm(input.lengthCm), widthMm: cmToMm(input.widthCm), heightMm: cmToMm(input.heightCm) };
  const errors = validatePackage(pkg);
  if (errors.length) throw ApiError.badRequest(errors.join(" "));
  const ctx = await getOrderPackageContext(orderId);
  const preset = input.presetId ? await prisma.packagePreset.findUnique({ where: { id: input.presetId } }) : null;
  const source = classifyConfirmation(pkg, ctx.suggestion);
  const itemsSnapshot = ctx.items;
  const data = { ...pkg, source, presetName: preset?.name || null, itemsSnapshot, confirmedAt: new Date(), confirmedBy: adminId };
  await prisma.orderShipmentPackage.upsert({ where: { orderId }, create: { orderId, ...data }, update: data });
  return getOrderPackageContext(orderId);
}

// The only way a provider shipment may obtain its package: the Admin-confirmed snapshot.
export async function requireConfirmedPackage(orderId) {
  const saved = await prisma.orderShipmentPackage.findUnique({ where: { orderId } });
  if (!saved) throw ApiError.badRequest("Confirm the package (weight and size) before creating a Shiprocket shipment.");
  const errors = validatePackage(saved);
  if (errors.length) throw ApiError.badRequest(`Confirmed package is invalid: ${errors.join(" ")}`);
  return saved;
}

export const lockOrderPackage = (orderId) => prisma.orderShipmentPackage.updateMany({ where: { orderId, lockedAt: null }, data: { lockedAt: new Date() } });
export const unlockOrderPackage = (orderId) => prisma.orderShipmentPackage.updateMany({ where: { orderId }, data: { lockedAt: null } });

export { toShiprocketPackage };

// Courier options for the confirmed package. Uses the snapshot, never live product data.
export async function checkOrderServiceability(orderId) {
  const order = await loadOrder(orderId);
  const settings = await getShippingSettings();
  const providerName = settings.provider || "MANUAL";
  if (providerName !== "SHIPROCKET") throw ApiError.badRequest("Courier serviceability requires the Shiprocket provider to be enabled in Shipping Settings.");
  const pkg = await requireConfirmedPackage(orderId);
  const pickupPostcode = String(settings.pickup?.postalCode || "").trim();
  const deliveryPostcode = String(order.address?.postalCode || "").trim();
  if (!/^\d{6}$/.test(pickupPostcode)) throw ApiError.badRequest("Set a valid 6-digit pickup postal code in Shipping Settings.");
  if (!/^\d{6}$/.test(deliveryPostcode)) throw ApiError.badRequest("The order's delivery postal code is not a valid 6-digit pincode.");
  const cod = order.paymentMethod === "cod";
  const result = await getShippingProvider("SHIPROCKET").getServiceability({ pickupPostcode, deliveryPostcode, package: toShiprocketPackage(pkg), cod, declaredValue: Number(order.totalAmount), settings });
  return { cod, pickupPostcode, deliveryPostcode, package: packageView(pkg), ...result, couriers: cod ? result.couriers.filter((c) => c.cod) : result.couriers };
}

export const presetSchema = z.object({
  name: z.string().trim().min(1).max(60),
  lengthCm: z.coerce.number().finite(), widthCm: z.coerce.number().finite(), heightCm: z.coerce.number().finite(),
  tareKg: z.coerce.number().finite().min(0).max(20).default(0),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});
function presetData(i) {
  const d = { name: i.name, lengthMm: cmToMm(i.lengthCm), widthMm: cmToMm(i.widthCm), heightMm: cmToMm(i.heightCm), tareGrams: kgToG(i.tareKg ?? 0) };
  const errors = validatePackage({ weightGrams: 1, ...d });
  if (errors.length) throw ApiError.badRequest(errors.join(" "));
  if (i.isActive !== undefined) d.isActive = i.isActive;
  if (i.sortOrder !== undefined) d.sortOrder = i.sortOrder;
  return d;
}
export const listPresets = () => prisma.packagePreset.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }).then((rows) => rows.map((p) => ({ id: p.id, name: p.name, lengthCm: mmToCm(p.lengthMm), widthCm: mmToCm(p.widthMm), heightCm: mmToCm(p.heightMm), tareKg: gToKg(p.tareGrams), isActive: p.isActive, sortOrder: p.sortOrder })));
export const createPreset = (i) => prisma.packagePreset.create({ data: presetData(i) });
export const updatePreset = (id, i) => prisma.packagePreset.update({ where: { id }, data: presetData(i) });
export const deletePreset = (id) => prisma.packagePreset.delete({ where: { id } });
