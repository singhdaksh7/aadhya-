import { z } from "zod";
import { prisma } from "../../lib/prisma.js";

// SHOPPABLE_REELS: portrait video cards, each optionally linked to products.
export const MAX_REELS = 24;
export const MAX_PRODUCTS_PER_REEL = 12;
export const MAX_CATEGORIES_PER_REEL = 12;
const VIDEO_EXT = /\.(mp4|webm|m4v|mov|ogv)$/i;

const text = (max) => z.string().trim().max(max);
const optionalText = (max) => z.union([text(max), z.literal("")]).optional();
const safeUrl = z.string().trim().max(2048).refine((v) => v.startsWith("/") || /^https?:\/\//i.test(v), "Must be a relative or http(s) URL");
const imageUrl = z.union([safeUrl, z.literal("")]).optional();
const videoUrl = z.union([
  safeUrl.refine((v) => VIDEO_EXT.test(v.split(/[?#]/)[0]), "Video must be a direct .mp4, .webm, .m4v, .mov or .ogv URL"),
  z.literal(""),
]).optional();
const dedupe = (ids) => [...new Set(ids.filter(Boolean))];

export const reelSchema = z.object({
  id: optionalText(100),
  enabled: z.boolean().optional(),
  published: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
  title: optionalText(120),
  videoUrl,
  coverImage: imageUrl,
  ctaLabel: optionalText(60),
  productIds: z.array(text(100)).max(MAX_PRODUCTS_PER_REEL).transform(dedupe).optional(),
  categoryIds: z.array(text(100)).max(MAX_CATEGORIES_PER_REEL).transform(dedupe).optional(),
});

export const shoppableReelsSchema = z.object({
  eyebrow: optionalText(120),
  title: optionalText(160),
  subtitle: optionalText(300),
  showArrows: z.boolean().optional(),
  reels: z.array(reelSchema).max(MAX_REELS),
});

export const DEFAULT_SHOPPABLE_REELS = {
  eyebrow: "Watch & Shop",
  title: "Shop Our Reels",
  subtitle: "Tap a reel to watch, then shop the pieces you love",
  showArrows: true,
  reels: [],
};

const orderedReels = (reels) => reels
  .map((reel, index) => ({ reel, index }))
  .sort((a, b) => (a.reel.sortOrder ?? 0) - (b.reel.sortOrder ?? 0) || a.index - b.index)
  .map(({ reel }) => reel);

const isLive = (reel) => reel && reel.enabled !== false && reel.published === true && Boolean(reel.videoUrl || reel.coverImage);

// Pure: turns stored settings + a Map of active public products into the public settings.
// Unpublished/disabled reels (and their video URLs) are removed entirely.
export function buildPublicReels(settings, productsById, categoriesById = new Map()) {
  const out = [];
  for (const reel of orderedReels(Array.isArray(settings?.reels) ? settings.reels : [])) {
    if (!isLive(reel)) continue;
    const ids = Array.isArray(reel.productIds) ? reel.productIds.filter(Boolean) : [];
    const products = ids.map((id) => productsById.get(id)).filter(Boolean);
    const catIds = Array.isArray(reel.categoryIds) ? reel.categoryIds.filter(Boolean) : [];
    const categories = catIds.map((id) => categoriesById.get(id)).filter(Boolean);
    // Linked something, but every target is gone/inactive: drop the reel rather than leave a dead CTA.
    if (ids.length + catIds.length > 0 && products.length + categories.length === 0) continue;
    out.push({
      id: reel.id || `reel-${out.length}`,
      title: reel.title || "",
      videoUrl: reel.videoUrl || "",
      coverImage: reel.coverImage || "",
      ctaLabel: reel.ctaLabel || "",
      products,
      categories,
    });
  }
  return { ...settings, reels: out };
}

// One batched query for every product linked from any live reel; minimal public fields only.
export async function resolveReelsSection(section, client = prisma) {
  const settings = section.settings || {};
  const live = (Array.isArray(settings.reels) ? settings.reels : []).filter(isLive);
  const ids = [...new Set(live.flatMap((reel) => (Array.isArray(reel.productIds) ? reel.productIds : [])).filter(Boolean))];
  const map = new Map();
  if (ids.length) {
    const rows = await client.product.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, name: true, slug: true, price: true, images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } } },
    });
    for (const row of rows) map.set(row.id, { id: row.id, name: row.name, slug: row.slug, price: Number(row.price), image: row.images?.[0]?.url || "" });
  }
  const catIds = [...new Set(live.flatMap((reel) => (Array.isArray(reel.categoryIds) ? reel.categoryIds : [])).filter(Boolean))];
  const catMap = new Map();
  if (catIds.length) {
    const rows = await client.category.findMany({
      where: { id: { in: catIds }, isActive: true },
      select: { id: true, name: true, slug: true, image: true },
    });
    for (const row of rows) catMap.set(row.id, { id: row.id, name: row.name, slug: row.slug, image: row.image || "" });
  }
  return buildPublicReels(settings, map, catMap);
}
