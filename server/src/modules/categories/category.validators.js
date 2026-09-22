import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(140).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  image: z.string().trim().url().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const listCategoriesQuerySchema = z.object({
  includeInactive: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
});
