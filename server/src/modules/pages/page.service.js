import { DEFAULT_GIFTING_PAGE_SECTIONS } from "./gifting-content.js";
import { prisma } from "../../lib/prisma.js";
import { sanitizeRichText } from "../../utils/sanitizer.js";
import { listPublicProducts, serializePublicProduct } from "../products/product.service.js";

const GIFT_PRODUCT_INCLUDE = {
  category: true,
  images: { orderBy: { sortOrder: "asc" } },
  bookDetail: true,
  reviews: { where: { status: "APPROVED" }, select: { rating: true, status: true } },
};

// Resolves the FEATURED_GIFTS product list server-side from the admin's chosen source:
// AUTO (flagged Featured), MANUAL (hand-picked ids, stored order), COLLECTION, or a dynamic QUERY.
// Inactive/missing products are skipped. Returns null for AUTO so the storefront keeps its fallback.
export async function resolveFeaturedGiftProducts(settings = {}) {
  const limit = Math.min(Math.max(Number(settings.limit) || 4, 1), 24);
  const mode = ["MANUAL", "COLLECTION", "QUERY"].includes(settings.sourceMode) ? settings.sourceMode : "AUTO";
  const base = { page: 1, limit, sort: "newest" };
  if (mode === "MANUAL") {
    const ids = (Array.isArray(settings.productIds) ? settings.productIds : []).filter(Boolean);
    if (!ids.length) return [];
    const rows = await prisma.product.findMany({ where: { id: { in: ids }, isActive: true }, include: GIFT_PRODUCT_INCLUDE });
    const byId = new Map(rows.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter(Boolean).slice(0, limit).map(serializePublicProduct);
  }
  if (mode === "COLLECTION") {
    if (!settings.collectionSlug) return [];
    return (await listPublicProducts({ ...base, collection: settings.collectionSlug })).items;
  }
  if (mode === "QUERY") {
    const query = { ...base, sort: settings.querySort || "newest" };
    if (settings.queryCategory) query.category = settings.queryCategory;
    if (settings.querySearch) query.search = settings.querySearch;
    if (typeof settings.queryMinPrice === "number") query.minPrice = settings.queryMinPrice;
    if (typeof settings.queryMaxPrice === "number") query.maxPrice = settings.queryMaxPrice;
    return (await listPublicProducts(query)).items;
  }
  return null;
}

// Pages the storefront routes depend on (/about, /shipping, ...). They can be edited and
// unpublished, but never moved to a different slug or deleted, so a route cannot break.
export const SYSTEM_PAGE_SLUGS = ["about", "shipping", "returns", "privacy", "terms", "cancellation", "payments", "contact", "training", "consultation", "research", "events", "thinkpod", "gifting"];
const isSystemSlug = (slug) => SYSTEM_PAGE_SLUGS.includes(String(slug || "").toLowerCase().trim());
function protectedError(message) { const e = new Error(message); e.statusCode = 400; return e; }

export async function listPages({ search, pageType, status, page = 1, limit = 50 } = {}) {
  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } }
    ];
  }
  if (pageType) {
    where.pageType = pageType;
  }
  if (status) {
    where.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    prisma.page.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: Number(limit),
      include: { sections: { orderBy: { sortOrder: "asc" } } }
    }),
    prisma.page.count({ where })
  ]);

  return { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
}

export async function getPageById(id) {
  const page = await prisma.page.findUnique({
    where: { id },
    include: { sections: { orderBy: { sortOrder: "asc" } } }
  });
  if (!page) {
    const error = new Error("CMS Page not found");
    error.statusCode = 404;
    throw error;
  }
  return page;
}

export async function ensureDefaultGiftingPage() {
  let page = await prisma.page.findUnique({
    where: { slug: "gifting" },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });
  if (!page) {
    page = await prisma.page.create({
      data: {
        name: "Artisan Gifting",
        slug: "gifting",
        pageType: "LANDING",
        status: "PUBLISHED",
        publishedAt: new Date(),
        seoTitle: "Thoughtful Gifting | Handcrafted Decor & Curated Keepsakes | Tushaqsa",
        seoDescription: "Discover handcrafted gifts for housewarming, weddings, anniversaries and festivals. Heirloom brass, raw ceramics, and mindful objects made in India.",
        sections: {
          create: DEFAULT_GIFTING_PAGE_SECTIONS.map((sec) => ({
            type: sec.type,
            name: sec.name,
            sortOrder: sec.sortOrder,
            settings: sec.settings,
            isEnabled: true,
            isActive: true,
          })),
        },
      },
      include: { sections: { orderBy: { sortOrder: "asc" } } },
    });
  }
  return page;
}

