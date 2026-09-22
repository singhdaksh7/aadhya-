import { z } from "zod";

const bookDetailSchema = z
  .object({
    author: z.string().trim().max(200).optional().nullable(),
    isbn: z.string().trim().max(32).optional().nullable(),
    publisher: z.string().trim().max(200).optional().nullable(),
    language: z.string().trim().max(60).optional().nullable(),
    pageCount: z.number().int().positive().optional().nullable(),
    edition: z.string().trim().max(60).optional().nullable(),
    publicationYear: z.number().int().min(1000).max(3000).optional().nullable(),
  })
  .optional()
  .nullable();

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(220).optional(),
  shortDescription: z.string().trim().max(300).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  productType: z.enum(["BOOK", "PHYSICAL"]),
  categoryId: z.string().uuid(),
  sku: z.string().trim().max(64).optional().nullable(),
  price: z.number().nonnegative(),
  salePrice: z.number().nonnegative().optional().nullable(),
  stockQuantity: z.number().int().min(0).optional(),
  trackInventory: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isNewArrival: z.boolean().optional(),
  isActive: z.boolean().optional(),
  seoTitle: z.string().trim().max(200).optional().nullable(),
  seoDescription: z.string().trim().max(500).optional().nullable(),
  attributes: z.record(z.string().trim().max(80), z.string().trim().max(500)).optional().nullable(),
  bookDetail: bookDetailSchema,
});

export const updateProductSchema = createProductSchema.partial();

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(140).optional(),
  categoryId: z.string().uuid().optional(),
  type: z.enum(["BOOK", "PHYSICAL"]).optional(),
  productType: z.enum(["BOOK", "PHYSICAL"]).optional(),
  featured: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  bestSeller: z.union([z.literal("true"), z.literal("false")]).optional().transform((v) => v === undefined ? undefined : v === "true"),
  newArrival: z.union([z.literal("true"), z.literal("false")]).optional().transform((v) => v === undefined ? undefined : v === "true"),
  availability: z.enum(["in_stock", "out_of_stock"]).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  collection: z.string().trim().max(220).optional(),
  isActive: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  sort: z.enum(["newest", "price_asc", "price_desc", "name_asc"]).optional().default("newest"),
});

export const reorderImagesSchema = z.object({
  order: z.array(z.string().uuid()).min(1),
});
