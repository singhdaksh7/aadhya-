import { isSafeUrl } from "./headerCmsHelpers";

/**
 * One normalized navigation structure shared by the desktop primary nav,
 * the mega menu, the mobile drawer and the admin preview.
 *
 * NavItem = {
 *   id, label, to, external, openInNewTab, badge, badgeStyle,
 *   showDesktop, showMobile, megaMode, columns: NavColumn[], promo: NavPromo | null, hasMenu
 * }
 * NavColumn = { id, title, to, links: NavLink[] }
 * NavLink   = { id, label, to, external, openInNewTab }
 */

export const DESTINATION_TYPES = ["CATEGORY", "COLLECTION", "PAGE", "BOOKS", "NEW_ARRIVALS", "CUSTOM_URL"];
export const MEGA_MODES = ["DISABLED", "AUTO_FROM_CATEGORY", "MANUAL"];

const LEGACY_TYPE_MAP = {
  NEW: "NEW_ARRIVALS",
  CUSTOM: "CUSTOM_URL",
  EXTERNAL: "CUSTOM_URL",
  SEARCH: "CUSTOM_URL",
};

export function isExternalUrl(url) {
  return typeof url === "string" && /^(https?:)?\/\/|^(mailto|tel):/i.test(url.trim());
}

export function normalizeDestinationType(type) {
  const key = String(type || "").trim().toUpperCase();
  if (DESTINATION_TYPES.includes(key)) return key;
  return LEGACY_TYPE_MAP[key] || "CUSTOM_URL";
}

function safe(url, fallback = "/") {
  if (typeof url !== "string" || !url.trim()) return fallback;
  return isSafeUrl(url) ? url.trim() : fallback;
}

export function resolveDestination({ type, destination, category }) {
  const dest = typeof destination === "string" ? destination.trim() : "";
  const prefixed = (prefix, fallback) => {
    if (!dest) return fallback;
    return dest.startsWith("/") || isExternalUrl(dest) ? safe(dest, fallback) : `${prefix}${dest}`;
  };
  switch (normalizeDestinationType(type)) {
    case "CATEGORY":
      if (category?.to) return category.to;
      return safe(dest, "/shop");
    case "COLLECTION":
      return prefixed("/collections/", "/collections");
    case "PAGE":
      return prefixed("/pages/", "/");
    case "BOOKS":
      return safe(dest, "/books");
    case "NEW_ARRIVALS":
      return "/new-arrivals";
    default:
      return safe(dest, "/");
  }
}

function makeLink(base, extra = {}) {
  return {
    id: base.id,
    label: base.label,
    to: base.to,
    external: isExternalUrl(base.to),
    openInNewTab: !!base.openInNewTab,
    ...extra,
  };
}

