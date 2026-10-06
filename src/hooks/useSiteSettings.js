import { useEffect, useState } from "react";
import { fetchSiteSettings } from "../lib/api";
import { lighten, darken, mix } from "../lib/color";

export const DEFAULT_SITE_SETTINGS = {
  general: {
    storeName: "Aadya",
    legalName: "Aadya Lifestyle Private Limited",
    shortDescription: "Aadya is a premium Indian home decor and lifestyle brand celebrating slow craft and artisan traditions.",
    supportEmail: "",
    supportPhone: "",
    businessEmail: "",
    businessPhone: "",
    businessAddress: "",
    businessAddressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    whatsappNumber: "",
    currency: "INR",
    timezone: "Asia/Kolkata",
    GSTIN: "",
    PAN: "",
    CIN: "",
  },
  branding: {
    desktopLogo: "",
    mobileLogo: "",
    secondaryLogo: "",
    favicon: "",
    logoAltText: "Aadya Logo",
    logoWidthDesktop: 140,
    logoWidthMobile: 110,
    logoMaxHeightDesktop: 60,
    logoMaxHeightMobile: 44,
  },
  header: {
    showUtilityBar: true,
    utilityBarItems: [
      { id: "ub-1", enabled: true, title: "Free Shipping on Orders > ₹2,499", icon: "truck", link: "/shipping" },
      { id: "ub-2", enabled: true, title: "Easy 7-Day Returns", icon: "refresh", link: "/returns" },
      { id: "ub-3", enabled: true, title: "100% Secure Checkout", icon: "shield", link: "/faq" },
    ],
    stickyHeader: false,
    showSearch: true,
    searchPlaceholder: "Search brass lamps, ceramics, linen...",
    showAccount: true,
    showWishlist: true,
    showCart: true,
    showCategoryCircles: false,
    showMainNavigation: true,
    headerStyle: "WHITE",
    logoAlignment: "LEFT",
  },
  announcementBar: {
    active: true,
    text: "Free delivery above ₹2,499 • Pan-India Express Shipping • Crafted by Master Indian Artisans",
    linkLabel: "Shop New Arrivals",
    linkUrl: "/new-arrivals",
    backgroundStyle: "CHARCOAL",
    textStyle: "LIGHT",
  },
  footer: {
    brandDescription: "Aadya is a premium Indian home decor and lifestyle brand. We create and curate objects for thoughtful living — celebrating slow craft, natural minerals, and artisan traditions.",
    footerLogo: "",
    newsletterVisibility: true,
    newsletterTitle: "Join the Aadya Inner Circle",
    newsletterSubtitle: "Receive invitations to private seasonal edits, monograph previews, and artisan stories.",
    contactDetails: true,
    socialLinksVisibility: true,
    socialHeading: "Connect With Us",
    paymentIcons: ["Visa", "Mastercard", "RuPay", "UPI", "Razorpay", "COD"],
    footerColumns: [
      {
        id: "fc-1",
        title: "Shop",
        enabled: true,
        sortOrder: 1,
        links: [
          { label: "Home Decor", type: "CUSTOM_URL", url: "/shop" },
          { label: "Handcrafted Decor", type: "CUSTOM_URL", url: "/collections/handcrafted-decor" },
          { label: "Wellness Decor", type: "CUSTOM_URL", url: "/collections/wellness-decor" },
          { label: "Books & Monographs", type: "CUSTOM_URL", url: "/books" },
          { label: "New Arrivals", type: "CUSTOM_URL", url: "/new-arrivals" },
          { label: "Best Sellers", type: "CUSTOM_URL", url: "/best-sellers" },
        ],
      },
      {
        id: "fc-2",
        title: "Help",
        enabled: true,
        sortOrder: 2,
        links: [
          { label: "Track Your Order", type: "CUSTOM_URL", url: "/track-order" },
          { label: "Order History", type: "CUSTOM_URL", url: "/account/orders" },
          { label: "Shipping & Delivery", type: "CUSTOM_URL", url: "/shipping" },
          { label: "Returns & Exchanges", type: "CUSTOM_URL", url: "/returns" },
          { label: "Frequently Asked Questions", type: "CUSTOM_URL", url: "/faq" },
          { label: "Contact Us", type: "CUSTOM_URL", url: "/contact" },
        ],
      },
      {
        id: "fc-3",
        title: "Company & Policies",
        enabled: true,
        sortOrder: 3,
        links: [
          { label: "About Aadya", type: "CUSTOM_URL", url: "/about" },
          { label: "Featured Collections", type: "CUSTOM_URL", url: "/collections" },
          { label: "Privacy Policy", type: "CUSTOM_URL", url: "/privacy" },
          { label: "Terms of Service", type: "CUSTOM_URL", url: "/terms" },
        ],
      },
    ],
  },
  social: {
    instagram: "",
    facebook: "",
    youtube: "",
    pinterest: "",
    linkedin: "",
    twitter: "",
    whatsapp: "",
  },
  appearance: {
    colors: {
      primary: "#B8674A",
      secondary: "#8A9A82",
      accent: "#D98A6C",
      background: "#FFFFFF",
      surface: "#FAF6F0",
      text: "#2B2723",
      mutedText: "#766E65",
      border: "#E5E0D8",
    },
    layout: {
      containerWidth: "1280px",
      sectionSpacing: "4rem",
      pagePadding: "1.5rem",
      cardRadius: "1rem",
      buttonRadius: "9999px",
      inputRadius: "0.75rem",
    },
    typography: {
      headingFont: "Fraunces",
      bodyFont: "Inter",
      headingScale: 1.0,
      bodyScale: 1.0,
    },
  },
  shop: {
    defaultSort: "featured",
    productsPerPage: 12,
    desktopGridColumns: 3,
    tabletGridColumns: 2,
    mobileGridColumns: 1,
    showFilters: true,
    showAvailabilityFilter: true,
    showPriceFilter: true,
    showCategoryFilter: true,
    showCollectionFilter: true,
    showQuickAdd: true,
    showBadges: true,
  },
  productCard: {
    showCategory: true,
    showBrand: true,
    showRatings: true,
    showComparePrice: true,
    showQuickAdd: true,
    showBadges: true,
  },
  shipping: {
    standardShippingAmount: 150,
    freeShippingThreshold: 2499,
    shippingEnabled: true,
  },
  payments: {
    razorpayEnabled: true,
    codEnabled: true,
    razorpayDisplayLabel: "Pay Online via Razorpay (UPI, Cards, NetBanking)",
    codDisplayLabel: "Cash on Delivery (COD)",
  },
  checkout: {
    guestCheckoutEnabled: true,
    requirePhone: true,
    allowDifferentBillingAddress: false,
    showOrderNotes: true,
    termsPageId: "",
    privacyPageId: "",
    shippingPageId: "",
    returnPageId: "",
  },
  supportEmail: "",
  supportPhone: "",
  freeShippingThreshold: 2499,
  standardShippingAmount: 150,
  promoStrip: {
    active: true,
    title: "Get ₹500 off on your first order",
    couponCode: "AADYA500",
    description: "Valid on orders above ₹2,499. Applied at checkout.",
    ctaLabel: "Shop Offer",
    ctaUrl: "/shop",
  },
  heroBanners: [
    {
      id: "hero-1",
      desktopImage: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2000&auto=format&fit=crop",
      mobileImage: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1000&auto=format&fit=crop",
      eyebrow: "Artisan Sanctuary 2026",
      headline: "Decor that Feels Like Home",
      highlightText: "Feels Like Home",
      description: "Discover handcrafted oil lamps, unglazed clay vessels, linen textiles, and slow design monographs.",
      primaryCtaLabel: "Shop Home Decor",
      primaryCtaUrl: "/shop",
      secondaryCtaLabel: "Explore Collections",
      secondaryCtaUrl: "/collections",
      textPosition: "LEFT",
      textTheme: "DARK",
      active: true,
    },
  ],
};

