import { z } from "zod";

export const createFaqCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  slug: z.string().min(1, "Slug is required").max(150).regex(/^[a-z0-9-]+$/i, "Slug must contain only alphanumeric characters and hyphens"),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true)
});

export const updateFaqCategorySchema = createFaqCategorySchema.partial();

export const createFaqItemSchema = z.object({
  categoryId: z.string().uuid("Invalid category ID"),
  question: z.string().min(1, "Question is required").max(500),
  answer: z.string().min(1, "Answer is required"),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true)
});

export const updateFaqItemSchema = createFaqItemSchema.partial();

export const reorderSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int()
  })).min(1)
});
