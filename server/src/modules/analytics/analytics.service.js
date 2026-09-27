import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { ALL_EVENT_TYPES, CLIENT_EVENT_TYPES } from "./analytics.validators.js";

// Single write path for every AnalyticsEvent row. `type` is always checked
// against the allowlist here too (defense in depth beyond the zod schema at
// the HTTP boundary) so nothing outside this module can slip an arbitrary
// event type into the table.
export async function recordEvent(input) {
  if (!ALL_EVENT_TYPES.includes(input.type)) {
    throw ApiError.badRequest(`Unknown analytics event type: ${input.type}`);
  }
  return prisma.analyticsEvent.create({
    data: {
      type: input.type,
      customerId: input.customerId || null,
      sessionId: input.sessionId || null,
      productId: input.productId || null,
      categoryId: input.categoryId || null,
      collectionId: input.collectionId || null,
      orderId: input.orderId || null,
      metadata: input.metadata ?? undefined,
      utmSource: input.utmSource || null,
      utmMedium: input.utmMedium || null,
      utmCampaign: input.utmCampaign || null,
      utmContent: input.utmContent || null,
      utmTerm: input.utmTerm || null,
    },
  });
}

// Public, client-submittable events only — never accepts `purchase`.
export async function recordClientEvent(input) {
  if (!CLIENT_EVENT_TYPES.includes(input.type)) {
    throw ApiError.badRequest(`Event type "${input.type}" cannot be recorded from the client.`);
  }
  return recordEvent(input);
}

// Server-authoritative purchase event. Only ever called from the payment
// confirmation flow (payment.service.js#finalizePaidPayment), never from a
// client-facing route.
export async function recordPurchaseEvent(order) {
  return recordEvent({
    type: "purchase",
    customerId: order.customerId || null,
    orderId: order.id,
    utmSource: order.utmSource,
    utmMedium: order.utmMedium,
    utmCampaign: order.utmCampaign,
    utmContent: order.utmContent,
    utmTerm: order.utmTerm,
    metadata: { orderNumber: order.orderNumber, totalAmount: Number(order.totalAmount) },
  });
}

export function resolveDateRange({ range, from, to }) {
  const now = new Date();
  if (range === "custom" && from && to) return { from, to };
  const end = to || now;
  let start = from;
  if (!start) {
    start = new Date(end);
    if (range === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (range === "7d") {
      start.setDate(start.getDate() - 7);
    } else if (range === "90d") {
      start.setDate(start.getDate() - 90);
    } else {
      start.setDate(start.getDate() - 30);
    }
  }
  return { from: start, to: end };
}

// --- Admin aggregation queries. All use Prisma aggregate/groupBy so a
// dashboard load is a handful of queries, never N+1 over orders/products. ---

export async function getRevenueOverview({ from, to }) {
  const paidWhere = { paymentStatus: "PAID", paidAt: { gte: from, lte: to } };

  const [revenueAgg, customerCountAgg, prevCompare] = await Promise.all([
    prisma.order.aggregate({ where: paidWhere, _sum: { totalAmount: true }, _count: { _all: true } }),
    prisma.order.findMany({ where: paidWhere, distinct: ["customerEmail"], select: { customerEmail: true } }),
    getPreviousPeriodRevenue({ from, to }),
  ]);

  const revenue = Number(revenueAgg._sum.totalAmount || 0);
  const orderCount = revenueAgg._count._all;
  const aov = orderCount > 0 ? revenue / orderCount : 0;

  return {
    revenue,
    orderCount,
    aov,
    customerCount: customerCountAgg.length,
    previousRevenue: prevCompare,
  };
}

async function getPreviousPeriodRevenue({ from, to }) {
  const durationMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - durationMs);
  const prevTo = new Date(from.getTime());
  const agg = await prisma.order.aggregate({
    where: { paymentStatus: "PAID", paidAt: { gte: prevFrom, lt: prevTo } },
    _sum: { totalAmount: true },
  });
  return Number(agg._sum.totalAmount || 0);
}

// Top sellers by paid OrderItem quantity/revenue within the range.
export async function getProductPerformance({ from, to }, limit = 10) {
  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { productId: { not: null }, order: { paymentStatus: "PAID", paidAt: { gte: from, lte: to } } },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { lineTotal: "desc" } },
    take: limit,
  });

  const productIds = grouped.map((g) => g.productId).filter(Boolean);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, slug: true, stockQuantity: true, trackInventory: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  return grouped.map((g) => ({
    productId: g.productId,
    product: byId.get(g.productId) || null,
    unitsSold: g._sum.quantity || 0,
    revenue: Number(g._sum.lineTotal || 0),
  }));
}

