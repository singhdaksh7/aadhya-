import { z } from "zod";

const ruleConfigSchema = z.record(z.any()).optional().nullable();

const collectionFields = {
  name: z.string().trim().min(1).max(200).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().max(220).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  image: z.string().trim().max(500).optional().nullable(),
  desktopBanner: z.string().trim().max(500).optional().nullable(),
  mobileBanner: z.string().trim().max(500).optional().nullable(),
  type: z.enum([
    "MANUAL",
    "CATEGORY",
    "TAG",
    "FEATURED",
    "BEST_SELLER",
    "NEW_ARRIVAL",
    "TRENDING",
    "PRICE_RANGE",
  ]).optional().default("MANUAL"),
  ruleConfig: ruleConfigSchema,
  isActive: z.boolean().optional().default(true),
  isFeatured: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).optional().default(0),
  seoTitle: z.string().trim().max(200).optional().nullable(),
  seoDescription: z.string().trim().max(500).optional().nullable(),
};

const baseCollectionObject = z.object(collectionFields);

export const createCollectionSchema = baseCollectionObject.refine((data) => data.name || data.title, {
  message: "Collection requires either name or title",
  path: ["name"],
});

export const updateCollectionSchema = baseCollectionObject.partial();

export const collectionProductsMembershipSchema = z.object({
  productIds: z.array(z.string().uuid()).max(500),
});
