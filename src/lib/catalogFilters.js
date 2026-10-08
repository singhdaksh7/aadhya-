// Context-aware category filtering for the storefront catalog. Everything is derived from the
// flat categories list (parentId relationships) - no category names are hardcoded.

const activeOnly = (categories) => (Array.isArray(categories) ? categories : []).filter((c) => c && c.isActive !== false);

/** Top-most ancestor of `category` (the category itself when it is a root). */
export function rootOfCategory(category, byId) {
  let cur = category;
  const seen = new Set();
  while (cur && cur.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = byId.get(cur.parentId);
  }
  return cur || null;
}

/** parentId -> active children, ordered by sortOrder then name. */
export function childrenIndex(categories) {
  const map = new Map();
  activeOnly(categories).forEach((c) => {
    const key = c.parentId || null;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(c);
  });
  map.forEach((list) => list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name).localeCompare(String(b.name))));
  return map;
}

/** Set of ids for `categoryId` and every active descendant. */
export function subtreeIds(categoryId, categories) {
  const kids = childrenIndex(categories);
  const ids = new Set();
  const walk = (id) => {
    if (ids.has(id)) return;
    ids.add(id);
    (kids.get(id) || []).forEach((child) => walk(child.id));
  };
  if (categoryId) walk(categoryId);
  return ids;
}

/**
 * Flat, depth-annotated options for the Category filter.
 * - `contextSlug` set: only that category's ROOT subtree is listed (never unrelated roots).
 * - no context (e.g. /shop): every root and its subtree.
 * Counts are the number of loaded products inside each node's subtree. Once products are loaded,
 * nodes with no products are hidden unless they are currently selected.
 */
export function buildCategoryOptions({ categories, contextSlug, products, productsLoaded, selectedSlug }) {
  const list = activeOnly(categories);
  const byId = new Map(list.map((c) => [c.id, c]));
  const kids = childrenIndex(list);
  const context = contextSlug ? list.find((c) => c.slug === contextSlug) : null;
  const roots = context ? [rootOfCategory(context, byId)].filter(Boolean) : (kids.get(null) || []);
  const countOf = new Map();
  (products || []).forEach((p) => { if (p.categoryId) countOf.set(p.categoryId, (countOf.get(p.categoryId) || 0) + 1); });
  const total = (node) => (countOf.get(node.id) || 0) + (kids.get(node.id) || []).reduce((sum, child) => sum + total(child), 0);

  const out = [];
  const visit = (node, depth, seen) => {
    if (seen.has(node.id)) return;
    const count = total(node);
    if (productsLoaded && count === 0 && node.slug !== selectedSlug) return;
    out.push({ id: node.id, slug: node.slug, name: node.name, depth, count });
    (kids.get(node.id) || []).forEach((child) => visit(child, depth + 1, new Set([...seen, node.id])));
  };
  roots.forEach((root) => visit(root, 0, new Set()));
  return out;
}

/** Highest sensible price slider bound for the loaded products, in steps of 250 (min 1000). */
export function priceCeiling(products) {
  const top = (products || []).reduce((max, p) => Math.max(max, Number(p.salePrice ?? p.price) || 0), 0);
  return Math.max(1000, Math.ceil(top / 250) * 250);
}
