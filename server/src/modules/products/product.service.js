import { prisma } from "../../lib/prisma.js";
import { slugify } from "../../utils/slugify.js";
import { ApiError } from "../../utils/ApiError.js";
import { removeByUrl } from "../uploads/storage.js";

const PUBLIC_INCLUDE = {
  category: true,
  images: { orderBy: { sortOrder: "asc" } },
  bookDetail: true,
};

const ADMIN_INCLUDE = { ...PUBLIC_INCLUDE, variants: { orderBy: { createdAt: "asc" } } };

export function serializePublicProduct(product) {
  const { variants = [], ...safe } = product;
  return {
    ...safe,
    variants: variants.filter((variant) => variant.isActive).map((variant) => ({
      id: variant.id, name: variant.name, sku: variant.sku, attributes: variant.attributes,
      price: Number(variant.priceOverride ?? product.salePrice ?? product.price),
      stockQuantity: variant.stockQuantity, available: variant.stockQuantity > 0,
    })),
  };
}

async function ensureUniqueSlug(baseSlug, ignoreId) {
  let slug = baseSlug;
  let suffix = 1;
  while (
    await prisma.product.findFirst({ where: { slug, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) } })
  ) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
  return slug;
}

function sortToOrderBy(sort) {
  switch (sort) {
    case "price_asc":
      return { price: "asc" };
    case "price_desc":
      return { price: "desc" };
    case "name_asc":
      return { name: "asc" };
    case "newest":
    default:
      return { createdAt: "desc" };
  }
}

function buildWhere(query, { forceActive }) {
  const where = {};
  if (forceActive) where.isActive = true;
  else if (query.isActive !== undefined) where.isActive = query.isActive;

  const type = query.productType || query.type;
  if (type) where.productType = type;

  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.category) where.category = { slug: query.category };

  if (query.featured !== undefined) where.isFeatured = query.featured;
  if (query.bestSeller !== undefined) where.isBestSeller = query.bestSeller;
  if (query.newArrival !== undefined) where.isNewArrival = query.newArrival;
  if (query.collection) where.collections = { some: { collection: { slug: query.collection, isActive: true } } };
  if (query.minPrice !== undefined || query.maxPrice !== undefined) where.price = { ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}), ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}) };
  if (query.availability === "in_stock") where.stockQuantity = { gt: 0 };
  if (query.availability === "out_of_stock") where.stockQuantity = { lte: 0 };

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { shortDescription: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      { bookDetail: { author: { contains: query.search, mode: "insensitive" } } },
    ];
  }

  return where;
}

async function paginatedFind(where, { page, limit, sort }, include) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include,
      orderBy: sortToOrderBy(sort),
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function listPublicProducts(query) {
  const where = buildWhere(query, { forceActive: true });
  return paginatedFind(where, query, PUBLIC_INCLUDE);
}

export async function getPublicProductBySlug(slug) {
  const product = await prisma.product.findUnique({ where: { slug }, include: ADMIN_INCLUDE });
  if (!product || !product.isActive) throw ApiError.notFound("Product not found");
  return serializePublicProduct(product);
}

export async function listRelatedProducts(product, limit = 4) {
  return prisma.product.findMany({
    where: {
      isActive: true,
      categoryId: product.categoryId,
      NOT: { id: product.id },
    },
    include: PUBLIC_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listAdminProducts(query) {
  const where = buildWhere(query, { forceActive: false });
  return paginatedFind(where, query, PUBLIC_INCLUDE);
}

export async function getAdminProductById(id) {
  const product = await prisma.product.findUnique({ where: { id }, include: ADMIN_INCLUDE });
  if (!product) throw ApiError.notFound("Product not found");
  return product;
}

export async function listVariants(productId) {
  await getAdminProductById(productId);
  return prisma.productVariant.findMany({ where: { productId }, orderBy: { createdAt: "asc" } });
}

export async function createVariant(productId, input) {
  await getAdminProductById(productId);
  try { return await prisma.productVariant.create({ data: { productId, ...input } }); }
  catch (error) { if (error.code === "P2002") throw ApiError.conflict("Variant SKU is already in use"); throw error; }
}

export async function updateVariant(productId, variantId, input) {
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId } });
  if (!variant) throw ApiError.notFound("Variant not found");
  try { return await prisma.productVariant.update({ where: { id: variantId }, data: input }); }
  catch (error) { if (error.code === "P2002") throw ApiError.conflict("Variant SKU is already in use"); throw error; }
}

export async function deleteVariant(productId, variantId) {
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId } });
  if (!variant) throw ApiError.notFound("Variant not found");
  await prisma.productVariant.delete({ where: { id: variantId } });
}

async function assertCategoryExists(categoryId) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw ApiError.badRequest("categoryId does not reference an existing category");
}

