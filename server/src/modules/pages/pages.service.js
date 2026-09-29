import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { DEFAULT_HOMEPAGE_CONTENT, mergeMissingSettings, settingsEqual, validateHomepageSettings } from "./homepage-content.js";
import { serializePublicProduct } from "../products/product.service.js";
import { listCategories } from "../categories/category.service.js";

const PRODUCT_SECTION_INCLUDE = {
  category: true,
  images: { orderBy: { sortOrder: "asc" } },
  bookDetail: true,
  reviews: { where: { status: "APPROVED" }, select: { rating: true, status: true } },
};

// Resolves a NEW_ARRIVALS / BEST_SELLERS section's product list server-side so the
// storefront never has to guess: AUTO mode queries active products by the relevant
// flag; MANUAL mode fetches the configured productIds (in the stored order) and
// silently skips any that are missing, inactive, or deleted.
async function resolveProductSectionItems(section) {
  const settings = section.settings || {};
  const limit = Math.min(Math.max(Number(settings.limit) || 4, 1), 24);
  const flagField = section.type === "NEW_ARRIVALS" ? "isNewArrival" : "isBestSeller";
  const sourceMode = settings.sourceMode === "MANUAL" ? "MANUAL" : "AUTO";

  if (sourceMode === "MANUAL") {
    const ids = Array.isArray(settings.productIds) ? settings.productIds.filter(Boolean) : [];
    if (!ids.length) return [];
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, isActive: true },
      include: PRODUCT_SECTION_INCLUDE,
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter(Boolean).slice(0, limit).map(serializePublicProduct);
  }

  const products = await prisma.product.findMany({
    where: { isActive: true, [flagField]: true },
    include: PRODUCT_SECTION_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return products.map(serializePublicProduct);
}

// Resolves the CIRCULAR_CATEGORY_NAV section's category list server-side: active
// categories only, in the admin-configured display order (sortOrder, then name),
// optionally restricted to featured categories, capped at the configured limit.
async function resolveCategorySectionItems(section) {
  const settings = section.settings || {};
  const limit = Math.min(Math.max(Number(settings.limit) || 10, 1), 50);
  const categories = await listCategories({ includeInactive: false });
  const filtered = settings.featuredOnly ? categories.filter((c) => c.isFeatured) : categories;
  return filtered.slice(0, limit);
}

// Resolves the FEATURED_COLLECTION section's collection server-side. Returns null
// (not a fake/default collection) when no collectionId is configured, or when the
// configured collection is missing/inactive — the storefront hides the section
// entirely rather than rendering a broken card.
async function resolveFeaturedCollectionSection(section) {
  const settings = section.settings || {};
  if (!settings.collectionId) return null;
  const collection = await prisma.collection.findUnique({ where: { id: settings.collectionId } });
  if (!collection || !collection.isActive) return null;
  return collection;
}

// Resolves the BOOKS_SHELF section's product list server-side: active BOOK-type
// products only, newest first (same default ordering convention as AUTO-mode
// New Arrivals/Best Sellers), capped at the configured limit.
async function resolveBooksSectionItems(section) {
  const settings = section.settings || {};
  const limit = Math.min(Math.max(Number(settings.limit) || 3, 1), 24);
  const products = await prisma.product.findMany({
    where: { isActive: true, productType: "BOOK" },
    include: PRODUCT_SECTION_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return products.map(serializePublicProduct);
}

// Default seed sections for Aadya Storefront in approved visual order
const DEFAULT_HOMEPAGE_SECTIONS = [
  { type: "CIRCULAR_CATEGORY_NAV", name: "Circular Category Navigation", sortOrder: 1, settings: { featuredOnly: false, limit: 10 } },
  // `speed` is animation duration in seconds; larger values move more slowly.
  { type: "PROMO_STRIP", name: "Animated Promo / Coupon Ticker", sortOrder: 2, settings: { speed: 90, pauseOnHover: true } },
  { type: "HERO_CAROUSEL", name: "Full-Width Hero Banner Carousel", sortOrder: 3, settings: { autoplay: true, interval: 6000 } },
  { type: "TRUST_STRIP", name: "Trust & Service Strip", sortOrder: 4, settings: DEFAULT_HOMEPAGE_CONTENT.TRUST_STRIP },
  { type: "NEW_ARRIVALS", name: "New Arrivals Grid", sortOrder: 5, settings: DEFAULT_HOMEPAGE_CONTENT.NEW_ARRIVALS },
  { type: "PROMO_BANNERS_2UP", name: "Promotional Banners 2-Up", sortOrder: 6, settings: DEFAULT_HOMEPAGE_CONTENT.PROMO_BANNERS_2UP },
  { type: "BEST_SELLERS", name: "Best Sellers Grid", sortOrder: 7, settings: DEFAULT_HOMEPAGE_CONTENT.BEST_SELLERS },
  { type: "FEATURED_COLLECTION", name: "Featured Editorial Collection", sortOrder: 8, settings: DEFAULT_HOMEPAGE_CONTENT.FEATURED_COLLECTION },
  { type: "SHOP_THE_LOOK", name: "Shop the Look / Lifestyle Edit", sortOrder: 9, settings: DEFAULT_HOMEPAGE_CONTENT.SHOP_THE_LOOK },
  { type: "BOOKS_SHELF", name: "From Our Bookshelf", sortOrder: 10, settings: DEFAULT_HOMEPAGE_CONTENT.BOOKS_SHELF },
  { type: "EDITORIAL_BRAND", name: "Artisan Craftsmanship Brand Section", sortOrder: 11, settings: DEFAULT_HOMEPAGE_CONTENT.EDITORIAL_BRAND },
  { type: "NEWSLETTER", name: "Newsletter Subscription Section", sortOrder: 12, settings: DEFAULT_HOMEPAGE_CONTENT.NEWSLETTER },
];

export async function ensureDefaultHomepage() {
  let homePage = await prisma.page.findUnique({
    where: { slug: "home" },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });

  if (!homePage) {
    homePage = await prisma.page.create({
      data: {
        name: "Aadya Storefront Homepage",
        slug: "home",
        pageType: "HOME",
        status: "PUBLISHED",
        publishedAt: new Date(),
        seoTitle: "Aadya — Handcrafted Home Decor, Ceramics & Monographs",
        seoDescription: "Discover handcrafted oil lamps, unglazed clay vessels, linen textiles, and slow design objects for peaceful sanctuaries.",
        sections: {
          create: DEFAULT_HOMEPAGE_SECTIONS.map((sec) => ({
            type: sec.type,
            name: sec.name,
            sortOrder: sec.sortOrder,
            settings: sec.settings,
            isEnabled: true,
          })),
        },
      },
      include: { sections: { orderBy: { sortOrder: "asc" } } },
    });
  }

  // Existing production pages are only supplemented with missing keys. Nothing
  // configured by an admin is replaced and no section is recreated.
  const changed = homePage.sections.filter((section) => {
    const merged = mergeMissingSettings(section.type, section.settings);
    return !settingsEqual(merged, section.settings || {});
  });
  if (changed.length) {
    await prisma.$transaction(changed.map((section) => prisma.pageSection.update({
      where: { id: section.id },
      data: { settings: mergeMissingSettings(section.type, section.settings) },
    })));
    homePage = await prisma.page.findUnique({
      where: { slug: "home" }, include: { sections: { orderBy: { sortOrder: "asc" } } },
    });
  }

  return homePage;
}

export async function getPublicHomepage() {
  const homePage = await ensureDefaultHomepage();

  const enabledSections = homePage.sections.filter((s) => s.isEnabled);

  // Batch-resolve product-driven sections server-side (one query per section, not
  // per card) so the storefront receives real, active, correctly-ordered products
  // and never has to render an empty grid because nobody fetched the data.
  const sections = await Promise.all(enabledSections.map(async (section) => {
    if (section.type === "NEW_ARRIVALS" || section.type === "BEST_SELLERS") {
      const items = await resolveProductSectionItems(section);
      return { ...section, products: items };
    }
    if (section.type === "CIRCULAR_CATEGORY_NAV" || section.type === "CATEGORY_CIRCLES") {
      const items = await resolveCategorySectionItems(section);
      return { ...section, categories: items };
    }
    if (section.type === "FEATURED_COLLECTION" || section.type === "COLLECTION") {
      const collection = await resolveFeaturedCollectionSection(section);
      return { ...section, collection };
    }
    if (section.type === "BOOKS_SHELF" || section.type === "BOOKS") {
      const items = await resolveBooksSectionItems(section);
      return { ...section, books: items };
    }
    return section;
  }));

  return {
    page: {
      id: homePage.id,
      name: homePage.name,
      slug: homePage.slug,
      seoTitle: homePage.seoTitle,
      seoDescription: homePage.seoDescription,
    },
    sections,
  };
}

export async function getAdminHomepage() {
  return ensureDefaultHomepage();
}

export async function createPageSection(pageIdOrSlug, input) {
  let page = await prisma.page.findFirst({
    where: { OR: [{ id: pageIdOrSlug }, { slug: pageIdOrSlug }] },
  });
  if (!page) {
    page = await ensureDefaultHomepage();
  }

  const count = await prisma.pageSection.count({ where: { pageId: page.id } });

  return prisma.pageSection.create({
    data: {
      pageId: page.id,
      type: input.type,
      name: input.name || input.type,
      settings: validateHomepageSettings(input.type, input.settings ?? {}),
      content: input.content ?? {},
      isEnabled: input.isEnabled ?? true,
      sortOrder: input.sortOrder ?? count + 1,
    },
  });
}

export async function updatePageSection(sectionId, input) {
  const section = await prisma.pageSection.findUnique({ where: { id: sectionId } });
  if (!section) throw ApiError.notFound("Page section not found");

  return prisma.pageSection.update({
    where: { id: sectionId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.settings !== undefined ? { settings: validateHomepageSettings(input.type ?? section.type, input.settings) } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
}

export async function deletePageSection(sectionId) {
  const section = await prisma.pageSection.findUnique({ where: { id: sectionId } });
  if (!section) throw ApiError.notFound("Page section not found");

  await prisma.pageSection.delete({ where: { id: sectionId } });
}

export async function duplicatePageSection(sectionId) {
  const section = await prisma.pageSection.findUnique({ where: { id: sectionId } });
  if (!section) throw ApiError.notFound("Page section not found");

  return prisma.pageSection.create({
    data: {
      pageId: section.pageId,
      type: section.type,
      name: `${section.name} (Copy)`,
      settings: section.settings ?? {},
      content: section.content ?? {},
      isEnabled: section.isEnabled,
      sortOrder: section.sortOrder + 1,
    },
  });
}

export async function reorderPageSections(pageIdOrSlug, sectionIds) {
  if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
    throw ApiError.badRequest("sectionIds must be a non-empty array");
  }
  if (sectionIds.some((id) => typeof id !== "string" || id.length === 0)) {
    throw ApiError.badRequest("sectionIds must contain valid section IDs");
  }
  if (new Set(sectionIds).size !== sectionIds.length) {
    throw ApiError.badRequest("sectionIds must not contain duplicates");
  }

  let page = await prisma.page.findFirst({
    where: { OR: [{ id: pageIdOrSlug }, { slug: pageIdOrSlug }] },
  });
  if (!page) {
    page = await ensureDefaultHomepage();
  }

  const sections = await prisma.pageSection.findMany({
    where: { id: { in: sectionIds } },
    select: { id: true, pageId: true },
  });
  if (sections.length !== sectionIds.length) {
    throw ApiError.notFound("One or more page sections were not found");
  }
  if (sections.some((section) => section.pageId !== page.id)) {
    throw ApiError.badRequest("All sections must belong to the homepage");
  }

  const updates = sectionIds.map((id, index) =>
    prisma.pageSection.update({
      where: { id },
      data: { sortOrder: index + 1 },
    })
  );
  await prisma.$transaction(updates);
  return prisma.pageSection.findMany({
    where: { pageId: page.id },
    orderBy: { sortOrder: "asc" },
  });
}

export async function publishHomepage(pageIdOrSlug) {
  let page = await prisma.page.findFirst({
    where: { OR: [{ id: pageIdOrSlug }, { slug: pageIdOrSlug }] },
  });
  if (!page) {
    page = await ensureDefaultHomepage();
  }

  return prisma.page.update({
    where: { id: page.id },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });
}
