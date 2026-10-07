import { formatInr } from "./format";

// The customer storefront header is never sticky. `stickyMode` stays in the stored
// contract for backward compatibility but is always normalized to this value, and the
// admin UI presents it as read-only rather than as an editable control.
export const STOREFRONT_STICKY_MODE = "none";

export const DEFAULT_HEADER_CMS_SETTINGS = {
  enabled: true,
  stickyMode: STOREFRONT_STICKY_MODE,
  showDivider: true,
  backgroundMode: "surface", // "surface" | "transparent"
  spacingMode: "comfortable", // "compact" | "comfortable"

  utilityBar: {
    enabled: true,
    centerMessageEnabled: true,
    centerMessage: "Get ₹500 off on your first purchase above ₹2,999",
    centerMessageLink: "/shop",
    centerMessageIcon: "sparkle",
    showDesktop: true,
    showMobile: false,
    items: [
      {
        id: "ub-1",
        enabled: true,
        label: "Free Shipping {{freeShippingThreshold}}+",
        icon: "truck",
        linkType: "internal",
        url: "/shipping",
        openInNewTab: false,
        showDesktop: true,
        showMobile: false,
        sortOrder: 1,
      },
      {
        id: "ub-2",
        enabled: true,
        label: "Easy 7-Day Returns",
        icon: "returns",
        linkType: "internal",
        url: "/returns",
        openInNewTab: false,
        showDesktop: true,
        showMobile: false,
        sortOrder: 2,
      },
      {
        id: "ub-3",
        enabled: true,
        label: "100% Secure Checkout",
        icon: "shield",
        linkType: "internal",
        url: "/faq",
        openInNewTab: false,
        showDesktop: true,
        showMobile: false,
        sortOrder: 3,
      },
      {
        id: "ub-4",
        enabled: true,
        label: "Track Order",
        icon: "location",
        linkType: "internal",
        url: "/track-order",
        openInNewTab: false,
        showDesktop: true,
        showMobile: true,
        sortOrder: 4,
      },
      {
        id: "ub-5",
        enabled: true,
        label: "Help & FAQ",
        icon: "help",
        linkType: "internal",
        url: "/faq",
        openInNewTab: false,
        showDesktop: true,
        showMobile: true,
        sortOrder: 5,
      },
    ],
  },

  promoTicker: {
    enabled: true,
    speed: 90,
    direction: "left", // "left" | "right"
    pauseOnHover: true,
    separator: "dot", // "dot" | "diamond" | "line" | "none"
    showCouponCode: true,
    showCta: true,
    showIcon: true,
    desktopEnabled: true,
    mobileEnabled: true,
    maxVisiblePromos: 10,
    background: "primary", // "primary" | "secondary"
    textContrastMode: "light", // "light" | "dark"
    hideWhenEmpty: true,
    fallbackMessage: "Crafted by Master Indian Artisans • Free Delivery Above ₹2,499",
  },

  mainHeader: {
    showSearch: true,
    searchPlaceholder: "Search products...",
    searchDesktopMode: "inline", // "inline" | "icon"
    mobileSearch: "icon", // "icon" | "drawer"
    showAccount: true,
    accountLabel: "Account",
    showWishlist: true,
    showCart: true,
    showCartCount: true,
    logoAlignment: "center", // "center" | "left"
  },

  primaryNav: {
    enabled: true,
    mode: "AUTO", // "AUTO" | "MANUAL"
    showBadges: true,
    showNewBadge: true,
    enableMegaMenu: true,
    items: [],
  },

  megaMenu: {
    enabled: true,
    dropdownWidth: "full", // "full" | "contained"
    columns: 4,
    mode: "AUTO_FROM_CATEGORY", // "AUTO_FROM_CATEGORY" | "MANUAL" | "DISABLED"
    promoCard: {
      enabled: true,
      image: "",
      mobileImage: "",
      eyebrow: "Curated Edit",
      title: "Artisan Craftsmanship",
      description: "Handcrafted slow-living objects for modern spaces.",
      ctaLabel: "Shop Now",
      ctaUrl: "/shop",
      altText: "Promo card",
      promoSource: "custom", // "category" | "collection" | "custom" | "none"
    },
  },

  // Category scroller strip (key kept as `circularCategories` for backward compatibility).
  // Only `enabled === true` turns it on; legacy flags (showCategoryCircles, ...) never do.
  circularCategories: {
    enabled: false,
    shape: "CIRCLE", // "CIRCLE" | "SQUARE" | "ROUNDED_SQUARE" | "RECTANGLE"
    mode: "AUTO", // "AUTO" | "MANUAL"
    sortBy: "CATEGORY_ORDER", // AUTO only: "CATEGORY_ORDER" | "NAME"
    categoryDepth: "ROOT", // AUTO only: "ROOT" (root categories) | "ALL" (include subcategories)
    maxItems: 12,
    showDesktop: true,
    showMobile: true,
    desktopSize: "medium", // "small" | "medium" | "large"
    mobileSize: "medium",
    imageFit: "cover", // "cover" | "contain"
    showLabels: true,
    showArrows: true,
    showPartialNextMobile: true,
    spacingDensity: "comfortable", // "compact" | "comfortable"
    backgroundMode: "surface", // "surface" | "soft"
    showTopSeparator: true, // 1px line between the Primary Navigation and the strip
    showBottomSeparator: true, // 1px line between the strip and the content below
    items: [],
  },

  mobile: {
    showUtilityBar: false,
    showTicker: true,
    showCategoryStrip: false,
    showSearch: true,
    showCart: true,
    showAccount: true,
    drawerTitle: "Menu",
    expandCategoriesByDefault: false,
    showAccordionChildren: true,
    showPromoBlock: true,
    showSocialLinks: true,
  },
};

