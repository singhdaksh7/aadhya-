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

/** Thumbnail for tiles/menus: inherited image, else the resolved desktop banner, else null (neutral fallback). */
export function resolveCategoryThumb(category, byId) {
  return resolveCategoryImage(category, byId) || resolveCategoryBanner(category, byId).desktop || null;
}