/** Active-only category tree. Children of inactive parents are hidden, order is preserved. */
export function buildCategoryTree(categories = []) {
  const active = (Array.isArray(categories) ? categories : []).filter((c) => c && c.isActive !== false);
  const byId = new Map();
  active.forEach((cat) => {
    byId.set(cat.id, {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      image: cat.image || cat.desktopBanner || null,
      description: cat.description || "",
      to: `/shop/category/${cat.slug}`,
      children: [],
    });
  });
  const roots = [];
  active.forEach((cat) => {
    const node = byId.get(cat.id);
    if (cat.parentId) {
      if (byId.has(cat.parentId)) byId.get(cat.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  const bySlug = new Map();
  byId.forEach((node) => bySlug.set(node.slug, node));
  return { roots, byId, bySlug };
}

function categoryLink(cat) {
  return makeLink({ id: cat.id, label: cat.name, to: cat.to });
}

export function columnsFromCategory(cat, maxColumns = 4) {
  if (!cat || cat.children.length === 0) return [];
  const children = cat.children;
  if (children.some((child) => child.children.length > 0)) {
    return children.map((child) => ({
      id: child.id,
      title: child.name,
      to: child.to,
      links: child.children.map(categoryLink),
    }));
  }
  const numCols = Math.max(1, Math.min(maxColumns, Math.ceil(children.length / 4)));
  const chunkSize = Math.ceil(children.length / numCols);
  const columns = [];
  for (let i = 0; i < children.length; i += chunkSize) {
    columns.push({
      id: `${cat.id}-col-${columns.length}`,
      title: i === 0 ? cat.name : "",
      to: i === 0 ? cat.to : "",
      links: children.slice(i, i + chunkSize).map(categoryLink),
    });
  }
  return columns;
}

export function columnsFromManual(manualColumns = []) {
  if (!Array.isArray(manualColumns)) return [];
  return manualColumns
    .filter((col) => col && col.enabled !== false)
    .map((col, cIdx) => {
      const links = (Array.isArray(col.links) ? col.links : [])
        .filter((l) => l && l.enabled !== false && l.label && l.destination && isSafeUrl(l.destination))
        .map((l, lIdx) =>
          makeLink({
            id: l.id || `${col.id || cIdx}-l-${lIdx}`,
            label: l.label,
            to: l.destination.trim(),
            openInNewTab: l.openInNewTab,
          })
        );
      return { id: col.id || `manual-col-${cIdx}`, title: col.heading || "", to: "", links };
    })
    .filter((col) => col.links.length > 0);
}

function buildPromo({ itemPromo, globalPromo, categoryImage, fallbackTo }) {
  const p = itemPromo && typeof itemPromo === "object" ? itemPromo : null;
  let source = null;
  if (p) {
    if (p.enabled === true && (p.image || p.title)) source = p;
    else if (p.enabled !== true) return null;
  } else if (globalPromo && globalPromo.enabled !== false && globalPromo.image) {
    // Globally configured card (only when it actually has an image)
    source = globalPromo;
  }
  if (!source) return null;
  const image = source.image || (p ? categoryImage : null) || null;
  if (!image && !source.title) return null;
  return {
    image,
    eyebrow: source.eyebrow || "",
    title: source.title || "",
    description: source.description || "",
    ctaLabel: source.ctaLabel || "Shop Now",
    ctaUrl: safe(source.ctaUrl, fallbackTo || "/shop"),
    altText: source.altText || source.title || "",
  };
}

function inferCategorySlug(item) {
  if (item.categorySlug) return item.categorySlug;
  const m = typeof item.destination === "string" && item.destination.match(/^\/shop\/category\/([^/?#]+)/);
  return m ? m[1] : null;
}

function buildManualItems({ configItems, tree, cms }) {
  const megaGlobal = cms.megaMenu || {};
  const columnsCount = megaGlobal.columns || 4;
  return configItems
    .filter((item) => item && item.enabled !== false)
    .map((item, idx) => {
      const type = normalizeDestinationType(item.destinationType);
      const slug = type === "CATEGORY" ? inferCategorySlug(item) : null;
      const category =
        type === "CATEGORY"
          ? (item.categoryId && tree.byId.get(item.categoryId)) || (slug && tree.bySlug.get(slug)) || null
          : null;
      const hasCategoryRef = !!(item.categoryId || slug);

      let megaMode = MEGA_MODES.includes(item.megaMenuMode) ? item.megaMenuMode : null;
      if (!megaMode) {
        megaMode = item.enableMegaMenu === false ? "DISABLED" : hasCategoryRef ? "AUTO_FROM_CATEGORY" : "DISABLED";
      }

      let to = resolveDestination({ type, destination: item.destination, category });
      if (type === "CATEGORY" && !category && item.categorySlug) to = `/shop/category/${item.categorySlug}`;

      let columns = [];
      if (megaMode === "AUTO_FROM_CATEGORY") {
        const source = category || (item.categoryId && tree.byId.get(item.categoryId)) || (slug && tree.bySlug.get(slug)) || null;
        columns = columnsFromCategory(source, columnsCount);
      } else if (megaMode === "MANUAL") {
        columns = columnsFromManual(item.manualColumns);
      }

      const badge = item.badge || (type === "NEW_ARRIVALS" && cms.primaryNav?.showNewBadge !== false ? "NEW" : "");
      const base = makeLink({ id: item.id || `manual-nav-${idx}`, label: item.label, to, openInNewTab: item.openInNewTab });
      return {
        ...base,
        badge,
        badgeStyle: item.badgeStyle || "primary",
        showDesktop: item.showDesktop !== false,
        showMobile: item.showMobile !== false,
        megaMode,
        columns,
        promo: columns.length
          ? buildPromo({ itemPromo: item.promoCard, globalPromo: megaGlobal.promoCard, categoryImage: category?.image, fallbackTo: to })
          : null,
        hasMenu: columns.length > 0,
      };
    });
}

function apiLink(child) {
  const to = child.url || (child.type === "CATEGORY" && child.targetId ? `/shop/category/${child.targetId}` : "#");
  return makeLink({ id: child.id, label: child.title || child.name || child.label, to: safe(to, "/") });
}

function buildApiItems({ navigation, tree, cms }) {
  const megaGlobal = cms.megaMenu || {};
  return navigation.map((item) => {
    const catMatch = tree.byId.get(item.targetId) || tree.bySlug.get(item.targetId) || null;
    const to = safe(
      item.url ||
        (item.type === "CATEGORY"
          ? `/shop/category/${catMatch?.slug || item.targetId}`
          : item.type === "COLLECTION"
            ? `/collections/${item.targetId}`
            : "#"),
      "/"
    );
    let columns = [];
    if (Array.isArray(item.children) && item.children.length > 0) {
      columns = [{ id: `${item.id}-col`, title: item.title, to, links: item.children.filter((c) => c.isActive !== false).map(apiLink) }];
    } else if (catMatch) {
      columns = columnsFromCategory(catMatch, megaGlobal.columns || 4);
    }
    return {
      ...makeLink({ id: item.id, label: item.title, to }),
      badge: item.badgeText || "",
      badgeStyle: "primary",
      showDesktop: true,
      showMobile: true,
      megaMode: columns.length ? "AUTO_FROM_CATEGORY" : "DISABLED",
      columns,
      promo: columns.length ? buildPromo({ itemPromo: null, globalPromo: megaGlobal.promoCard, fallbackTo: to }) : null,
      hasMenu: columns.length > 0,
    };
  });
}

function buildCategoryFallbackItems({ tree, cms }) {
  const megaGlobal = cms.megaMenu || {};
  return tree.roots.map((cat) => {
    const columns = columnsFromCategory(cat, megaGlobal.columns || 4);
    return {
      ...makeLink({ id: cat.id, label: cat.name, to: cat.to }),
      badge: "",
      badgeStyle: "primary",
      showDesktop: true,
      showMobile: true,
      megaMode: columns.length ? "AUTO_FROM_CATEGORY" : "DISABLED",
      columns,
      promo: columns.length ? buildPromo({ itemPromo: null, globalPromo: megaGlobal.promoCard, fallbackTo: cat.to }) : null,
      hasMenu: columns.length > 0,
    };
  });
}

/**
 * Build the nav model. Priority:
 *  1. Admin-configured items (primaryNav.mode === "MANUAL" with enabled items)
 *  2. Navigation API menu (HEADER_MAIN)
 *  3. Active root categories
 */
export function buildNavModel({ cms, categories = [], navigation = [] }) {
  const primary = cms?.primaryNav || {};
  const tree = buildCategoryTree(categories);
  const configured = Array.isArray(primary.items) ? primary.items : [];

  let items;
  if (primary.mode === "MANUAL" && configured.some((i) => i && i.enabled !== false)) {
    items = buildManualItems({ configItems: configured, tree, cms });
  } else if (Array.isArray(navigation) && navigation.length > 0) {
    items = buildApiItems({ navigation, tree, cms });
  } else {
    items = buildCategoryFallbackItems({ tree, cms });
  }

  const menusAllowed =
    primary.enableMegaMenu !== false && cms?.megaMenu?.enabled !== false && cms?.megaMenu?.mode !== "DISABLED";
  if (!menusAllowed) {
    items = items.map((i) => ({ ...i, columns: [], promo: null, hasMenu: false }));
  }
  return items;
}