export function isSafeUrl(url) {
  if (!url || typeof url !== "string") return true;
  // Browsers ignore control chars/whitespace inside the scheme (e.g. "java\tscript:")
  // oxlint-disable-next-line no-control-regex
  const trimmed = url.replace(/[\u0000-\u0020\u007f-\u009f]/g, "").toLowerCase();
  if (
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("vbscript:") ||
    trimmed.startsWith("file:")
  ) {
    return false;
  }
  return true;
}

export function interpolateText(template, context = {}) {
  if (!template || typeof template !== "string") return "";
  let result = template;
  if (context.freeShippingThreshold !== undefined) {
    const formatted = formatInr(context.freeShippingThreshold);
    result = result.replace(/\{\{\s*freeShippingThreshold\s*\}\}/g, formatted);
  }
  if (context.storeName) {
    result = result.replace(/\{\{\s*storeName\s*\}\}/g, context.storeName);
  }
  return result;
}

export const STRIP_SHAPES = ["CIRCLE", "SQUARE", "ROUNDED_SQUARE", "RECTANGLE"];
const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

export function normalizeCategoryStrip(raw, overrides = {}) {
  const r = raw || {};
  const d = DEFAULT_HEADER_CMS_SETTINGS.circularCategories;
  // Legacy keys (rootOnly, showDividers, showTopDivider, showBottomDivider) are read below
  // for old saved data but are never part of the canonical output.
  const bool = (key) => (r[key] !== undefined ? r[key] !== false : d[key]);
  // `showDividers` is the legacy bottom-divider flag; explicit canonical keys win.
  const bottomDivider = r.showBottomSeparator !== undefined ? r.showBottomSeparator !== false : r.showBottomDivider !== undefined ? r.showBottomDivider !== false : r.showDividers !== undefined ? r.showDividers !== false : d.showBottomSeparator;
  const topDivider = r.showTopSeparator !== undefined ? r.showTopSeparator !== false : r.showTopDivider !== undefined ? r.showTopDivider !== false : d.showTopSeparator;
  const categoryDepth = oneOf(r.categoryDepth, ["ROOT", "ALL"], r.rootOnly === false ? "ALL" : d.categoryDepth);
  const { rootOnly: _rootOnly, showDividers: _showDividers, showTopDivider: _showTopDivider, showBottomDivider: _showBottomDivider, ...current } = r;
  return {
    ...d,
    ...current,
    enabled: r.enabled === true,
    shape: oneOf(r.shape, STRIP_SHAPES, d.shape),
    mode: r.mode === "MANUAL" ? "MANUAL" : "AUTO",
    sortBy: oneOf(r.sortBy, ["CATEGORY_ORDER", "NAME"], d.sortBy),
    categoryDepth,
    maxItems: overrides.maxItems ?? d.maxItems,
    showDesktop: bool("showDesktop"),
    showMobile: bool("showMobile"),
    desktopSize: oneOf(r.desktopSize, ["small", "medium", "large"], d.desktopSize),
    mobileSize: oneOf(r.mobileSize, ["small", "medium", "large"], d.mobileSize),
    imageFit: oneOf(r.imageFit, ["cover", "contain"], d.imageFit),
    showLabels: bool("showLabels"),
    showArrows: overrides.showArrows ?? d.showArrows,
    showPartialNextMobile: bool("showPartialNextMobile"),
    spacingDensity: oneOf(r.spacingDensity, ["compact", "comfortable"], d.spacingDensity),
    backgroundMode: oneOf(r.backgroundMode, ["surface", "soft"], d.backgroundMode),
    showTopSeparator: topDivider,
    showBottomSeparator: bottomDivider,
    items: (Array.isArray(r.items) ? r.items : []).map((item, i) => ({
      ...item,
      id: item.id || `strip-${i + 1}`,
      enabled: item.enabled !== false,
    })),
  };
}

