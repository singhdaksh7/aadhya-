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

  circularCategories: {
    enabled: false, // off by default; primary nav + mega menus drive category discovery
    mode: "AUTO", // "AUTO" | "MANUAL"
    maxItems: 12,
    desktopSize: "medium", // "small" | "medium" | "large"
    mobileSize: "medium",
    showLabels: true,
    maxLabelLines: 2,
    showArrows: true,
    showPartialNextMobile: true,
    spacingDensity: "comfortable",
    showDividers: true,
    backgroundMode: "surface",
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
  const circularEnabled = rawCircular.enabled !== undefined
    ? rawCircular.enabled
    : (h.showCircularCategories !== undefined ? h.showCircularCategories : (h.showCategoryCircles !== undefined ? h.showCategoryCircles : false));
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
      enabled: h.megaMenu?.enabled !== undefined ? h.megaMenu.enabled : enableMegaMenu,
      columns: Math.min(5, Math.max(2, Number(h.megaMenu?.columns ?? 4))),
      promoCard: {
        ...DEFAULT_HEADER_CMS_SETTINGS.megaMenu.promoCard,
        ...(h.megaMenu?.promoCard || {}),
      },
    },

    circularCategories: {
      ...DEFAULT_HEADER_CMS_SETTINGS.circularCategories,
      ...rawCircular,
      enabled: circularEnabled,
      maxItems: circularLimit,
      showArrows: circularArrows,
      mode: rawCircular.mode === "MANUAL" ? "MANUAL" : "AUTO",
      items: Array.isArray(rawCircular.items) ? rawCircular.items : [],
    },

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
  return {
    ...h,
    stickyMode: STOREFRONT_STICKY_MODE,
    promoTicker: { ...h.promoTicker, speed: clampNumber(h.promoTicker?.speed, 10, 300, 90) },
    megaMenu: { ...h.megaMenu, columns: Math.round(clampNumber(h.megaMenu?.columns, 2, 5, 4)) },
    circularCategories: {
      ...h.circularCategories,
      maxItems: Math.round(clampNumber(h.circularCategories?.maxItems, 1, 24, 12)),
    },
  };
}
