import { z } from "zod";

export const couponTargetSchema = z.object({
  targetType: z.enum(["ALL", "PRODUCT", "CATEGORY", "COLLECTION"]),
  targetId: z.string().trim().optional().nullable(),
});

export const createCouponSchema = z.object({
  code: z.string().trim().min(2).max(40).transform((v) => v.toUpperCase()),
  name: z.string().trim().max(150).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.number().positive(),
  minimumOrderAmount: z.number().nonnegative().optional().default(0),
  maximumDiscountAmount: z.number().nonnegative().optional().nullable(),
  validFrom: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.date().optional()),
  validUntil: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.date().optional().nullable()),
  usageLimit: z.number().int().min(1).optional().nullable(),
  perCustomerLimit: z.number().int().min(1).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  targets: z.array(couponTargetSchema).optional().default([{ targetType: "ALL" }]),
});

export const updateCouponSchema = createCouponSchema.partial();

export const validateCouponSchema = z.object({
  code: z.string().trim().min(1).max(40),
  items: z.array(
    z.object({
      slug: z.string().trim().min(1),
      variantId: z.string().uuid().optional().nullable(),
      quantity: z.number().int().min(1),
    })
  ).min(1),
});