// Category performance: join OrderItem -> Product -> Category via two
// queries (no N+1): one groupBy for per-product totals, one lookup of
// productId -> categoryId, aggregated in memory.
export async function getCategoryPerformance({ from, to }, limit = 10) {
  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { productId: { not: null }, order: { paymentStatus: "PAID", paidAt: { gte: from, lte: to } } },
    _sum: { quantity: true, lineTotal: true },
  });
  if (grouped.length === 0) return [];

  const productIds = grouped.map((g) => g.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, categoryId: true, category: { select: { id: true, name: true, slug: true } } },
  });
  const productToCategory = new Map(products.map((p) => [p.id, p.category]));

  const byCategory = new Map();
  for (const g of grouped) {
    const category = productToCategory.get(g.productId);
    if (!category) continue;
    const entry = byCategory.get(category.id) || { category, unitsSold: 0, revenue: 0 };
    entry.unitsSold += g._sum.quantity || 0;
    entry.revenue += Number(g._sum.lineTotal || 0);
    byCategory.set(category.id, entry);
  }

  return [...byCategory.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

// Collection performance: same shape, via CollectionProduct join table.
export async function getCollectionPerformance({ from, to }, limit = 10) {
  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { productId: { not: null }, order: { paymentStatus: "PAID", paidAt: { gte: from, lte: to } } },
    _sum: { quantity: true, lineTotal: true },
  });
  if (grouped.length === 0) return [];

  const productIds = grouped.map((g) => g.productId);
  const links = await prisma.collectionProduct.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true, collection: { select: { id: true, title: true, slug: true } } },
  });
  const productToCollections = new Map();
  for (const link of links) {
    const list = productToCollections.get(link.productId) || [];
    list.push(link.collection);
    productToCollections.set(link.productId, list);
  }

  const byCollection = new Map();
  for (const g of grouped) {
    const collections = productToCollections.get(g.productId) || [];
    for (const collection of collections) {
      const entry = byCollection.get(collection.id) || { collection, unitsSold: 0, revenue: 0 };
      entry.unitsSold += g._sum.quantity || 0;
      entry.revenue += Number(g._sum.lineTotal || 0);
      byCollection.set(collection.id, entry);
    }
  }

  return [...byCollection.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export async function getCouponAnalytics({ from, to }, limit = 10) {
  const grouped = await prisma.couponRedemption.groupBy({
    by: ["couponId"],
    where: { createdAt: { gte: from, lte: to } },
    _sum: { discountAmount: true },
    _count: { _all: true },
    orderBy: { _sum: { discountAmount: "desc" } },
    take: limit,
  });

  const couponIds = grouped.map((g) => g.couponId);
  const coupons = await prisma.coupon.findMany({ where: { id: { in: couponIds } } });
  const byId = new Map(coupons.map((c) => [c.id, c]));

  return grouped.map((g) => ({
    coupon: byId.get(g.couponId)
      ? { id: byId.get(g.couponId).id, code: byId.get(g.couponId).code, discountType: byId.get(g.couponId).discountType, value: Number(byId.get(g.couponId).value) }
      : null,
    redemptions: g._count._all,
    totalDiscount: Number(g._sum.discountAmount || 0),
  }));
}

export async function getInventoryInsights() {
  const [lowStock, outOfStock] = await Promise.all([
    prisma.product.findMany({
      where: { trackInventory: true, isActive: true, stockQuantity: { gt: 0 } },
      select: { id: true, name: true, slug: true, stockQuantity: true, lowStockThreshold: true },
    }).then((rows) => rows.filter((p) => p.stockQuantity <= p.lowStockThreshold)),
    prisma.product.findMany({
      where: { trackInventory: true, isActive: true, stockQuantity: { lte: 0 } },
      select: { id: true, name: true, slug: true, stockQuantity: true },
    }),
  ]);

  return { lowStock, outOfStock, lowStockCount: lowStock.length, outOfStockCount: outOfStock.length };
}

export async function getAnalyticsOverview(range) {
  const [revenue, products, categories, collections, coupons, inventory] = await Promise.all([
    getRevenueOverview(range),
    getProductPerformance(range),
    getCategoryPerformance(range),
    getCollectionPerformance(range),
    getCouponAnalytics(range),
    getInventoryInsights(),
  ]);

  return { range: { from: range.from, to: range.to }, revenue, products, categories, collections, coupons, inventory };
}

export async function getSearchAnalytics({ from, to }, limit = 20) {
  const rows = await prisma.analyticsEvent.findMany({
    where: { type: "search", createdAt: { gte: from, lte: to } },
    select: { metadata: true },
    take: 2000,
    orderBy: { createdAt: "desc" },
  });

  const byQuery = new Map();
  for (const row of rows) {
    const q = (row.metadata?.query || "").toString().trim().toLowerCase();
    if (!q) continue;
    const entry = byQuery.get(q) || { query: q, count: 0, totalResults: 0 };
    entry.count += 1;
    entry.totalResults += Number(row.metadata?.resultCount || 0);
    byQuery.set(q, entry);
  }

  return [...byQuery.values()]
    .map((e) => ({ ...e, avgResults: e.count ? e.totalResults / e.count : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