export async function createProduct(input) {
  await assertCategoryExists(input.categoryId);

  const baseSlug = slugify(input.slug || input.name);
  const slug = await ensureUniqueSlug(baseSlug);

  if (input.sku) {
    const existingSku = await prisma.product.findUnique({ where: { sku: input.sku } });
    if (existingSku) throw ApiError.conflict("SKU is already in use");
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        name: input.name,
        slug,
        shortDescription: input.shortDescription ?? null,
        description: input.description ?? null,
        productType: input.productType,
        categoryId: input.categoryId,
        sku: input.sku ?? null,
        price: input.price,
        salePrice: input.salePrice ?? null,
        stockQuantity: input.stockQuantity ?? 0,
        trackInventory: input.trackInventory ?? true,
        isFeatured: input.isFeatured ?? false,
        isBestSeller: input.isBestSeller ?? false,
        isNewArrival: input.isNewArrival ?? false,
        isActive: input.isActive ?? true,
        seoTitle: input.seoTitle ?? null,
        seoDescription: input.seoDescription ?? null,
        attributes: input.attributes ?? undefined,
      },
    });

    if (input.productType === "BOOK" && input.bookDetail) {
      await tx.productBookDetails.create({
        data: { productId: product.id, ...input.bookDetail },
      });
    }

    return tx.product.findUnique({ where: { id: product.id }, include: PUBLIC_INCLUDE });
  });
}

export async function updateProduct(id, input) {
  const existing = await prisma.product.findUnique({ where: { id }, include: { bookDetail: true } });
  if (!existing) throw ApiError.notFound("Product not found");

  if (input.categoryId) await assertCategoryExists(input.categoryId);

  if (input.sku) {
    const existingSku = await prisma.product.findFirst({ where: { sku: input.sku, NOT: { id } } });
    if (existingSku) throw ApiError.conflict("SKU is already in use");
  }

  let slug = existing.slug;
  if (input.slug || input.name) {
    const baseSlug = slugify(input.slug || input.name);
    if (baseSlug !== existing.slug) slug = await ensureUniqueSlug(baseSlug, id);
  }

  const nextType = input.productType ?? existing.productType;

  return prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        slug,
        ...(input.shortDescription !== undefined ? { shortDescription: input.shortDescription } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.productType !== undefined ? { productType: input.productType } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.salePrice !== undefined ? { salePrice: input.salePrice } : {}),
        ...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {}),
        ...(input.trackInventory !== undefined ? { trackInventory: input.trackInventory } : {}),
        ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
        ...(input.isBestSeller !== undefined ? { isBestSeller: input.isBestSeller } : {}),
        ...(input.isNewArrival !== undefined ? { isNewArrival: input.isNewArrival } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
        ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
        ...(input.attributes !== undefined ? { attributes: input.attributes } : {}),
      },
    });

    if (nextType === "BOOK") {
      if (input.bookDetail) {
        await tx.productBookDetails.upsert({
          where: { productId: id },
          create: { productId: id, ...input.bookDetail },
          update: { ...input.bookDetail },
        });
      }
    } else if (input.productType === "PHYSICAL" && existing.bookDetail) {
      // Switching a book to a physical product drops its book metadata.
      await tx.productBookDetails.delete({ where: { productId: id } });
    }

    return tx.product.findUnique({ where: { id }, include: PUBLIC_INCLUDE });
  });
}

export async function deleteProduct(id) {
  const product = await prisma.product.findUnique({ where: { id }, include: { images: true } });
  if (!product) throw ApiError.notFound("Product not found");

  await prisma.product.delete({ where: { id } });
  await Promise.all(product.images.map((img) => removeByUrl(img.url)));
}

export async function addProductImage(productId, { url, altText, isPrimary }) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw ApiError.notFound("Product not found");

  return prisma.$transaction(async (tx) => {
    const count = await tx.productImage.count({ where: { productId } });
    const makePrimary = isPrimary || count === 0;

    if (makePrimary) {
      await tx.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
    }

    return tx.productImage.create({
      data: { productId, url, altText: altText ?? null, isPrimary: makePrimary, sortOrder: count },
    });
  });
}

export async function deleteProductImage(productId, imageId) {
  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId } });
  if (!image) throw ApiError.notFound("Image not found");

  await prisma.productImage.delete({ where: { id: imageId } });
  await removeByUrl(image.url);

  if (image.isPrimary) {
    const next = await prisma.productImage.findFirst({
      where: { productId },
      orderBy: { sortOrder: "asc" },
    });
    if (next) await prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
  }
}

export async function setPrimaryImage(productId, imageId) {
  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId } });
  if (!image) throw ApiError.notFound("Image not found");

  await prisma.$transaction([
    prisma.productImage.updateMany({ where: { productId }, data: { isPrimary: false } }),
    prisma.productImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
  ]);
}

export async function reorderProductImages(productId, orderedIds) {
  const images = await prisma.productImage.findMany({ where: { productId } });
  const validIds = new Set(images.map((i) => i.id));
  if (orderedIds.length !== images.length || !orderedIds.every((id) => validIds.has(id))) {
    throw ApiError.badRequest("order must contain exactly the image ids belonging to this product");
  }

  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.productImage.update({ where: { id }, data: { sortOrder: index } }))
  );
}
