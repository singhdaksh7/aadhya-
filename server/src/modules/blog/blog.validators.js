import { z } from "zod";

export const createBlogPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  slug: z.string().min(1, "Slug is required").max(300).regex(/^[a-z0-9-]+$/i, "Slug must contain only alphanumeric characters and hyphens"),
  excerpt: z.string().max(1000).optional().nullable(),
  featuredImage: z.string().optional().nullable(),
  content: z.string().min(1, "Content is required"),
  author: z.string().max(100).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  isFeatured: z.boolean().default(false),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  publishDate: z.string().optional().nullable(),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(500).optional().nullable()
});

export const updateBlogPostSchema = createBlogPostSchema.partial();
