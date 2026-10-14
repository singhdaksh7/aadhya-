// Category banner / image inheritance. The public categories API is a flat list
// (each row has parentId), so ancestors are resolved client-side by walking
// parentId. A category's own asset always wins over an inherited one.

export function buildCategoryIndex(categories = []) {
  const byId = new Map();
  (Array.isArray(categories) ? categories : []).forEach((c) => { if (c && c.id) byId.set(c.id, c); });
  return byId;
}

/** [category, parent, grandparent, ...] — stops on a missing parent or a cycle. */
export function categoryChain(category, byId) {
  const chain = [];
  const seen = new Set();
  let cur = category;
  while (cur && !seen.has(cur.id)) {
    chain.push(cur);
    seen.add(cur.id);
    cur = cur.parentId ? byId.get(cur.parentId) : null;
  }
  return chain;
}

/**
 * desktop: nearest own/ancestor desktopBanner.
 * mobile:  current mobile -> current desktop -> parent mobile -> parent desktop -> ...
 * Returns { desktop, mobile } with null when nothing is set anywhere in the chain.
 */
export function resolveCategoryBanner(category, byId) {
  const chain = categoryChain(category, byId);
  let desktop = null;
  let mobile = null;
  for (const c of chain) {
    if (!desktop && c.desktopBanner) desktop = c.desktopBanner;
    if (!mobile) mobile = c.mobileBanner || c.desktopBanner || null;
  }
  return { desktop, mobile };
}

/** Nearest own/ancestor category image, or null. */
export function resolveCategoryImage(category, byId) {
  for (const c of categoryChain(category, byId)) if (c.image) return c.image;
  return null;
}

/** Own enabled banners of ONE category as slides (multi-banner list first, else the legacy single banner as slide #1). */
export function ownCategoryBanners(c) {
  if (!c) return [];
  const list = Array.isArray(c.banners) ? c.banners : [];
  if (list.length > 0) {
    return list
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b && b.enabled !== false && (b.desktopImage || b.mobileImage))
      .sort((x, y) => (Number(x.b.sortOrder) || 0) - (Number(y.b.sortOrder) || 0) || x.i - y.i)
      .map(({ b, i }) => ({
        id: b.id || `b${i}`,
        desktop: b.desktopImage || b.mobileImage,
        mobile: b.mobileImage || b.desktopImage,
        title: b.title || "",
        subtitle: b.subtitle || "",
        ctaLabel: b.ctaLabel || "",
        ctaUrl: b.ctaUrl || "",
      }));
  }
  if (c.desktopBanner || c.mobileBanner) {
    return [{ id: "legacy", desktop: c.desktopBanner || c.mobileBanner, mobile: c.mobileBanner || c.desktopBanner, title: "", subtitle: "", ctaLabel: "", ctaUrl: "" }];
  }
  return [];
}

/**
 * Carousel slides for a category: the nearest category in the chain (self, parent, ...) with at
 * least one enabled banner supplies the whole set plus its autoplay settings.
 */
export function resolveCategoryBanners(category, byId) {
  for (const c of categoryChain(category, byId)) {
    const slides = ownCategoryBanners(c);
    if (slides.length) {
      return { slides, autoplay: c.bannerAutoplay !== false, intervalMs: Math.min(30000, Math.max(2000, Number(c.bannerIntervalMs) || 5000)), sourceId: c.id };
    }
  }
  return { slides: [], autoplay: false, intervalMs: 5000, sourceId: null };
}

/** Thumbnail for tiles/menus: inherited image, else the resolved desktop banner, else null (neutral fallback). */
export function resolveCategoryThumb(category, byId) {
  return resolveCategoryImage(category, byId) || resolveCategoryBanner(category, byId).desktop || null;
}
