import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { round2 } from "../../utils/money.js";
import { getAllCategoryDescendantIds } from "../categories/category.service.js";
import { resolveCollectionProducts } from "../collections/collection.service.js";
import { priceCartItems } from "../orders/checkout.service.js";

export function computeCouponStatus(coupon, now = new Date()) {
  if (!coupon.isActive) return "DISABLED";
  if (coupon.validFrom && new Date(coupon.validFrom) > now) return "UPCOMING";
  if (coupon.validUntil && new Date(coupon.validUntil) < now) return "EXPIRED";
  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) return "EXPIRED";
  return "ACTIVE";
}

export function serializeCoupon(coupon) {
  const status = computeCouponStatus(coupon);
  return {
    id: coupon.id,
    code: coupon.code,
    name: coupon.name,
    description: coupon.description,
    discountType: coupon.discountType,
    value: Number(coupon.value),
    minimumOrderAmount: Number(coupon.minimumOrderAmount || 0),
    maximumDiscountAmount: coupon.maximumDiscountAmount != null ? Number(coupon.maximumDiscountAmount) : null,
    validFrom: coupon.validFrom,
    validUntil: coupon.validUntil,
    usageLimit: coupon.usageLimit,
    usageCount: coupon.usageCount,
    perCustomerLimit: coupon.perCustomerLimit,
    isActive: coupon.isActive,
    status,
    targets: coupon.targets || [],
    createdAt: coupon.createdAt,
    updatedAt: coupon.updatedAt,
  };
}

export async function listAdminCoupons() {
  const coupons = await prisma.coupon.findMany({
    include: { targets: true },
    orderBy: { createdAt: "desc" },
  });
  return coupons.map(serializeCoupon);
}

export async function getAdminCouponById(id) {
  const coupon = await prisma.coupon.findUnique({
    where: { id },
    include: { targets: true, redemptions: { take: 20, orderBy: { createdAt: "desc" } } },
  });
  if (!coupon) throw ApiError.notFound("Coupon not found");
  return serializeCoupon(coupon);
}

export async function listPublicActiveCoupons() {
  const now = new Date();
  const coupons = await prisma.coupon.findMany({
    where: {
      isActive: true,
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gte: now } }],
    },
    include: { targets: true },
    orderBy: { createdAt: "desc" },
  });

  return coupons
    .filter((c) => !c.usageLimit || c.usageCount < c.usageLimit)
    .map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      description: c.description,
      discountType: c.discountType,
      value: Number(c.value),
      minimumOrderAmount: Number(c.minimumOrderAmount || 0),
      maximumDiscountAmount: c.maximumDiscountAmount != null ? Number(c.maximumDiscountAmount) : null,
    }));
}

export async function createCoupon(input) {
  const code = input.code.trim().toUpperCase();

  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) throw ApiError.conflict("A coupon with this code already exists");

  const { targets = [], targetType = "ALL", ...rest } = input;

  return prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.create({
      data: {
        code,
        name: rest.name ?? null,
        description: rest.description ?? null,
        discountType: rest.discountType,
        value: rest.value,
        minimumOrderAmount: rest.minimumOrderAmount ?? 0,
        maximumDiscountAmount: rest.maximumDiscountAmount ?? null,
        validFrom: rest.validFrom ?? new Date(),
        validUntil: rest.validUntil ?? null,
        usageLimit: rest.usageLimit ?? null,
        perCustomerLimit: rest.perCustomerLimit ?? null,
        isActive: rest.isActive ?? true,
        targetType,
      },
    });

    const validTargets = targets
      .map((t) => ({
        couponId: coupon.id,
        targetId: typeof t === "string" ? t : (t.targetId || t.id || ""),
      }))
      .filter((t) => Boolean(t.targetId));

    if (validTargets.length > 0) {
      await tx.couponTarget.createMany({
        data: validTargets,
      });
    }

    const created = await tx.coupon.findUnique({
      where: { id: coupon.id },
      include: { targets: true },
    });
    return serializeCoupon(created);
  });
}

export async function updateCoupon(id, input) {
  const existing = await prisma.coupon.findUnique({ where: { id }, include: { targets: true } });
  if (!existing) throw ApiError.notFound("Coupon not found");

  let code = existing.code;
  if (input.code) {
    code = input.code.trim().toUpperCase();
    if (code !== existing.code) {
      const conflict = await prisma.coupon.findUnique({ where: { code } });
      if (conflict) throw ApiError.conflict("A coupon with this code already exists");
    }
  }

  const { targets, targetType, ...rest } = input;

  return prisma.$transaction(async (tx) => {
    await tx.coupon.update({
      where: { id },
      data: {
        code,
        ...(targetType !== undefined ? { targetType } : {}),
        ...(rest.name !== undefined ? { name: rest.name } : {}),
        ...(rest.description !== undefined ? { description: rest.description } : {}),
        ...(rest.discountType !== undefined ? { discountType: rest.discountType } : {}),
        ...(rest.value !== undefined ? { value: rest.value } : {}),
        ...(rest.minimumOrderAmount !== undefined ? { minimumOrderAmount: rest.minimumOrderAmount } : {}),
        ...(rest.maximumDiscountAmount !== undefined ? { maximumDiscountAmount: rest.maximumDiscountAmount } : {}),
        ...(rest.validFrom !== undefined ? { validFrom: rest.validFrom } : {}),
        ...(rest.validUntil !== undefined ? { validUntil: rest.validUntil } : {}),
        ...(rest.usageLimit !== undefined ? { usageLimit: rest.usageLimit } : {}),
        ...(rest.perCustomerLimit !== undefined ? { perCustomerLimit: rest.perCustomerLimit } : {}),
        ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
      },
    });

    if (targets !== undefined) {
      await tx.couponTarget.deleteMany({ where: { couponId: id } });
      const validTargets = targets
        .map((t) => ({
          couponId: id,
          targetId: typeof t === "string" ? t : (t.targetId || t.id || ""),
        }))
        .filter((t) => Boolean(t.targetId));

      if (validTargets.length > 0) {
        await tx.couponTarget.createMany({
          data: validTargets,
        });
      }
    }

    const updated = await tx.coupon.findUnique({ where: { id }, include: { targets: true } });
    return serializeCoupon(updated);
  });
}

