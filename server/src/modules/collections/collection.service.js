import { prisma } from "../../lib/prisma.js";
import { slugify } from "../../utils/slugify.js";
import { ApiError } from "../../utils/ApiError.js";
import { serializePublicProduct } from "../products/product.service.js";
import { getAllCategoryDescendantIds } from "../categories/category.service.js";

const PUBLIC_INCLUDE = {
  category: true,
  images: { orderBy: { sortOrder: "asc" } },
  bookDetail: true,
};

async function ensureUniqueSlug(baseSlug, ignoreId) {
  let slug = baseSlug;
  let suffix = 1;
  while (
    await prisma.collection.findFirst({
      where: { slug, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
    })
  ) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
  return slug;
}

export function validateRuleConfig(type, ruleConfig) {
  if (type === "CATEGORY") {
    if (!ruleConfig || (!ruleConfig.categoryId && !ruleConfig.categorySlug)) {
      throw ApiError.badRequest("Category collection requires ruleConfig.categoryId or categorySlug");
    }
  } else if (type === "TAG") {
    if (!ruleConfig || !ruleConfig.tag) {
      throw ApiError.badRequest("Tag collection requires ruleConfig.tag");
    }
  } else if (type === "PRICE_RANGE") {
    if (!ruleConfig || (ruleConfig.minPrice === undefined && ruleConfig.maxPrice === undefined)) {
      throw ApiError.badRequest("Price range collection requires minPrice or maxPrice in ruleConfig");
    }
  }
}

export async function resolveCollectionProducts(collection, query = {}) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));
  const skip = (page - 1) * limit;

  let productWhere = { isActive: true };

  if (query.search) {
    productWhere.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { shortDescription: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    productWhere.price = {
      ...(query.minPrice !== undefined ? { gte: Number(query.minPrice) } : {}),
      ...(query.maxPrice !== undefined ? { lte: Number(query.maxPrice) } : {}),
    };
  }

  const type = collection.type || "MANUAL";
  const ruleConfig = collection.ruleConfig || {};

  if (type === "MANUAL") {
    const manualLinks = await prisma.collectionProduct.findMany({
      where: { collectionId: collection.id },
      orderBy: { sortOrder: "asc" },
      include: {
        product: {
          include: PUBLIC_INCLUDE,
        },
      },
    });

    const activeProducts = manualLinks
      .map((cp) => cp.product)
      .filter((p) => p && p.isActive);

    const total = activeProducts.length;
    const paginated = activeProducts.slice(skip, skip + limit);

    return {
      items: paginated.map(serializePublicProduct),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  if (type === "CATEGORY") {
    let categoryId = ruleConfig.categoryId;
    if (!categoryId && ruleConfig.categorySlug) {
      const cat = await prisma.category.findUnique({ where: { slug: ruleConfig.categorySlug } });
      if (cat) categoryId = cat.id;
    }
    if (categoryId) {
      const catIds = await getAllCategoryDescendantIds(categoryId);
      productWhere.categoryId = { in: catIds };
    }
  } else if (type === "TAG") {
    if (ruleConfig.tag) {
      productWhere.tags = { has: ruleConfig.tag };
    }
  } else if (type === "FEATURED") {
    productWhere.isFeatured = true;
  } else if (type === "BEST_SELLER") {
    productWhere.isBestSeller = true;
  } else if (type === "NEW_ARRIVAL") {
    productWhere.isNewArrival = true;
  } else if (type === "TRENDING") {
    productWhere.isTrending = true;
  } else if (type === "PRICE_RANGE") {
    const min = ruleConfig.minPrice != null ? Number(ruleConfig.minPrice) : undefined;
    const max = ruleConfig.maxPrice != null ? Number(ruleConfig.maxPrice) : undefined;
    if (min !== undefined || max !== undefined) {
      productWhere.price = {
        ...(min !== undefined ? { gte: min } : {}),
        ...(max !== undefined ? { lte: max } : {}),
      };
    }
  }

  let orderBy = { createdAt: "desc" };
  if (query.sort === "price_asc") orderBy = { price: "asc" };
  if (query.sort === "price_desc") orderBy = { price: "desc" };
  if (query.sort === "name_asc") orderBy = { name: "asc" };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: productWhere,
      include: PUBLIC_INCLUDE,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.product.count({ where: productWhere }),
  ]);

  return {
    items: products.map(serializePublicProduct),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function listPublicCollections() {
  return prisma.collection.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
}

export async function getPublicCollectionBySlug(slug, query = {}) {
  const collection = await prisma.collection.findUnique({
    where: { slug },
  });
  if (!collection || !collection.isActive) {
    throw ApiError.notFound("Collection not found");
  }

  const productsResult = await resolveCollectionProducts(collection, query);

  return {
    collection,
    products: productsResult.items,
    meta: productsResult.meta,
  };
}

export async function listAdminCollections() {
  return prisma.collection.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      products: {
        orderBy: { sortOrder: "asc" },
        include: { product: { select: { id: true, name: true, slug: true, price: true, isActive: true } } },
      },
    },
  });
}

