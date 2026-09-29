import { prisma } from "../../lib/prisma.js";
import { createAdminNotification } from "../admin-notifications/admin-notification.service.js";

const GLOBAL_THRESHOLD_KEY = "lowStockThreshold";
const DEFAULT_GLOBAL_THRESHOLD = 5;

export async function getGlobalLowStockThreshold() {
  const row = await prisma.siteSetting.findUnique({ where: { key: GLOBAL_THRESHOLD_KEY } });
  const value = row?.value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object" && typeof value.threshold === "number") return value.threshold;
  return DEFAULT_GLOBAL_THRESHOLD;
}

export async function setGlobalLowStockThreshold(threshold) {
  const value = Math.max(0, Math.trunc(threshold));
  await prisma.siteSetting.upsert({
    where: { key: GLOBAL_THRESHOLD_KEY },
    create: { key: GLOBAL_THRESHOLD_KEY, value },
    update: { value },
  });
  return value;
}

function statusFor(stock, threshold) {
  if (stock <= 0) return "OUT";
  if (stock <= threshold) return "LOW";
  return "OK";
}

// Returns the full low-stock/out-of-stock/ok view for products + variants,
// resolving each row's effective threshold: per-variant override ->
// product.lowStockThreshold -> global SiteSetting threshold.
export async function getLowStockOverview() {
  const globalThreshold = await getGlobalLowStockThreshold();

  const products = await prisma.product.findMany({
    where: { trackInventory: true, isActive: true },
    select: {
      id: true,
      name: true,
      sku: true,
      stockQuantity: true,
      lowStockThreshold: true,
      lowStockNotifiedAt: true,
      variants: {
        where: { isActive: true },
        select: { id: true, name: true, sku: true, stockQuantity: true, lowStockThreshold: true, lowStockNotifiedAt: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = [];
  for (const product of products) {
    if (product.variants.length > 0) {
      for (const variant of product.variants) {
        const threshold = variant.lowStockThreshold ?? product.lowStockThreshold ?? globalThreshold;
        rows.push({
          productId: product.id,
          variantId: variant.id,
          name: `${product.name} — ${variant.name}`,
          sku: variant.sku,
          stockQuantity: variant.stockQuantity,
          threshold,
          status: statusFor(variant.stockQuantity, threshold),
        });
      }
    } else {
      const threshold = product.lowStockThreshold ?? globalThreshold;
      rows.push({
        productId: product.id,
        variantId: null,
        name: product.name,
        sku: product.sku,
        stockQuantity: product.stockQuantity,
        threshold,
        status: statusFor(product.stockQuantity, threshold),
      });
    }
  }

  return rows.filter((r) => r.status !== "OK");
}

// Checks a single product/variant's stock against its effective threshold
// and creates a deduplicated AdminNotification when it crosses below.
// Dedup rule: only notify once per "below threshold" episode — tracked via
// lowStockNotifiedAt, which is cleared once stock recovers above threshold.
export async function checkAndNotifyLowStock({ productId, variantId }) {
  const globalThreshold = await getGlobalLowStockThreshold();

  if (variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { id: true, name: true, lowStockThreshold: true, trackInventory: true } } },
    });
    if (!variant || !variant.product.trackInventory) return null;
    const threshold = variant.lowStockThreshold ?? variant.product.lowStockThreshold ?? globalThreshold;
    return applyThresholdCheck({
      stock: variant.stockQuantity,
      threshold,
      alreadyNotified: !!variant.lowStockNotifiedAt,
      entityType: "ProductVariant",
      entityId: variant.id,
      label: `${variant.product.name} — ${variant.name}`,
      clearOrSet: async (notifiedAt) =>
        prisma.productVariant.update({ where: { id: variant.id }, data: { lowStockNotifiedAt: notifiedAt } }),
    });
  }

  if (productId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.trackInventory) return null;
    const threshold = product.lowStockThreshold ?? globalThreshold;
    return applyThresholdCheck({
      stock: product.stockQuantity,
      threshold,
      alreadyNotified: !!product.lowStockNotifiedAt,
      entityType: "Product",
      entityId: product.id,
      label: product.name,
      clearOrSet: async (notifiedAt) =>
        prisma.product.update({ where: { id: product.id }, data: { lowStockNotifiedAt: notifiedAt } }),
    });
  }

  return null;
}

async function applyThresholdCheck({ stock, threshold, alreadyNotified, entityType, entityId, label, clearOrSet }) {
  const isBelow = stock <= threshold;

  if (!isBelow) {
    if (alreadyNotified) await clearOrSet(null); // recovered — re-arm for next episode
    return null;
  }

  if (alreadyNotified) return null; // already notified for this episode — dedupe

  const type = stock <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK";
  const severity = stock <= 0 ? "CRITICAL" : "WARNING";
  const notification = await createAdminNotification({
    type,
    severity,
    title: stock <= 0 ? `Out of stock: ${label}` : `Low stock: ${label}`,
    message:
      stock <= 0
        ? `${label} is out of stock (0 units remaining).`
        : `${label} has ${stock} unit(s) left, at or below the threshold of ${threshold}.`,
    entityType,
    entityId,
  });

  await clearOrSet(new Date());
  return notification;
}

// Runs the low-stock check across all active, tracked products/variants.
// Intended for a scheduled job or manual "recheck" admin action.
export async function runLowStockSweep() {
  const globalThreshold = await getGlobalLowStockThreshold();
  const products = await prisma.product.findMany({
    where: { trackInventory: true, isActive: true },
    select: { id: true, variants: { where: { isActive: true }, select: { id: true } } },
  });

  const notifications = [];
  for (const product of products) {
    if (product.variants.length > 0) {
      for (const variant of product.variants) {
        const n = await checkAndNotifyLowStock({ variantId: variant.id });
        if (n) notifications.push(n);
      }
    } else {
      const n = await checkAndNotifyLowStock({ productId: product.id });
      if (n) notifications.push(n);
    }
  }
  return { checked: products.length, notified: notifications.length, notifications, globalThreshold };
}

// Restock action — wires into the existing stockQuantity update path (no
// second inventory system). Re-checks thresholds afterward so a recovering
// item is re-armed for the next low-stock episode.
export async function restock({ productId, variantId, quantity }) {
  if (!quantity || quantity <= 0) throw new Error("Restock quantity must be positive.");

  if (variantId) {
    await prisma.productVariant.update({
      where: { id: variantId },
      data: { stockQuantity: { increment: quantity } },
    });
    await checkAndNotifyLowStock({ variantId });
    return prisma.productVariant.findUnique({ where: { id: variantId } });
  }

  if (productId) {
    await prisma.product.update({
      where: { id: productId },
      data: { stockQuantity: { increment: quantity } },
    });
    await checkAndNotifyLowStock({ productId });
    return prisma.product.findUnique({ where: { id: productId } });
  }

  throw new Error("restock requires productId or variantId.");
}