export async function getPageBySlug(slug, { allowDraft = false } = {}) {
  const normalizedSlug = slug.toLowerCase().trim();
  let page = await prisma.page.findUnique({
    where: { slug: normalizedSlug },
    include: { sections: { orderBy: { sortOrder: "asc" }, where: { isActive: true } } }
  });

  if (!page && normalizedSlug === "gifting") {
    page = await ensureDefaultGiftingPage();
  }

  if (!page) {
    const error = new Error("CMS Page not found");
    error.statusCode = 404;
    throw error;
  }

  if (!allowDraft && page.status !== "PUBLISHED") {
    const error = new Error("CMS Page not found or not published");
    error.statusCode = 404;
    throw error;
  }

  if (normalizedSlug === "gifting" && Array.isArray(page.sections)) {
    const sections = await Promise.all(page.sections.map(async (section) => {
      if (section.type !== "FEATURED_GIFTS") return section;
      try {
        const products = await resolveFeaturedGiftProducts(section.settings || {});
        return products ? { ...section, products } : section;
      } catch {
        return section;
      }
    }));
    return { ...page, sections };
  }

  return page;
}

export async function createPage(data) {
  const normalizedSlug = data.slug.toLowerCase().trim();
  const existing = await prisma.page.findUnique({ where: { slug: normalizedSlug } });
  if (existing) {
    const error = new Error(`Page with slug "${normalizedSlug}" already exists`);
    error.statusCode = 400;
    throw error;
  }

  const sanitizedContent = data.content ? sanitizeRichText(data.content) : null;
  const isPublished = data.status === "PUBLISHED";

  return prisma.page.create({
    data: {
      name: data.name,
      slug: normalizedSlug,
      pageType: data.pageType || "STANDARD",
      status: data.status || "DRAFT",
      content: sanitizedContent,
      featuredImage: data.featuredImage || null,
      excerpt: data.excerpt || null,
      seoTitle: data.seoTitle || null,
      seoDescription: data.seoDescription || null,
      publishedAt: isPublished ? (data.publishedAt ? new Date(data.publishedAt) : new Date()) : null
    }
  });
}

export async function updatePage(id, data) {
  const existing = await getPageById(id);
  if (isSystemSlug(existing.slug) && data.slug && data.slug.toLowerCase().trim() !== existing.slug) {
    throw protectedError(`The "${existing.slug}" page is a system page and its URL slug cannot be changed.`);
  }

  let normalizedSlug = existing.slug;
  if (data.slug && data.slug.toLowerCase().trim() !== existing.slug) {
    normalizedSlug = data.slug.toLowerCase().trim();
    const collision = await prisma.page.findUnique({ where: { slug: normalizedSlug } });
    if (collision) {
      const error = new Error(`Page with slug "${normalizedSlug}" already exists`);
      error.statusCode = 400;
      throw error;
    }
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.slug !== undefined) updateData.slug = normalizedSlug;
  if (data.pageType !== undefined) updateData.pageType = data.pageType;
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "PUBLISHED" && !existing.publishedAt) {
      updateData.publishedAt = new Date();
    }
  }
  if (data.content !== undefined) updateData.content = data.content ? sanitizeRichText(data.content) : null;
  if (data.featuredImage !== undefined) updateData.featuredImage = data.featuredImage || null;
  if (data.excerpt !== undefined) updateData.excerpt = data.excerpt || null;
  if (data.seoTitle !== undefined) updateData.seoTitle = data.seoTitle || null;
  if (data.seoDescription !== undefined) updateData.seoDescription = data.seoDescription || null;

  return prisma.page.update({
    where: { id },
    data: updateData,
    include: { sections: { orderBy: { sortOrder: "asc" } } }
  });
}

export async function deletePage(id) {
  const existing = await getPageById(id);
  if (isSystemSlug(existing.slug)) throw protectedError(`The "${existing.slug}" page is a system page and cannot be deleted. Edit or unpublish it instead.`);
  return prisma.page.delete({ where: { id } });
}

export async function togglePublishPage(id, { status }) {
  const existing = await getPageById(id);
  const targetStatus = status || (existing.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED");
  const publishedAt = targetStatus === "PUBLISHED" ? (existing.publishedAt || new Date()) : existing.publishedAt;

  return prisma.page.update({
    where: { id },
    data: { status: targetStatus, publishedAt }
  });
}
