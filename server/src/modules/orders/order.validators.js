import { z } from "zod";

// India-shaped but not overly strict — a 10-digit mobile starting 6-9, and a
// 6-digit PIN. Good enough for UX validation; nothing downstream depends on
// these being globally exhaustive.
const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");
const postalCodeSchema = z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code");

export const cartItemSchema = z.object({
  slug: z.string().trim().min(1),
  variantId: z.string().uuid().nullable().optional(),
  bookFormat: z.enum(["PHYSICAL", "PDF"]).nullable().optional(),
  quantity: z.number().int().min(1).max(999),
});

export const checkoutItemsSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Your cart is empty"),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: phoneSchema,
});

export const shippingAddressSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  phone: phoneSchema,
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: postalCodeSchema,
  country: z.string().trim().min(1).max(100).default("India"),
});

export const checkoutPreviewSchema = checkoutItemsSchema.extend({
  couponCode: z.string().trim().max(40).optional().nullable(),
  address: z
    .object({ state: z.string().trim().max(100).optional(), postalCode: z.string().trim().max(20).optional() })
    .optional()
    .nullable(),
});

// UTM attribution captured client-side from the landing URL (see
// src/lib/attribution.js) and snapshotted onto the order at checkout —
// this is the only place UTM values get attached to an order, so an order
// always reflects whatever brought that customer to the site, permanently.
const utmSchema = {
  utmSource: z.string().trim().max(200).optional().nullable(),
  utmMedium: z.string().trim().max(200).optional().nullable(),
  utmCampaign: z.string().trim().max(200).optional().nullable(),
  utmContent: z.string().trim().max(200).optional().nullable(),
  utmTerm: z.string().trim().max(200).optional().nullable(),
};

export const createOrderSchema = checkoutItemsSchema.extend({
  customer: customerSchema,
  // Optional at the schema level — a PDF-only cart needs no address. The
  // real check lives in order.service.js, which throws if an address turns
  // out to be required (any non-digital line) and none was supplied.
  shippingAddress: shippingAddressSchema.optional(),
  billingAddress: shippingAddressSchema.optional().nullable(),
  billingSameAsShipping: z.boolean().optional().default(true),
  notes: z.string().trim().max(500).optional().nullable(),
  couponCode: z.string().trim().max(40).optional().nullable(),
  savedAddressId: z.string().uuid().optional(),
  billingSavedAddressId: z.string().uuid().optional(),
  paymentMethod: z.enum(["razorpay", "cod"]).optional().default("razorpay"),
  ...utmSchema,
});

export const trackOrderSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
  email: z.string().trim().toLowerCase().email(),
});

export const confirmationQuerySchema = z.object({
  token: z.string().trim().length(48, "Invalid confirmation token"),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export const shipmentSchema = z.object({
  carrier: z.string().trim().max(120).optional().nullable(),
  trackingNumber: z.string().trim().max(120).optional().nullable(),
  trackingUrl: z.string().trim().max(500).optional().nullable(),
  shippedDate: z.coerce.date().optional().nullable(),
  estimatedDelivery: z.coerce.date().optional().nullable(),
  deliveredDate: z.coerce.date().optional().nullable(),
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]).optional(),
  paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"]).optional(),
  search: z.string().trim().max(200).optional(),
});