export function normalizeHeaderSettings(rawHeader, rawShipping, rawGeneral) {
  const h = rawHeader || {};

  // Utility bar normalization & legacy mapping
  const legacyShowUtilityBar = h.showUtilityBar !== undefined ? h.showUtilityBar : true;
  const rawUtilityBar = h.utilityBar || {};
  const utilityEnabled = rawUtilityBar.enabled !== undefined ? rawUtilityBar.enabled : legacyShowUtilityBar;

  let utilityItems = Array.isArray(rawUtilityBar.items) ? [...rawUtilityBar.items] : (
    Array.isArray(h.utilityBarItems) ? [...h.utilityBarItems] : [...DEFAULT_HEADER_CMS_SETTINGS.utilityBar.items]
  );

  // If flat legacy fields exist, apply them onto default items
  if (h.utilityFreeShippingText || h.utilityReturnsText || h.utilitySecureText || h.trackOrderLabel || h.helpLabel) {
    utilityItems = utilityItems.map((item) => {
      if (item.id === "ub-1" && h.utilityFreeShippingText) {
        return { ...item, label: h.utilityFreeShippingText };
      }
      if (item.id === "ub-2" && h.utilityReturnsText) {
        return { ...item, label: h.utilityReturnsText };
      }
      if (item.id === "ub-3" && h.utilitySecureText) {
        return { ...item, label: h.utilitySecureText };
      }
      if (item.id === "ub-4") {
        return {
          ...item,
          label: h.trackOrderLabel || item.label,
          url: h.trackOrderUrl || item.url,
        };
      }
      if (item.id === "ub-5") {
        return {
          ...item,
          label: h.helpLabel || item.label,
          url: h.helpUrl || item.url,
        };
      }
      return item;
    });
  }

  // Legacy items (`utilityBarItems`) used `title`/`link` and an icon named "refresh";
  // the current contract requires `label`, so map them before they are ever re-saved.
  utilityItems = utilityItems.map((item, index) => ({
    ...item,
    id: item.id || `ub-${index + 1}`,
    enabled: item.enabled !== false,
    label: item.label || item.title || "",
    url: item.url ?? item.link ?? "",
    icon: item.icon === "refresh" ? "returns" : item.icon,
  }));

  // Ticker normalization
  const rawTicker = h.promoTicker || {};
  const tickerEnabled = rawTicker.enabled !== undefined
    ? rawTicker.enabled
    : (h.showPromoTicker !== undefined ? h.showPromoTicker : true);
  const tickerSpeed = Math.min(300, Math.max(10, Number(rawTicker.speed ?? h.promoTickerSpeed ?? 90)));
  const tickerPause = rawTicker.pauseOnHover !== undefined
    ? rawTicker.pauseOnHover
    : (h.promoTickerPauseOnHover !== undefined ? h.promoTickerPauseOnHover : true);

  // Primary Nav normalization
  const rawNav = h.primaryNav || {};
  const navEnabled = rawNav.enabled !== undefined
    ? rawNav.enabled
    : (h.showPrimaryNav !== undefined ? h.showPrimaryNav : (h.showMainNavigation !== undefined ? h.showMainNavigation : true));
  const showNewBadge = rawNav.showNewBadge !== undefined ? rawNav.showNewBadge : (h.showNewBadge !== undefined ? h.showNewBadge : true);
  const enableMegaMenu = rawNav.enableMegaMenu !== undefined ? rawNav.enableMegaMenu : (h.enableMegaMenu !== undefined ? h.enableMegaMenu : true);

  // Circular Categories normalization
  const rawCircular = h.circularCategories || {};
  // Legacy flags (showCategoryCircles / showCircularCategories) are intentionally ignored:
  // only the canonical `circularCategories.enabled === true` turns the strip on.
  const circularLimit = Math.min(24, Math.max(1, Number(rawCircular.maxItems ?? h.circularCategoryLimit ?? 12)));
  const circularArrows = rawCircular.showArrows !== undefined
    ? rawCircular.showArrows
    : (h.showCircularCategoryArrows !== undefined ? h.showCircularCategoryArrows : true);

  // Main header normalization
  const rawMainHeader = h.mainHeader || {};
  const showSearch = rawMainHeader.showSearch !== undefined ? rawMainHeader.showSearch : (h.showSearch !== false);
  const searchPlaceholder = rawMainHeader.searchPlaceholder || h.searchPlaceholder || "Search products...";
  const logoAlignment = rawMainHeader.logoAlignment || h.logoAlignment || "center";

  // The customer storefront header is never sticky. Legacy `stickyHeader: true`
  // and any saved `stickyMode` are ignored for live rendering.
  const stickyMode = STOREFRONT_STICKY_MODE;

  return {
    ...DEFAULT_HEADER_CMS_SETTINGS,
    ...h,
    enabled: h.enabled !== false,
    stickyMode,
    showDivider: h.showDivider !== false,
    backgroundMode: h.backgroundMode === "transparent" ? "transparent" : "surface",
    spacingMode: h.spacingMode === "compact" ? "compact" : "comfortable",

    utilityBar: {
      ...DEFAULT_HEADER_CMS_SETTINGS.utilityBar,
      ...rawUtilityBar,
      enabled: utilityEnabled,
      centerMessage: rawUtilityBar.centerMessage || h.utilityBarCenterText || "Get ₹500 off on your first purchase above ₹2,999",
      items: utilityItems,
    },

    promoTicker: {
      ...DEFAULT_HEADER_CMS_SETTINGS.promoTicker,
      ...rawTicker,
      enabled: tickerEnabled,
      speed: tickerSpeed,
      pauseOnHover: tickerPause,
    },

    mainHeader: {
      ...DEFAULT_HEADER_CMS_SETTINGS.mainHeader,
      ...rawMainHeader,
      showSearch,
      searchPlaceholder,
      logoAlignment: logoAlignment.toLowerCase() === "left" ? "left" : "center",
      showAccount: rawMainHeader.showAccount !== undefined ? rawMainHeader.showAccount : (h.showAccount !== false),
      showWishlist: rawMainHeader.showWishlist !== undefined ? rawMainHeader.showWishlist : (h.showWishlist !== false),
      showCart: rawMainHeader.showCart !== undefined ? rawMainHeader.showCart : (h.showCart !== false),
    },

    primaryNav: {
      ...DEFAULT_HEADER_CMS_SETTINGS.primaryNav,
      ...rawNav,
      enabled: navEnabled,
      showNewBadge,
      enableMegaMenu,
      mode: rawNav.mode === "MANUAL" ? "MANUAL" : "AUTO",
      items: Array.isArray(rawNav.items) ? rawNav.items : [],
    },

    megaMenu: {
      ...DEFAULT_HEADER_CMS_SETTINGS.megaMenu,
      ...h.megaMenu,
      // One master switch: off if either the new or the legacy primaryNav flag is off.
      enabled: (h.megaMenu?.enabled !== undefined ? h.megaMenu.enabled : true) && enableMegaMenu,
      columns: Math.min(5, Math.max(2, Number(h.megaMenu?.columns ?? 4))),
      promoCard: {
        ...DEFAULT_HEADER_CMS_SETTINGS.megaMenu.promoCard,
        ...(h.megaMenu?.promoCard || {}),
      },
    },

    circularCategories: normalizeCategoryStrip(rawCircular, { maxItems: circularLimit, showArrows: circularArrows }),

    mobile: {
      ...DEFAULT_HEADER_CMS_SETTINGS.mobile,
      ...(h.mobile || {}),
    },
  };
}

const clampNumber = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// Builds the exact `header` value submitted by the Header CMS: numeric inputs are clamped
// to the ranges the backend validates (a cleared/partial number input must not cause a 400)
// and the storefront-enforced sticky mode is written back explicitly.
export function buildHeaderSavePayload(headerCms) {
  const h = headerCms || {};
  // Legacy strip keys are accepted on read but never written back as canonical config.
  // eslint-disable-next-line no-unused-vars
  const { rootOnly, showDividers, showTopDivider, showBottomDivider, ...strip } = h.circularCategories || {};
  return {
    ...h,
    stickyMode: STOREFRONT_STICKY_MODE,
    promoTicker: { ...h.promoTicker, speed: clampNumber(h.promoTicker?.speed, 10, 300, 90) },
    megaMenu: { ...h.megaMenu, columns: Math.round(clampNumber(h.megaMenu?.columns, 2, 5, 4)) },
    circularCategories: {
      ...strip,
      maxItems: Math.round(clampNumber(h.circularCategories?.maxItems, 1, 24, 12)),
    },
  };
}