export async function getAdminCollectionById(id) {
  const collection = await prisma.collection.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: { sortOrder: "asc" },
        include: { product: { include: PUBLIC_INCLUDE } },
      },
    },
  });
  if (!collection) throw ApiError.notFound("Collection not found");
  return collection;
}

export async function createCollection(input) {
  const name = input.name || input.title || "Untitled Collection";
  const baseSlug = slugify(input.slug || name);
  const slug = await ensureUniqueSlug(baseSlug);

  validateRuleConfig(input.type, input.ruleConfig);

  const data = {
    title: name,
    slug,
    description: input.description ?? null,
    heroImage: input.image ?? input.heroImage ?? null,
    desktopBanner: input.desktopBanner ?? null,
    mobileBanner: input.mobileBanner ?? null,
    type: input.type || "MANUAL",
    isActive: input.isActive ?? true,
    isFeatured: input.isFeatured ?? false,
    sortOrder: input.sortOrder ?? 0,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
  };

  if (input.ruleConfig !== undefined && input.ruleConfig !== null) {
    data.ruleConfig = input.ruleConfig;
  }

  return prisma.collection.create({ data });
}

export async function updateCollection(id, input) {
  const existing = await prisma.collection.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Collection not found");

  const name = input.name || input.title || existing.title;

  let slug = existing.slug;
  if (input.slug || input.name || input.title) {
    const baseSlug = slugify(input.slug || name);
    if (baseSlug !== existing.slug) {
      slug = await ensureUniqueSlug(baseSlug, id);
    }
  }

  const nextType = input.type || existing.type;
  const nextRuleConfig = input.ruleConfig !== undefined ? input.ruleConfig : existing.ruleConfig;
  validateRuleConfig(nextType, nextRuleConfig);

  const data = {
    ...(input.name !== undefined || input.title !== undefined ? { title: name } : {}),
    slug,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.image !== undefined || input.heroImage !== undefined ? { heroImage: input.image ?? input.heroImage } : {}),
    ...(input.desktopBanner !== undefined ? { desktopBanner: input.desktopBanner } : {}),
    ...(input.mobileBanner !== undefined ? { mobileBanner: input.mobileBanner } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
    ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
  };

  if (input.ruleConfig !== undefined && input.ruleConfig !== null) {
    data.ruleConfig = input.ruleConfig;
  }

  return prisma.collection.update({
    where: { id },
    data,
  });
}

export async function updateCollectionProducts(id, productIds) {
  const collection = await prisma.collection.findUnique({ where: { id } });
  if (!collection) throw ApiError.notFound("Collection not found");

  const existingProductsCount = await prisma.product.count({
    where: { id: { in: productIds } },
  });
  if (existingProductsCount !== new Set(productIds).size) {
    throw ApiError.badRequest("One or more product IDs do not exist");
  }

  await prisma.$transaction([
    prisma.collectionProduct.deleteMany({ where: { collectionId: id } }),
    ...productIds.map((productId, sortOrder) =>
      prisma.collectionProduct.create({
        data: { collectionId: id, productId, sortOrder },
      })
    ),
  ]);

  return getAdminCollectionById(id);
}

export async function deleteCollection(id) {
  const existing = await prisma.collection.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Collection not found");
  await prisma.collection.delete({ where: { id } });
}