// Canonical default palette — must exactly match the current Aadya branding
// so nothing visually changes when no custom theme is set. This is the
// single source of truth for both the DEFAULT_SITE_SETTINGS.appearance.colors
// object above and the --theme-* CSS variable fallbacks applied below.
export const DEFAULT_THEME_COLORS = {
  primary: "#B8674A",
  secondary: "#8A9A82",
  background: "#FFFFFF",
  text: "#2B2723",
  accent: "#D98A6C",
  surface: "#FAF6F0",
  muted: "#766E65",
  border: "#E5E0D8",
};

/**
 * Derive any theme color that wasn't explicitly set in SiteSettings from the
 * base colors (primary/secondary/background/text), using simple HSL
 * lighten/darken and alpha-mixing. Explicit values always win.
 */
export function deriveThemeColors(colors = {}) {
  const primary = colors.primary || DEFAULT_THEME_COLORS.primary;
  const secondary = colors.secondary || DEFAULT_THEME_COLORS.secondary;
  const background = colors.background || DEFAULT_THEME_COLORS.background;
  const text = colors.text || DEFAULT_THEME_COLORS.text;

  // When primary/secondary/background/text are all still at their Aadya
  // defaults (i.e. nothing custom set), fall back to the exact default
  // values for the derived fields too, so a fresh/empty settings object
  // renders pixel-identical to before this theming system existed. Only
  // once the admin actually customizes the base colors do we compute
  // derived accent/surface/muted/border/etc via HSL lighten/darken or
  // alpha-mixing.
  const isDefaultBase =
    primary === DEFAULT_THEME_COLORS.primary &&
    secondary === DEFAULT_THEME_COLORS.secondary &&
    background === DEFAULT_THEME_COLORS.background &&
    text === DEFAULT_THEME_COLORS.text;

  return {
    primary,
    secondary,
    background,
    text,
    accent: colors.accent || (isDefaultBase ? DEFAULT_THEME_COLORS.accent : lighten(primary, 0.12)),
    surface: colors.surface || (isDefaultBase ? DEFAULT_THEME_COLORS.surface : mix(text, background, 0.03)),
    muted: colors.mutedText || colors.muted || (isDefaultBase ? DEFAULT_THEME_COLORS.muted : mix(text, background, 0.55)),
    border: colors.border || (isDefaultBase ? DEFAULT_THEME_COLORS.border : mix(text, background, 0.12)),
    primaryHover: colors.primaryHover || darken(primary, 0.08),
    primarySoft: colors.primarySoft || mix(primary, background, 0.12),
    secondarySoft: colors.secondarySoft || mix(secondary, background, 0.14),
  };
}

