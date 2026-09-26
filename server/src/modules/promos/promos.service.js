import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";

const DEFAULT_SEED_PROMOS = [
  {
    title: "Welcome Discount",
    message: "Get ₹500 off on your first purchase above ₹2,999",
    couponCode: "AADYA500",
    ctaLabel: "Shop Now",
    ctaUrl: "/shop",
    isActive: true,
    sortOrder: 1,
  },
  {
    title: "Free Delivery Perk",
    message: "Free Standard Delivery on Orders > ₹2,499",
    couponCode: null,
    ctaLabel: null,
    ctaUrl: null,
    isActive: true,
    sortOrder: 2,
  },
  {
    title: "New Season Collection Drop",
    message: "New Season Handcrafted Objects & Unglazed Clays",
    couponCode: null,
    ctaLabel: "Explore Drop",
    ctaUrl: "/new-arrivals",
    isActive: true,
    sortOrder: 3,
  },
];

export async function ensureDefaultPromos() {
  const count = await prisma.promoMessage.count();
  if (count === 0) {
    await prisma.promoMessage.createMany({
      data: DEFAULT_SEED_PROMOS,
    });
  }
}

export async function listPublicPromos() {
  await ensureDefaultPromos();
  const now = new Date();

  const promos = await prisma.promoMessage.findMany({
    where: {
      isActive: true,
      OR: [{ startDate: null }, { startDate: { lte: now } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
    },
    include: { coupon: true },
    orderBy: { sortOrder: "asc" },
  });

  return promos.map((p) => {
    let effectiveCode = p.couponCode;
    let isCouponUsable = true;
    if (p.coupon) {
      effectiveCode = p.coupon.code;
      if (!p.coupon.isActive) isCouponUsable = false;
      if (p.coupon.validFrom && new Date(p.coupon.validFrom) > now) isCouponUsable = false;
      if (p.coupon.validUntil && new Date(p.coupon.validUntil) < now) isCouponUsable = false;
      if (p.coupon.usageLimit && p.coupon.usageCount >= p.coupon.usageLimit) isCouponUsable = false;
    }
    return {
      ...p,
      couponCode: isCouponUsable ? effectiveCode : null,
    };
  });
}

export async function listAdminPromos() {
  await ensureDefaultPromos();
  return prisma.promoMessage.findMany({
    include: { coupon: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createPromo(input) {
  return prisma.promoMessage.create({
    data: {
      title: input.title || input.message || "Promo",
      message: input.message,
      couponCode: input.couponCode || null,
      ctaLabel: input.ctaLabel || null,
      ctaUrl: input.ctaUrl || null,
      icon: input.icon || null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updatePromo(id, input) {
  const existing = await prisma.promoMessage.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Promo message not found");

  return prisma.promoMessage.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.message !== undefined ? { message: input.message } : {}),
      ...(input.couponCode !== undefined ? { couponCode: input.couponCode } : {}),
      ...(input.ctaLabel !== undefined ? { ctaLabel: input.ctaLabel } : {}),
      ...(input.ctaUrl !== undefined ? { ctaUrl: input.ctaUrl } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate ? new Date(input.startDate) : null } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate ? new Date(input.endDate) : null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
}

export async function deletePromo(id) {
  const existing = await prisma.promoMessage.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Promo message not found");

  await prisma.promoMessage.delete({ where: { id } });
}
