import { prisma } from "../../lib/prisma.js";

const EXPIRING_SOON_MS = 72 * 60 * 60 * 1000;

export function computeOfferStatus(coupon, now = new Date()) {
  if (coupon.validFrom && new Date(coupon.validFrom) > now) return "UPCOMING";
  if (coupon.validUntil) {
    const remaining = new Date(coupon.validUntil).getTime() - now.getTime();
    if (remaining <= EXPIRING_SOON_MS) return "EXPIRING_SOON";
  }
  return "ACTIVE";
}

async function applicabilitySummary(coupon) {
  const ids = (coupon.targets || []).map((t) => t.targetId).filter(Boolean);
  if (coupon.targetType === "ALL" || ids.length === 0) return "Applies to all products";
  if (coupon.targetType === "CATEGORY") {
    const rows = await prisma.category.findMany({ where: { id: { in: ids } }, select: { name: true } });
    return rows.length ? `Applies to ${rows.map((r) => r.name).join(", ")}` : "Applies to selected categories";
  }
  if (coupon.targetType === "COLLECTION") {
    const rows = await prisma.collection.findMany({ where: { id: { in: ids } }, select: { name: true } });
    return rows.length ? `Applies to the ${rows.map((r) => r.name).join(", ")} collection` : "Applies to selected collections";
  }
  if (coupon.targetType === "PRODUCT") {
    const rows = await prisma.product.findMany({ where: { id: { in: ids } }, select: { name: true } });
    return rows.length ? `Applies to ${rows.map((r) => r.name).join(", ")}` : "Applies to selected products";
  }
  return "Applies to all products";
}

/**
 * Customer-safe offers: only public + active coupons that are not expired and
 * not exhausted. Usage counts, limits, redemptions and internal notes
 * (description/name) are never exposed.
 */
export async function listPublicOffers(now = new Date()) {
  const coupons = await prisma.coupon.findMany({
    where: {
      isPublic: true,
      isActive: true,
      OR: [{ validUntil: null }, { validUntil: { gte: now } }],
    },
    include: { targets: true },
    orderBy: { createdAt: "desc" },
  });

  const live = coupons.filter((c) => !c.usageLimit || c.usageCount < c.usageLimit);
  return Promise.all(
    live.map(async (c) => ({
      code: c.code,
      title: c.displayTitle || c.name || c.code,
      discountType: c.discountType,
      value: Number(c.value),
      minimumOrderAmount: Number(c.minimumOrderAmount || 0),
      maximumDiscountAmount: c.maximumDiscountAmount != null ? Number(c.maximumDiscountAmount) : null,
      validFrom: c.validFrom,
      validUntil: c.validUntil,
      status: computeOfferStatus(c, now),
      applicability: await applicabilitySummary(c),
      terms: c.terms || null,
    }))
  );
}