// Applies the storefront theme as CSS custom properties on :root. These
// variables are the single vocabulary for storefront theming — consumed via
// utility classes (.store-bg, .store-text, .store-bg-primary, ...) defined in
// src/index.css, and directly by components like Button. They intentionally
// use the --theme-* prefix (distinct from the Tailwind @theme design tokens
// like --color-terracotta) so admin dashboard styling, which never reads
// --theme-*, is unaffected regardless of what an admin sets here.
export function applyThemeVariables(appearance) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const colors = deriveThemeColors(appearance?.colors || {});

  root.style.setProperty("--theme-primary", colors.primary);
  root.style.setProperty("--theme-secondary", colors.secondary);
  root.style.setProperty("--theme-background", colors.background);
  root.style.setProperty("--theme-surface", colors.surface);
  root.style.setProperty("--theme-text", colors.text);
  root.style.setProperty("--theme-muted", colors.muted);
  root.style.setProperty("--theme-border", colors.border);
  root.style.setProperty("--theme-accent", colors.accent);
  root.style.setProperty("--theme-primary-hover", colors.primaryHover);
  root.style.setProperty("--theme-primary-soft", colors.primarySoft);
  root.style.setProperty("--theme-secondary-soft", colors.secondarySoft);

  // Legacy aliases kept in sync for any not-yet-migrated consumers.
  root.style.setProperty("--color-primary", colors.primary);
  root.style.setProperty("--color-secondary", colors.secondary);
  root.style.setProperty("--color-background", colors.background);
  root.style.setProperty("--color-surface", colors.surface);
  root.style.setProperty("--color-text", colors.text);
  root.style.setProperty("--color-muted", colors.muted);
  root.style.setProperty("--color-border", colors.border);

  if (appearance?.layout) {
    if (appearance.layout.cardRadius) root.style.setProperty("--radius-card", appearance.layout.cardRadius);
    if (appearance.layout.buttonRadius) root.style.setProperty("--radius-button", appearance.layout.buttonRadius);
    if (appearance.layout.inputRadius) root.style.setProperty("--radius-input", appearance.layout.inputRadius);
    if (appearance.layout.containerWidth) root.style.setProperty("--container-max-width", appearance.layout.containerWidth);
  }
}

// Module-level shared store so every component using useSiteSettings() across
// the storefront (Navbar, Footer, homepage, ...) re-renders from the same
// fetched data, and so an admin save can push fresh settings to all of them
// via refreshSiteSettings() without requiring a hard browser refresh.
let sharedSettings = DEFAULT_SITE_SETTINGS;
let hasFetchedOnce = false;
const subscribers = new Set();

function notifySubscribers() {
  subscribers.forEach((cb) => cb(sharedSettings));
}

function loadSiteSettings() {
  try {
    if (typeof fetchSiteSettings !== "function") return Promise.resolve();
    const promise = fetchSiteSettings();
    if (!promise || typeof promise.then !== "function") return Promise.resolve();
    return promise
      .then((res) => {
        if (!res?.data) return;
        sharedSettings = { ...sharedSettings, ...res.data };
        hasFetchedOnce = true;
        if (sharedSettings.appearance) {
          applyThemeVariables(sharedSettings.appearance);
        }
        notifySubscribers();
      })
      .catch(() => {});
  } catch {
    // Silently fall back to DEFAULT_SITE_SETTINGS if api mock omits fetchSiteSettings in test suite
    return Promise.resolve();
  }
}

// Call after any admin save that touches site settings (branding, header,
// footer, appearance, ...) so already-mounted storefront components pick up
// the change immediately instead of requiring a server restart or a hard
// browser refresh.
export function refreshSiteSettings() {
  return loadSiteSettings();
}

export function useSiteSettings() {
  const [settings, setSettings] = useState(sharedSettings);

  useEffect(() => {
    subscribers.add(setSettings);
    if (!hasFetchedOnce) {
      loadSiteSettings();
    } else {
      setSettings(sharedSettings);
    }
    return () => {
      subscribers.delete(setSettings);
    };
  }, []);

  return settings;
}

