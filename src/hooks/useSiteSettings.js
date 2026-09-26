import { useEffect, useState } from "react";
import { fetchSiteSettings } from "../lib/api";

export const DEFAULT_SITE_SETTINGS = {
  general: {
    storeName: "Aadya",
    legalName: "Aadya Lifestyle Private Limited",
    shortDescription: "Aadya is a premium Indian home decor and lifestyle brand celebrating slow craft and artisan traditions.",
    supportEmail: "concierge@aadyahome.com",
    supportPhone: "+91 (800) 242-3921",
    businessEmail: "contact@aadyahome.com",
    businessPhone: "+91 (800) 242-3921",
    businessAddress: "Craft House, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560038",
    country: "India",
    currency: "INR",
    timezone: "Asia/Kolkata",
    GSTIN: "",
    PAN: "",
    CIN: "",
  },
  branding: {
    desktopLogo: "",
    mobileLogo: "",
    favicon: "",
    logoAltText: "Aadya Logo",
    logoWidthDesktop: 140,
    logoWidthMobile: 110,
  },
  header: {
    showUtilityBar: true,
    utilityBarItems: [
      { id: "ub-1", enabled: true, title: "Free Shipping on Orders > ₹2,499", icon: "truck", link: "/shipping" },
      { id: "ub-2", enabled: true, title: "Easy 7-Day Returns", icon: "refresh", link: "/returns" },
      { id: "ub-3", enabled: true, title: "100% Secure Checkout", icon: "shield", link: "/faq" },
    ],
    stickyHeader: true,
    showSearch: true,
    searchPlaceholder: "Search brass lamps, ceramics, linen...",
    showAccount: true,
    showWishlist: true,
    showCart: true,
    showCategoryCircles: true,
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
    instagram: "https://instagram.com/aadyahome",
    facebook: "https://facebook.com/aadyahome",
    youtube: "https://youtube.com/aadyahome",
    pinterest: "https://pinterest.com/aadyahome",
    linkedin: "",
    twitter: "",
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
  supportEmail: "concierge@aadyahome.com",
  supportPhone: "+91 (800) 242-3921",
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

export function applyThemeVariables(appearance) {
  if (typeof document === "undefined" || !appearance) return;
  const root = document.documentElement;

  if (appearance.colors) {
    if (appearance.colors.primary) root.style.setProperty("--color-primary", appearance.colors.primary);
    if (appearance.colors.secondary) root.style.setProperty("--color-secondary", appearance.colors.secondary);
    if (appearance.colors.background) root.style.setProperty("--color-background", appearance.colors.background);
    if (appearance.colors.surface) root.style.setProperty("--color-surface", appearance.colors.surface);
    if (appearance.colors.text) root.style.setProperty("--color-text", appearance.colors.text);
    if (appearance.colors.mutedText) root.style.setProperty("--color-muted", appearance.colors.mutedText);
    if (appearance.colors.border) root.style.setProperty("--color-border", appearance.colors.border);
  }

  if (appearance.layout) {
    if (appearance.layout.cardRadius) root.style.setProperty("--radius-card", appearance.layout.cardRadius);
    if (appearance.layout.buttonRadius) root.style.setProperty("--radius-button", appearance.layout.buttonRadius);
    if (appearance.layout.inputRadius) root.style.setProperty("--radius-input", appearance.layout.inputRadius);
    if (appearance.layout.containerWidth) root.style.setProperty("--container-max-width", appearance.layout.containerWidth);
  }
}

export function useSiteSettings() {
  const [settings, setSettings] = useState(DEFAULT_SITE_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    try {
      if (typeof fetchSiteSettings === "function") {
        const promise = fetchSiteSettings();
        if (promise && typeof promise.then === "function") {
          promise
            .then((res) => {
              if (cancelled || !res?.data) return;
              const data = res.data;
              setSettings((prev) => {
                const next = { ...prev, ...data };
                if (next.appearance) {
                  applyThemeVariables(next.appearance);
                }
                return next;
              });
            })
            .catch(() => {});
        }
      }
    } catch {
      // Silently fall back to DEFAULT_SITE_SETTINGS if api mock omits fetchSiteSettings in test suite
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}

