import { z } from "zod";
import { ApiError } from "../../utils/ApiError.js";

export const SAFE_ICONS = ["sparkles", "badge", "home", "shield", "leaf", "heart"];
const safeUrl = z.string().trim().max(2048).refine((value) => value.startsWith("/") || /^https?:\/\//i.test(value), "Must be a relative or http(s) URL");
const optionalUrl = z.union([safeUrl, z.literal("")]).optional();
const text = (max) => z.string().trim().max(max);
const optionalText = (max) => z.union([text(max), z.literal("")]).optional();
// One spacing vocabulary for every homepage section (stored as `settings.spacing`).
export const SECTION_SPACING = ["COMPACT", "NORMAL", "SPACIOUS"];
const spacing = z.enum(SECTION_SPACING).optional();
const item = z.object({ id: optionalText(100), enabled: z.boolean().optional(), sortOrder: z.number().int().min(0).max(1000).optional() });

const rawSchemas = {
  TRUST_STRIP: z.object({
    background: z.enum(["SURFACE", "PLAIN"]).optional(),
    showDividers: z.boolean().optional(),
    desktopColumns: z.number().int().min(2).max(4).optional(),
    mobileLayout: z.enum(["STACKED", "GRID", "SCROLL"]).optional(),
    items: z.array(item.extend({ title: text(120), description: text(300), icon: z.enum(SAFE_ICONS) })).min(1).max(8),
  }),
  SHOP_THE_LOOK: z.object({ eyebrow: optionalText(120), title: optionalText(160), ctaLabel: optionalText(80), items: z.array(item.extend({ title: text(120), tagline: optionalText(240), image: optionalUrl, imageAlt: optionalText(240), targetType: z.enum(["COLLECTION", "CATEGORY", "PAGE", "CUSTOM_URL"]).optional(), targetId: optionalText(100), url: optionalUrl })).max(12) }),
  NEW_ARRIVALS: z.object({ eyebrow: optionalText(120), title: optionalText(160), subtitle: optionalText(300), ctaLabel: optionalText(80), ctaUrl: optionalUrl, showCta: z.boolean().optional(), showArrows: z.boolean().optional(), limit: z.number().int().min(1).max(24).optional(), sourceMode: z.enum(["AUTO", "MANUAL"]).optional(), productIds: z.array(text(100)).max(24).optional() }),
  BEST_SELLERS: z.object({ eyebrow: optionalText(120), title: optionalText(160), subtitle: optionalText(300), ctaLabel: optionalText(80), ctaUrl: optionalUrl, showCta: z.boolean().optional(), showArrows: z.boolean().optional(), limit: z.number().int().min(1).max(24).optional(), sourceMode: z.enum(["AUTO", "MANUAL"]).optional(), productIds: z.array(text(100)).max(24).optional() }),
  BOOKS_SHELF: z.object({ eyebrow: optionalText(120), title: optionalText(160), ctaLabel: optionalText(80), ctaUrl: optionalUrl, limit: z.number().int().min(1).max(24).optional(), showAuthor: z.boolean().optional(), showPrice: z.boolean().optional(), showDescription: z.boolean().optional() }),
  FEATURED_COLLECTION: z.object({ eyebrow: optionalText(120), title: optionalText(160), description: optionalText(1000), ctaLabel: optionalText(80), ctaUrl: optionalUrl, collectionId: optionalText(100), backgroundStyle: z.enum(["IVORY", "WHITE"]).optional() }),
  EDITORIAL_BRAND: z.object({ eyebrow: optionalText(120), title: optionalText(200), body: optionalText(3000), image: optionalUrl, imageAlt: optionalText(240), features: z.array(item.extend({ title: text(120), description: optionalText(400), accent: z.enum(["PRIMARY", "SAGE"]).optional() })).max(6), productId: optionalText(100), ctaEnabled: z.boolean().optional(), ctaLabel: optionalText(80), ctaAction: z.enum(["VIEW_PRODUCT", "ADD_TO_CART", "BUY_NOW"]).optional() }),
  NEWSLETTER: z.object({ eyebrow: optionalText(120), title: optionalText(200), description: optionalText(1000), placeholder: optionalText(160), buttonLabel: optionalText(80), loadingLabel: optionalText(80), successMessage: optionalText(300), errorPrefix: optionalText(160) }),
  // Curated / editorial banners: 2-column on desktop, stacked on mobile.
  PROMO_BANNERS_2UP: z.object({ items: z.array(item.extend({ eyebrow: optionalText(120), title: text(160), subtitle: optionalText(500), ctaLabel: optionalText(80), ctaUrl: optionalUrl, image: optionalUrl, mobileImage: optionalUrl, imageAlt: optionalText(240), textAlign: z.enum(["LEFT", "CENTER", "RIGHT"]).optional(), overlayStrength: z.enum(["NONE", "LIGHT", "MEDIUM", "STRONG"]).optional() })).max(8) }),
  // `averageRating` / `reviewCount` are optional overrides; when omitted the storefront shows the real approved-review aggregate.
  TESTIMONIALS: z.object({ eyebrow: optionalText(120), title: optionalText(160), averageRating: z.number().min(0).max(5).nullable().optional(), reviewCount: z.number().int().min(0).max(10000000).nullable().optional(), motion: z.enum(["STATIC", "SLIDER", "MARQUEE"]).optional(), speed: z.number().int().min(10).max(300).optional(), pauseOnHover: z.boolean().optional(), showVerifiedBadge: z.boolean().optional(), limit: z.number().int().min(1).max(24).optional() }),
  BLOG_PREVIEW: z.object({ eyebrow: optionalText(120), title: optionalText(160), limit: z.number().int().min(1).max(12).optional(), showExcerpt: z.boolean().optional(), showAuthor: z.boolean().optional(), showDate: z.boolean().optional(), showReadingTime: z.boolean().optional(), showViewAll: z.boolean().optional(), viewAllUrl: optionalUrl }),
};

// Every section type accepts the shared `spacing` setting.
const schemas = Object.fromEntries(Object.entries(rawSchemas).map(([type, schema]) => [type, schema.extend({ spacing })]));

export const DEFAULT_HOMEPAGE_CONTENT = {
  TRUST_STRIP: { background: "SURFACE", showDividers: true, desktopColumns: 4, mobileLayout: "STACKED", spacing: "NORMAL", items: [
    { id: "trust-1", title: "Thoughtfully Curated", description: "Hand-selected slow design objects for mindful living", icon: "sparkles", enabled: true, sortOrder: 1 },
    { id: "trust-2", title: "Premium Quality", description: "Authentic materials from Indian craft clusters", icon: "badge", enabled: true, sortOrder: 2 },
    { id: "trust-3", title: "Styles for Every Space", description: "Proportions tailored for modern and traditional homes", icon: "home", enabled: true, sortOrder: 3 },
    { id: "trust-4", title: "Secure Payments", description: "100% encrypted checkout & Pan-India express dispatch", icon: "shield", enabled: true, sortOrder: 4 },
  ] },
  NEW_ARRIVALS: { limit: 4, eyebrow: "Fresh Drops", title: "New Arrivals", subtitle: "", ctaLabel: "View All New Arrivals", ctaUrl: "/new-arrivals", showCta: true, showArrows: false },
  BEST_SELLERS: { limit: 4, eyebrow: "Most Cherished", title: "Best Sellers", ctaLabel: "View All Best Sellers", ctaUrl: "/best-sellers" },
  FEATURED_COLLECTION: { eyebrow: "Featured Editorial Collection", ctaLabel: "Explore Collection", backgroundStyle: "IVORY" },
  SHOP_THE_LOOK: { eyebrow: "Lifestyle Inspiration", title: "Shop the Look", ctaLabel: "View Edit", items: [
    { id: "look-1", title: "Living Room Edit", tagline: "Brass Sconces & Woven Throws", image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?q=80&w=800&auto=format&fit=crop", targetType: "CUSTOM_URL", url: "/collections/home-decor", enabled: true, sortOrder: 1 },
    { id: "look-2", title: "Mindful Corner", tagline: "Soapstone Urns & Sandalwood", image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?q=80&w=800&auto=format&fit=crop", targetType: "CUSTOM_URL", url: "/collections/wellness-decor", enabled: true, sortOrder: 2 },
    { id: "look-3", title: "Warm Neutrals", tagline: "Terracotta Clay & Linen Runners", image: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?q=80&w=800&auto=format&fit=crop", targetType: "CUSTOM_URL", url: "/collections/earth-collection", enabled: true, sortOrder: 3 },
    { id: "look-4", title: "Books & Objects", tagline: "Heritage Monographs & Wood Pedestals", image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop", targetType: "CUSTOM_URL", url: "/books", enabled: true, sortOrder: 4 },
  ] },
  BOOKS_SHELF: { eyebrow: "Editorial Monographs", title: "From Our Bookshelf", ctaLabel: "Explore Books", ctaUrl: "/books", limit: 3, showAuthor: true, showPrice: true, showDescription: true },
  EDITORIAL_BRAND: { eyebrow: "Craftsmanship & Mindful Living", title: "Honoring Earth, Metal & Human Hands", body: "Every piece in the Aadya collection originates in quiet Indian artisan workshops. From lost-wax Dhokra bronze figurines in Odisha to Jaipur blue pottery and hand-chased brassware, our objects carry stories of patience, sustainable raw materials, and sacred proportions.", image: "https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=1200&auto=format&fit=crop", imageAlt: "Aadya Editorial Interior", features: [{ id: "feature-1", title: "100% Organic", description: "Natural clays, unbleached flax, solid brass and mineral oxides.", accent: "PRIMARY" }, { id: "feature-2", title: "Artisan Direct", description: "Supporting rural weaver and metalsmith craft clusters.", accent: "SAGE" }], productId: "", ctaEnabled: true, ctaLabel: "Buy Now", ctaAction: "BUY_NOW" },
  NEWSLETTER: { eyebrow: "Join Our Circle", title: "Stories of Craft & New Arrivals", description: "Subscribe to receive quiet reflections, artisan spotlights, and early access to limited edition seasonal drops.", placeholder: "Enter your email address", buttonLabel: "Subscribe", loadingLabel: "Subscribing…", successMessage: "Thank you for subscribing to Aadya! We look forward to sharing our journey with you.", errorPrefix: "Unable to subscribe:" },
  TESTIMONIALS: { eyebrow: "Loved by Our Customers", title: "What Our Customers Say", averageRating: null, reviewCount: null, motion: "STATIC", speed: 60, pauseOnHover: true, showVerifiedBadge: true, limit: 6 },
  BLOG_PREVIEW: { eyebrow: "The Journal", title: "Stories from Aadya", limit: 3, showExcerpt: true, showAuthor: true, showDate: true, showReadingTime: true, showViewAll: true, viewAllUrl: "/blog" },
  PROMO_BANNERS_2UP: { items: [
    { id: "promo-1", eyebrow: "Curated Edit", title: "Warm Neutrals", subtitle: "Unglazed Clay & Linen Textiles", image: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?q=80&w=1000&auto=format&fit=crop", ctaLabel: "Shop Collection", ctaUrl: "/collections/earth-collection", enabled: true, sortOrder: 1 },
    { id: "promo-2", eyebrow: "Curated Edit", title: "Gift Edit", subtitle: "Handcrafted Heritage Objects", image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=1000&auto=format&fit=crop", ctaLabel: "Explore Gifts", ctaUrl: "/collections/gifts", enabled: true, sortOrder: 2 },
  ] },
};

export function mergeMissingSettings(type, current = {}) {
  const defaults = DEFAULT_HOMEPAGE_CONTENT[type];
  if (!defaults) return current || {};
  const merged = { ...defaults, ...(current || {}) };
  if (Array.isArray(defaults.items) && (!Array.isArray(current?.items) || current.items.length === 0)) merged.items = defaults.items;
  return merged;
}

export function settingsEqual(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => settingsEqual(value, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && settingsEqual(left[key], right[key]));
}

export function validateHomepageSettings(type, settings) {
  const schema = schemas[type];
  if (!schema) return settings ?? {};
  const result = schema.safeParse(settings ?? {});
  if (!result.success) throw ApiError.badRequest(result.error.issues.map((issue) => issue.message).join(", "));
  const data = result.data;
  // Normalize productIds: de-duplicate while preserving order, drop empty entries.
  if (Array.isArray(data.productIds)) {
    const seen = new Set();
    data.productIds = data.productIds.filter((id) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  return data;
}
