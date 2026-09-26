import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { round2 } from "../../utils/money.js";
import { ApiError } from "../../utils/ApiError.js";

// The one place cart items become priced, authoritative line items. Both
// POST /api/checkout/preview and POST /api/orders call this — an order can
// never be created from anything other than this exact recalculation, so a
// tampered client-side price/subtotal/total is simply never read.
export async function priceCartItems(requestedItems) {
  const slugs = requestedItems.map((i) => i.slug);
  const products = await prisma.product.findMany({
    where: { slug: { in: slugs } },
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, variants: { where: { isActive: true } } },
  });
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  const priced = requestedItems.map((requested) => {
    const product = bySlug.get(requested.slug);

    if (!product || !product.isActive) {
      return {
        slug: requested.slug,
        ok: false,
        issue: "unavailable",
        message: `"${requested.slug}" is no longer available.`,
        requestedQuantity: requested.quantity,
      };
    }

    const variant = requested.variantId ? product.variants.find((v) => v.id === requested.variantId) : null;
    if (requested.variantId && !variant) return { slug: requested.slug, variantId: requested.variantId, ok: false, issue: "invalid_variant", message: "Selected variant is unavailable.", requestedQuantity: requested.quantity };
    if (!requested.variantId && product.variants.length) return { slug: requested.slug, ok: false, issue: "variant_required", message: "Select a variant for this product.", requestedQuantity: requested.quantity };
    const available = variant ? variant.stockQuantity : (product.trackInventory ? product.stockQuantity : Infinity);
    if (available <= 0) {
      return {
        slug: requested.slug,
        ok: false,
        issue: "out_of_stock",
        message: `"${product.name}" is out of stock.`,
        requestedQuantity: requested.quantity,
        product: summarizeProduct(product),
      };
    }

    const quantity = Math.min(requested.quantity, available);
    const quantityAdjusted = quantity !== requested.quantity;
    const unitPrice = round2(variant?.priceOverride ?? product.salePrice ?? product.price);

    return {
      slug: product.slug,
      ok: true,
      issue: quantityAdjusted ? "stock_limited" : null,
      message: quantityAdjusted
        ? `Only ${available} unit${available === 1 ? "" : "s"} of "${product.name}" are available — quantity was adjusted.`
        : null,
      product: summarizeProduct(product),
      productId: product.id,
      variantId: variant?.id ?? null,
      variant: variant ? { id: variant.id, name: variant.name, sku: variant.sku, attributes: variant.attributes } : null,
      productType: product.productType,
      unitPrice,
      requestedQuantity: requested.quantity,
      quantity,
      lineTotal: round2(unitPrice * quantity),
      stockQuantity: Number.isFinite(available) ? available : null,
      trackInventory: variant ? true : product.trackInventory,
    };
  });

  return priced;
}

function summarizeProduct(product) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    sku: product.sku,
    image: product.images?.[0]?.url ?? null,
  };
}

export async function getShippingConfig() {
  try {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: ["shipping", "freeShippingThreshold", "standardShippingAmount"] } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const shippingGroup = map.shipping || {};

    const freeThreshold =
      typeof shippingGroup.freeShippingThreshold === "number"
        ? shippingGroup.freeShippingThreshold
        : typeof map.freeShippingThreshold === "number"
        ? map.freeShippingThreshold
        : env.shipping.freeThreshold;

    const standardAmount =
      typeof shippingGroup.standardShippingAmount === "number"
        ? shippingGroup.standardShippingAmount
        : typeof map.standardShippingAmount === "number"
        ? map.standardShippingAmount
        : env.shipping.standardAmount;

    const shippingEnabled = shippingGroup.shippingEnabled ?? true;

    return { freeThreshold, standardAmount, shippingEnabled };
  } catch {
    return {
      freeThreshold: env.shipping.freeThreshold,
      standardAmount: env.shipping.standardAmount,
      shippingEnabled: true,
    };
  }
}

export function computeShipping(subtotal, shippingConfig = null) {
  if (subtotal <= 0) return 0;
  const freeThreshold = shippingConfig?.freeThreshold ?? env.shipping.freeThreshold;
  const standardAmount = shippingConfig?.standardAmount ?? env.shipping.standardAmount;
  return subtotal >= freeThreshold ? 0 : standardAmount;
}

export async function computeTotals(pricedItems, couponDiscount = 0) {
  const validItems = pricedItems.filter((i) => i.ok);
  const subtotal = round2(validItems.reduce((sum, i) => sum + i.lineTotal, 0));
  const shippingConfig = await getShippingConfig();
  const shipping = round2(computeShipping(subtotal, shippingConfig));
  const tax = 0;
  const discount = round2(couponDiscount);
  const total = round2(Math.max(0, subtotal + shipping + tax - discount));
  return { subtotal, shipping, tax, discount, total, currency: "INR" };
}

export async function buildCheckoutPreview(requestedItems, { couponCode, customerId, customerEmail } = {}) {
  const pricedItems = await priceCartItems(requestedItems);
  let couponResult = null;
  let couponDiscount = 0;

  if (couponCode) {
    try {
      const { validateCoupon } = await import("../coupons/coupon.service.js");
      couponResult = await validateCoupon({
        code: couponCode,
        customerId,
        customerEmail,
        items: requestedItems,
      });
      couponDiscount = couponResult.discountAmount;
    } catch (err) {
      couponResult = { error: err.message };
    }
  }

  const totals = await computeTotals(pricedItems, couponDiscount);
  const hasBlockingIssues = pricedItems.some((i) => !i.ok);
  return { items: pricedItems, hasBlockingIssues, coupon: couponResult, ...totals };
}

// Used by order creation — same pricing, but throws on any invalid item
// instead of returning it as a soft "issue" for the UI to render.
export async function priceCartItemsOrThrow(requestedItems) {
  const pricedItems = await priceCartItems(requestedItems);
  const blocking = pricedItems.filter((i) => !i.ok);
  if (blocking.length > 0) {
    throw ApiError.badRequest("Some items in your cart are no longer available.", { items: pricedItems });
  }
  return pricedItems;
}
