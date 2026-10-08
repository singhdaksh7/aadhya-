// Admin-driven faceted filtering. The admin stores per-category filter groups in site settings
// (`catalogFilters.categories`); this module resolves the config that applies to a category and builds
// the facet options/counts from the real loaded products. Nothing here knows category names.

export const GROUP_TYPES = ["CATEGORY", "COLLECTION", "PRICE", "AVAILABILITY", "ATTRIBUTE", "BRAND", "BOOK_AUTHOR", "BOOK_LANGUAGE", "BOOK_FORMAT", "BOOK_PUBLISHER"];
export const FACET_TYPES = new Set(["ATTRIBUTE", "BRAND", "BOOK_AUTHOR", "BOOK_LANGUAGE", "BOOK_FORMAT", "BOOK_PUBLISHER"]);

const DEFAULT_LABELS = {
  CATEGORY: "Category", COLLECTION: "Collection", PRICE: "Price", AVAILABILITY: "Availability",
  BRAND: "Brand / Maker", BOOK_AUTHOR: "Author", BOOK_LANGUAGE: "Language", BOOK_FORMAT: "Format", BOOK_PUBLISHER: "Publisher",
};

/** The sensible default set used by every category without a custom config. */
export const DEFAULT_GROUPS = [
  { id: "category", type: "CATEGORY" },
  { id: "collection", type: "COLLECTION" },
  { id: "price", type: "PRICE" },
  { id: "availability", type: "AVAILABILITY" },
];

function normalizeGroup(group, index) {
  const facet = FACET_TYPES.has(group.type);
  return {
    id: group.id || `${group.type}-${index}`,
    type: group.type,
    attributeKey: group.attributeKey || "",
    label: (group.label && group.label.trim()) || (group.type === "ATTRIBUTE" ? group.attributeKey : DEFAULT_LABELS[group.type]) || group.type,
    enabled: group.enabled !== false,
    order: Number.isFinite(group.order) ? group.order : index,
    defaultOpen: group.defaultOpen ?? group.type === "CATEGORY",
    selection: group.selection || (facet ? "MULTI" : "SINGLE"),
    showDesktop: group.showDesktop !== false,
    showMobile: group.showMobile !== false,
  };
}

/**
 * Filter groups for a category: its own config, else the nearest ancestor config that applies to
 * subcategories, else the default set. Returns normalized, enabled groups in display order.
 */
export function resolveFilterGroups({ settings, categories, categorySlug }) {
  const configs = settings?.catalogFilters?.categories;
  let raw = null;
  if (Array.isArray(configs) && configs.length && categorySlug) {
    const byId = new Map((categories || []).map((c) => [c.id, c]));
    let cur = (categories || []).find((c) => c.slug === categorySlug);
    let depth = 0;
    const seen = new Set();
    while (cur && !seen.has(cur.id) && !raw) {
      seen.add(cur.id);
      const entry = configs.find((c) => c.categoryId === cur.id);
      if (entry && (depth === 0 || entry.applyToSubcategories !== false) && Array.isArray(entry.groups) && entry.groups.length) raw = entry.groups;
      cur = cur.parentId ? byId.get(cur.parentId) : null;
      depth += 1;
    }
  }
  return (raw || DEFAULT_GROUPS)
    .map(normalizeGroup)
    .filter((g) => g.enabled)
    .sort((a, b) => a.order - b.order);
}

const clean = (v) => (typeof v === "string" ? v.trim() : "");
const FORMAT_LABELS = { PHYSICAL: "Physical", PDF: "Digital (PDF)" };
const humanize = (v) => String(v).replace(/[_-]+/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Facet values a product has for a group (always an array of non-empty strings). */
export function facetValues(product, group) {
  let raw = [];
  switch (group.type) {
    case "ATTRIBUTE": {
      const wanted = group.attributeKey.toLowerCase();
      const attrs = product.attributes && typeof product.attributes === "object" ? product.attributes : {};
      const hit = Object.keys(attrs).find((k) => k.toLowerCase() === wanted);
      if (hit) raw = [attrs[hit]];
      else if (wanted === "material" || wanted === "materials") raw = [product.materials];
      break;
    }
    case "BRAND": raw = [product.brand]; break;
    case "BOOK_AUTHOR": raw = [product.bookDetail?.author]; break;
    case "BOOK_LANGUAGE": raw = [product.bookDetail?.language]; break;
    case "BOOK_PUBLISHER": raw = [product.bookDetail?.publisher]; break;
    case "BOOK_FORMAT": raw = (product.bookFormats || []).map((f) => FORMAT_LABELS[f.format] || humanize(f.format)); break;
    default: break;
  }
  const values = raw.flatMap((v) => (group.type === "ATTRIBUTE" ? String(v ?? "").split(",") : [v])).map(clean).filter(Boolean);
  return [...new Set(values)];
}

/** Does a product pass the selections of one facet group? (no selection = passes) */
function passes(product, group, selected) {
  if (!selected || selected.length === 0) return true;
  const have = facetValues(product, group);
  return selected.some((s) => have.includes(s));
}

export function applyFacetSelections(products, groups, selections) {
  const facets = groups.filter((g) => FACET_TYPES.has(g.type));
  return products.filter((p) => facets.every((g) => passes(p, g, selections[g.id])));
}

/**
 * Options + accurate counts for every facet group. Counts for a group ignore that group's own
 * selection (so alternatives stay visible) but respect every other group's. Zero-count options
 * are dropped unless they are currently selected.
 */
export function buildFacetOptions(products, groups, selections) {
  const facets = groups.filter((g) => FACET_TYPES.has(g.type));
  const out = {};
  facets.forEach((group) => {
    const others = facets.filter((g) => g.id !== group.id);
    const pool = products.filter((p) => others.every((g) => passes(p, g, selections[g.id])));
    const counts = new Map();
    pool.forEach((p) => facetValues(p, group).forEach((v) => counts.set(v, (counts.get(v) || 0) + 1)));
    (selections[group.id] || []).forEach((v) => { if (!counts.has(v)) counts.set(v, 0); });
    out[group.id] = [...counts.entries()]
      .filter(([value, count]) => count > 0 || (selections[group.id] || []).includes(value))
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  });
  return out;
}

/** Toggle a facet value honouring the group's single / multi selection mode. */
export function toggleFacetValue(selections, group, value) {
  const current = selections[group.id] || [];
  const has = current.includes(value);
  const next = group.selection === "SINGLE" ? (has ? [] : [value]) : (has ? current.filter((v) => v !== value) : [...current, value]);
  return { ...selections, [group.id]: next };
}

/** Drop selections for groups that no longer exist or values that are not available any more. */
export function pruneSelections(selections, groups, options) {
  const next = {};
  Object.entries(selections).forEach(([id, values]) => {
    const group = groups.find((g) => g.id === id);
    if (!group || !values.length) return;
    const available = new Set((options[id] || []).map((o) => o.value));
    const kept = values.filter((v) => available.has(v));
    if (kept.length) next[id] = kept;
  });
  return next;
}