export async function deleteCoupon(id) {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Coupon not found");
  await prisma.coupon.delete({ where: { id } });
}

export async function validateCoupon({ code, customerId, customerEmail, items }) {
  if (!code || typeof code !== "string") {
    throw ApiError.badRequest("Coupon code is required");
  }

  const normalizedCode = code.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({
    where: { code: normalizedCode },
    include: { targets: true },
  });

  if (!coupon || !coupon.isActive) {
    throw ApiError.badRequest("Invalid coupon code");
  }

  const now = new Date();

  if (coupon.validFrom && new Date(coupon.validFrom) > now) {
    throw ApiError.badRequest("Coupon is not active yet");
  }

  if (coupon.validUntil && new Date(coupon.validUntil) < now) {
    throw ApiError.badRequest("Coupon has expired");
  }

  if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
    throw ApiError.badRequest("Coupon usage limit has been reached");
  }

  if (coupon.perCustomerLimit) {
    let customerRedemptionCount = 0;
    if (customerId) {
      customerRedemptionCount = await prisma.couponRedemption.count({
        where: { couponId: coupon.id, customerId },
      });
    } else if (customerEmail) {
      customerRedemptionCount = await prisma.couponRedemption.count({
        where: {
          couponId: coupon.id,
          order: { customerEmail: { equals: customerEmail, mode: "insensitive" } },
        },
      });
    }

    if (customerRedemptionCount >= coupon.perCustomerLimit) {
      throw ApiError.badRequest("You have reached the redemption limit for this coupon");
    }
  }

  const pricedItems = await priceCartItems(items);
  const validPricedItems = pricedItems.filter((i) => i.ok);
  if (validPricedItems.length === 0) {
    throw ApiError.badRequest("Your cart has no available items for coupon application");
  }

  const subtotal = round2(validPricedItems.reduce((sum, i) => sum + i.lineTotal, 0));

  let eligibleSubtotal = 0;
  const targets = coupon.targets || [];
  const targetType = coupon.targetType || "ALL";
  const targetIds = targets.map((t) => t.targetId).filter(Boolean);

  if (targetType === "ALL" || targetIds.length === 0) {
    eligibleSubtotal = subtotal;
  } else if (targetType === "PRODUCT") {
    const productSet = new Set(targetIds);
    for (const item of validPricedItems) {
      if (productSet.has(item.productId)) {
        eligibleSubtotal += item.lineTotal;
      }
    }
  } else if (targetType === "CATEGORY") {
    const allEligibleCatIds = new Set();
    for (const catId of targetIds) {
      const descendants = await getAllCategoryDescendantIds(catId);
      descendants.forEach((id) => allEligibleCatIds.add(id));
    }

    const products = await prisma.product.findMany({
      where: { id: { in: validPricedItems.map((i) => i.productId) } },
      select: { id: true, categoryId: true },
    });

    const prodCatMap = new Map(products.map((p) => [p.id, p.categoryId]));

    for (const item of validPricedItems) {
      const itemCatId = prodCatMap.get(item.productId);
      if (itemCatId && allEligibleCatIds.has(itemCatId)) {
        eligibleSubtotal += item.lineTotal;
      }
    }
  } else if (targetType === "COLLECTION") {
    const eligibleProductIds = new Set();
    for (const collectionId of targetIds) {
      const collection = await prisma.collection.findUnique({ where: { id: collectionId } });
      if (collection) {
        const colResult = await resolveCollectionProducts(collection, { limit: 1000 });
        colResult.items.forEach((p) => eligibleProductIds.add(p.id));
      }
    }

    for (const item of validPricedItems) {
      if (eligibleProductIds.has(item.productId)) {
        eligibleSubtotal += item.lineTotal;
      }
    }
  }

  eligibleSubtotal = round2(eligibleSubtotal);

  if (eligibleSubtotal <= 0) {
    throw ApiError.badRequest("Coupon is not applicable to the items in your cart");
  }

  const minOrder = Number(coupon.minimumOrderAmount || 0);
  if (minOrder > 0 && subtotal < minOrder) {
    throw ApiError.badRequest(`Minimum order amount of ₹${minOrder} required to apply this coupon`);
  }

  let discountAmount = 0;
  if (coupon.discountType === "PERCENTAGE") {
    discountAmount = eligibleSubtotal * (Number(coupon.value) / 100);
    if (coupon.maximumDiscountAmount != null) {
      discountAmount = Math.min(discountAmount, Number(coupon.maximumDiscountAmount));
    }
  } else if (coupon.discountType === "FIXED") {
    discountAmount = Math.min(Number(coupon.value), eligibleSubtotal);
  }

  discountAmount = round2(discountAmount);
  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));

  return {
    couponId: coupon.id,
    code: coupon.code,
    discountType: coupon.discountType,
    value: Number(coupon.value),
    minimumOrderAmount: minOrder,
    maximumDiscountAmount: coupon.maximumDiscountAmount != null ? Number(coupon.maximumDiscountAmount) : null,
    eligibleSubtotal,
    discountAmount,
    subtotalBeforeDiscount: subtotal,
    subtotalAfterDiscount: round2(Math.max(0, subtotal - discountAmount)),
  };
}
