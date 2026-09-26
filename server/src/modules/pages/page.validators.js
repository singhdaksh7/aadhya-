import { z } from "zod";

export const createPageSchema = z.object({
  name: z.string().min(1, "Page name is required").max(200),
  slug: z.string().min(1, "Slug is required").max(200).regex(/^[a-z0-9-]+$/i, "Slug must contain only alphanumeric characters and hyphens"),
  pageType: z.enum(["HOME", "STANDARD", "LANDING"]).default("STANDARD"),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  content: z.string().optional().nullable(),
  featuredImage: z.string().url().optional().nullable().or(z.literal("")),
  excerpt: z.string().max(500).optional().nullable(),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(500).optional().nullable(),
  publishedAt: z.string().datetime().optional().nullable()
});

export const updatePageSchema = createPageSchema.partial();
