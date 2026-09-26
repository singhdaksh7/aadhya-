import { z } from "zod";

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

