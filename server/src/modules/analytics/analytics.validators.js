import { z } from "zod";

// `purchase` is deliberately excluded — it is server-authoritative and is
// only ever written internally from the payment-confirmation flow
// (see payment.service.js -> recordPurchaseEvent). Accepting it here would
// let any client fabricate revenue events.
export const CLIENT_EVENT_TYPES = [
  "page_view",
  "product_view",
  "category_view",
  "collection_view",
  "search",
  "add_to_cart",
  "remove_from_cart",
  "checkout_started",
  "wishlist_add",
  "newsletter_signup",
  "coupon_applied",
];

export const ALL_EVENT_TYPES = [...CLIENT_EVENT_TYPES, "purchase"];

const utmFields = {
  utmSource: z.string().trim().max(200).optional().nullable(),
  utmMedium: z.string().trim().max(200).optional().nullable(),
  utmCampaign: z.string().trim().max(200).optional().nullable(),
  utmContent: z.string().trim().max(200).optional().nullable(),
  utmTerm: z.string().trim().max(200).optional().nullable(),
};

export const trackEventSchema = z.object({
  type: z.enum(CLIENT_EVENT_TYPES),
  sessionId: z.string().trim().min(1).max(200).optional().nullable(),
  productId: z.string().trim().max(100).optional().nullable(),
  categoryId: z.string().trim().max(100).optional().nullable(),
  collectionId: z.string().trim().max(100).optional().nullable(),
  // metadata is intentionally shallow/bounded — a public write endpoint must
  // never become an arbitrary-JSON-blob firehose.
  metadata: z
    .record(z.string(), z.any())
    .optional()
    .nullable()
    .refine((v) => !v || JSON.stringify(v).length <= 2000, { message: "metadata is too large" }),
  ...utmFields,
});

export const trackEventsSchema = z.object({
  events: z.array(trackEventSchema).min(1).max(20),
});

export const dateRangeQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  range: z.enum(["today", "7d", "30d", "90d", "custom"]).optional().default("30d"),
});
