import { z } from "zod";

export const MAX_CATEGORY_BANNERS = 20;

// Relative ("/x", not protocol-relative "//x") or absolute http(s) only.
const safeUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || (/^\/(?!\/)/.test(v) && !/[\s\\]/.test(v)) || /^https?:\/\/[^\s]+$/i.test(v), "Must be a relative path or an http(s) URL");

const optText = (max) => z.string().trim().max(max).optional().nullable();

export const categoryBannerSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    enabled: z.boolean().default(true),
    desktopImage: safeUrl.optional().nullable(),
    mobileImage: safeUrl.optional().nullable(),
    title: optText(120),
    subtitle: optText(240),
    ctaLabel: optText(60),
    ctaUrl: safeUrl.optional().nullable(),
    sortOrder: z.number().int().min(0).max(100000).default(0),
  })
  .refine((b) => !b.enabled || b.desktopImage || b.mobileImage, {
    message: "An enabled banner needs a desktop or mobile image",
    path: ["desktopImage"],
  })
  .refine((b) => !b.ctaLabel || b.ctaUrl, { message: "CTA label needs a destination", path: ["ctaUrl"] });

export const categoryBannersSchema = z
  .array(categoryBannerSchema)
  .max(MAX_CATEGORY_BANNERS)
  .refine((list) => new Set(list.map((b) => b.id)).size === list.length, "Banner ids must be unique");

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  image: z.string().trim().url().or(z.string().trim().startsWith("/")).optional().nullable(),
  icon: z.string().trim().optional().nullable(),
  logo: z.string().trim().optional().nullable(),
  desktopBanner: z.string().trim().optional().nullable(),
  mobileBanner: z.string().trim().optional().nullable(),
  banners: categoryBannersSchema.optional().nullable(),
  bannerAutoplay: z.boolean().optional(),
  bannerIntervalMs: z.number().int().min(2000).max(30000).optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  seoTitle: z.string().trim().max(200).optional().nullable(),
  seoDescription: z.string().trim().max(500).optional().nullable(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const listCategoriesQuerySchema = z.object({
  includeInactive: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  tree: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
});

