import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";

// Hex color validator (#fff or #ffffff)
const colorHexSchema = z.string().regex(/^#([A-Fa-f0-9]{3}){1,2}$/, "Must be a valid hex color code");

export const DEFAULT_SETTINGS = {
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
  supportPhone: "+91 (800) 242-3921",
  supportEmail: "concierge@aadyahome.com",
  freeShippingThreshold: 2499,
  standardShippingAmount: 150,
};

const settingsValidationSchema = z.object({
  general: z.object({
    storeName: z.string().max(100).optional(),
    legalName: z.string().max(150).optional(),
    shortDescription: z.string().max(500).optional(),
    supportEmail: z.string().email().or(z.literal("")).optional(),
    supportPhone: z.string().max(50).optional(),
    businessEmail: z.string().email().or(z.literal("")).optional(),
    businessPhone: z.string().max(50).optional(),
    businessAddress: z.string().max(250).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
    currency: z.string().max(10).optional(),
    timezone: z.string().max(50).optional(),
    GSTIN: z.string().max(30).optional(),
    PAN: z.string().max(30).optional(),
    CIN: z.string().max(30).optional(),
  }).optional(),

  branding: z.object({
    desktopLogo: z.string().max(500).optional(),
    mobileLogo: z.string().max(500).optional(),
    favicon: z.string().max(500).optional(),
    logoAltText: z.string().max(100).optional(),
    logoWidthDesktop: z.number().int().min(40).max(400).optional(),
    logoWidthMobile: z.number().int().min(30).max(300).optional(),
  }).optional(),

  header: z.object({
    showUtilityBar: z.boolean().optional(),
    utilityBarItems: z.array(z.object({
      id: z.string(),
      enabled: z.boolean(),
      title: z.string().max(200),
      subtitle: z.string().max(200).optional(),
      icon: z.string().max(50).optional(),
      link: z.string().max(500).optional(),
      sortOrder: z.number().optional(),
    })).optional(),
    stickyHeader: z.boolean().optional(),
    showSearch: z.boolean().optional(),
    searchPlaceholder: z.string().max(150).optional(),
    showAccount: z.boolean().optional(),
    showWishlist: z.boolean().optional(),
    showCart: z.boolean().optional(),
    showCategoryCircles: z.boolean().optional(),
    showMainNavigation: z.boolean().optional(),
    headerStyle: z.enum(["WHITE", "WARM"]).optional(),
    logoAlignment: z.enum(["LEFT", "CENTER"]).optional(),
  }).optional(),

  announcementBar: z.object({
    active: z.boolean().optional(),
    enabled: z.boolean().optional(),
    text: z.string().max(300).optional(),
    message: z.string().max(300).optional(),
    linkLabel: z.string().max(100).optional(),
    linkUrl: z.string().max(500).optional(),
    backgroundStyle: z.string().optional(),
    textStyle: z.string().optional(),
  }).optional(),

  footer: z.object({
    brandDescription: z.string().max(1000).optional(),
    footerLogo: z.string().max(500).optional(),
    newsletterVisibility: z.boolean().optional(),
    newsletterTitle: z.string().max(150).optional(),
    newsletterSubtitle: z.string().max(300).optional(),
    contactDetails: z.boolean().optional(),
    socialLinksVisibility: z.boolean().optional(),
    paymentIcons: z.array(z.string()).optional(),
    footerColumns: z.array(z.object({
      id: z.string(),
      title: z.string().max(100),
      enabled: z.boolean().optional(),
      sortOrder: z.number().optional(),
      links: z.array(z.object({
        label: z.string().max(100),
        type: z.enum(["CMS_PAGE", "CATEGORY", "COLLECTION", "CUSTOM_URL"]),
        url: z.string().max(500).optional(),
        targetId: z.string().optional(),
      })),
    })).optional(),
  }).optional(),

  social: z.object({
    instagram: z.string().max(300).optional(),
    facebook: z.string().max(300).optional(),
    youtube: z.string().max(300).optional(),
    pinterest: z.string().max(300).optional(),
    linkedin: z.string().max(300).optional(),
    twitter: z.string().max(300).optional(),
  }).optional(),

  appearance: z.object({
    colors: z.object({
      primary: colorHexSchema.optional(),
      secondary: colorHexSchema.optional(),
      accent: colorHexSchema.optional(),
      background: colorHexSchema.optional(),
      surface: colorHexSchema.optional(),
      text: colorHexSchema.optional(),
      mutedText: colorHexSchema.optional(),
      border: colorHexSchema.optional(),
    }).optional(),
    layout: z.object({
      containerWidth: z.string().max(50).optional(),
      sectionSpacing: z.string().max(50).optional(),
      pagePadding: z.string().max(50).optional(),
      cardRadius: z.string().max(50).optional(),
      buttonRadius: z.string().max(50).optional(),
      inputRadius: z.string().max(50).optional(),
    }).optional(),
    typography: z.object({
      headingFont: z.string().max(100).optional(),
      bodyFont: z.string().max(100).optional(),
      headingScale: z.number().min(0.5).max(2.0).optional(),
      bodyScale: z.number().min(0.5).max(2.0).optional(),
    }).optional(),
  }).optional(),

  shop: z.object({
    defaultSort: z.enum(["featured", "price_asc", "price_desc", "newest"]).optional(),
    productsPerPage: z.number().int().min(1).max(100).optional(),
    desktopGridColumns: z.number().int().min(1).max(6).optional(),
    tabletGridColumns: z.number().int().min(1).max(4).optional(),
    mobileGridColumns: z.number().int().min(1).max(3).optional(),
    showFilters: z.boolean().optional(),
    showAvailabilityFilter: z.boolean().optional(),
    showPriceFilter: z.boolean().optional(),
    showCategoryFilter: z.boolean().optional(),
    showCollectionFilter: z.boolean().optional(),
    showQuickAdd: z.boolean().optional(),
    showBadges: z.boolean().optional(),
  }).optional(),

  productCard: z.object({
    showCategory: z.boolean().optional(),
    showBrand: z.boolean().optional(),
    showRatings: z.boolean().optional(),
    showComparePrice: z.boolean().optional(),
    showQuickAdd: z.boolean().optional(),
    showBadges: z.boolean().optional(),
  }).optional(),

  shipping: z.object({
    standardShippingAmount: z.number().nonnegative().max(100000).optional(),
    freeShippingThreshold: z.number().nonnegative().max(1000000).optional(),
    shippingEnabled: z.boolean().optional(),
  }).optional(),

  payments: z.object({
    razorpayEnabled: z.boolean().optional(),
    codEnabled: z.boolean().optional(),
    razorpayDisplayLabel: z.string().max(150).optional(),
    codDisplayLabel: z.string().max(150).optional(),
  }).optional(),

  checkout: z.object({
    guestCheckoutEnabled: z.boolean().optional(),
    requirePhone: z.boolean().optional(),
    allowDifferentBillingAddress: z.boolean().optional(),
    showOrderNotes: z.boolean().optional(),
    termsPageId: z.string().optional(),
    privacyPageId: z.string().optional(),
    shippingPageId: z.string().optional(),
    returnPageId: z.string().optional(),
  }).optional(),

  // Legacy fields retained for backwards compatibility
  supportPhone: z.string().max(40).optional(),
  supportEmail: z.string().email().optional(),
  standardShippingAmount: z.number().nonnegative().max(100000).optional(),
  freeShippingThreshold: z.number().nonnegative().max(1000000).optional(),
  socialLinks: z.record(z.string().max(40), z.string()).optional(),
  homepageHero: z.object({ title: z.string().max(200), image: z.string(), href: z.string().max(500).optional() }).optional(),
  seoDefaults: z.object({ title: z.string().max(200), description: z.string().max(500) }).optional(),
  promoStrip: z.object({
    active: z.boolean().optional(),
    title: z.string().max(200).optional(),
    couponCode: z.string().max(50).optional(),
    description: z.string().max(300).optional(),
    ctaLabel: z.string().max(100).optional(),
    ctaUrl: z.string().max(500).optional()
  }).optional(),
  heroBanners: z.array(z.object({
    id: z.string(),
    desktopImage: z.string(),
    mobileImage: z.string().optional(),
    eyebrow: z.string().max(100).optional(),
    headline: z.string().max(200),
    highlightText: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
    primaryCtaLabel: z.string().max(100).optional(),
    primaryCtaUrl: z.string().max(500).optional(),
    secondaryCtaLabel: z.string().max(100).optional(),
    secondaryCtaUrl: z.string().max(500).optional(),
    textPosition: z.string().optional(),
    textTheme: z.string().optional(),
    active: z.boolean().optional()
  })).optional()
}).passthrough();

const FORBIDDEN_KEYS = ["jwtSecret", "razorpaySecret", "keySecret", "webhookSecret", "smtpPassword", "dbUrl", "databaseUrl"];

async function getMergedSettings() {
  const rows = await prisma.siteSetting.findMany();
  const dbMap = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  
  const merged = { ...DEFAULT_SETTINGS };
  for (const [key, val] of Object.entries(dbMap)) {
    if (typeof val === "object" && val !== null && !Array.isArray(val) && typeof merged[key] === "object") {
      merged[key] = { ...merged[key], ...val };
    } else {
      merged[key] = val;
    }
  }

  // Respect root-level shipping settings if set directly in dbMap
  if (dbMap.freeShippingThreshold !== undefined) {
    merged.freeShippingThreshold = dbMap.freeShippingThreshold;
  }
  if (dbMap.standardShippingAmount !== undefined) {
    merged.standardShippingAmount = dbMap.standardShippingAmount;
  }

  return merged;
}

export const publicSettingsRouter = Router();
publicSettingsRouter.get("/", asyncHandler(async (_req, res) => {
  const settings = await getMergedSettings();
  ok(res, settings);
}));

export const adminSettingsRouter = Router();
adminSettingsRouter.use(requireAdmin);

adminSettingsRouter.get("/", asyncHandler(async (_req, res) => {
  const settings = await getMergedSettings();
  ok(res, settings);
}));

adminSettingsRouter.put("/", asyncHandler(async (req, res) => {
  const hasForbiddenKey = Object.keys(req.body || {}).some((k) => FORBIDDEN_KEYS.includes(k));
  if (hasForbiddenKey) {
    return res.status(400).json({ error: "Cannot modify system environment secrets via API." });
  }

  const parseResult = settingsValidationSchema.safeParse(req.body);
  if (!parseResult.success) {
    console.error("Settings validation error:", JSON.stringify(parseResult.error.format(), null, 2));
    const firstErr = parseResult.error.errors[0];
    const msg = firstErr ? `${firstErr.path.join(".")}: ${firstErr.message}` : "Validation failed";
    return res.status(400).json({ error: msg, details: parseResult.error.errors });
  }
  const input = parseResult.data;

  // Sync root shipping fields if shipping object updated
  if (input.shipping) {
    if (input.shipping.freeShippingThreshold !== undefined) {
      input.freeShippingThreshold = input.shipping.freeShippingThreshold;
    }
    if (input.shipping.standardShippingAmount !== undefined) {
      input.standardShippingAmount = input.shipping.standardShippingAmount;
    }
  }

  await prisma.$transaction(
    Object.entries(input).map(([key, value]) =>
      prisma.siteSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    )
  );

  const updated = await getMergedSettings();
  ok(res, updated);
}));

adminSettingsRouter.post("/reset-appearance", asyncHandler(async (_req, res) => {
  const defaultAppearance = DEFAULT_SETTINGS.appearance;
  await prisma.siteSetting.upsert({
    where: { key: "appearance" },
    create: { key: "appearance", value: defaultAppearance },
    update: { value: defaultAppearance },
  });

  const updated = await getMergedSettings();
  ok(res, updated);
}));


