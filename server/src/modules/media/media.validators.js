import { z } from "zod";

export const updateMediaMetadataSchema = z.object({
  altText: z.string().max(300).optional().nullable(),
  title: z.string().max(300).optional().nullable()
});

export const listMediaSchema = z.object({
  search: z.string().optional(),
  mimeType: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24)
});
