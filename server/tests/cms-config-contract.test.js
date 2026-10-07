import { describe, it, expect } from "vitest";
import { settingsValidationSchema } from "../src/modules/settings/settings.routes.js";
import { DEFAULT_HOMEPAGE_CONTENT, mergeMissingSettings, validateHomepageSettings } from "../src/modules/pages/homepage-content.js";
import { estimateReadingMinutes } from "../src/modules/pages/pages.service.js";

// DB-free contract tests for the admin CMS configuration added for the header + homepage.
const header = (value) => settingsValidationSchema.safeParse({ header: value });
const homepage = (type, settings) => validateHomepageSettings(type, settings);

describe("header strip separators + depth", () => {
  it("accepts top/bottom separators and the canonical depth, preserving them on parse", () => {
    const res = header({ circularCategories: { enabled: true, showTopSeparator: true, showBottomSeparator: false, categoryDepth: "ALL" } });
    expect(res.success).toBe(true);
    expect(res.data.header.circularCategories).toEqual({ enabled: true, showTopSeparator: true, showBottomSeparator: false, categoryDepth: "ALL" });
  });

  it("rejects non-boolean separators and unknown depth values", () => {
    expect(header({ circularCategories: { showTopSeparator: "yes" } }).success).toBe(false);
    expect(header({ circularCategories: { showBottomSeparator: 1 } }).success).toBe(false);
    expect(header({ circularCategories: { categoryDepth: "EVERYTHING" } }).success).toBe(false);
  });
});

describe("mega menu promo banner config", () => {
  const nav = (promoCard) => header({ primaryNav: { items: [{ id: "n1", label: "Books", enabled: true, megaMenuMode: "AUTO_FROM_CATEGORY", promoCard }] } });
  const full = { enabled: true, image: "/uploads/a.jpg", mobileImage: "/uploads/a-m.jpg", eyebrow: "Edit", title: "Reading", description: "Quiet picks", ctaLabel: "Shop", ctaUrl: "/books", altText: "Books" };

  it("keeps every promo field including the mobile image", () => {
    const res = nav(full);
    expect(res.success).toBe(true);
    expect(res.data.header.primaryNav.items[0].promoCard).toEqual(full);
  });

  it("rejects script-capable promo URLs", () => {
    expect(nav({ ...full, image: "javascript:alert(1)" }).success).toBe(false);
    expect(nav({ ...full, mobileImage: "data:text/html,x" }).success).toBe(false);
    expect(nav({ ...full, ctaUrl: "java\tscript:alert(1)" }).success).toBe(false);
  });

  it("accepts every mega menu mode and rejects unknown ones", () => {
    for (const megaMenuMode of ["DISABLED", "AUTO_FROM_CATEGORY", "ALL_CATEGORIES", "MANUAL"]) {
      expect(header({ primaryNav: { items: [{ id: "n", label: "x", enabled: true, megaMenuMode }] } }).success).toBe(true);
    }
    expect(header({ primaryNav: { items: [{ id: "n", label: "x", enabled: true, megaMenuMode: "FANCY" }] } }).success).toBe(false);
  });
});

describe("partial saves never carry unrelated settings", () => {
  it("a header-only payload parses to exactly the header key", () => {
    const res = settingsValidationSchema.safeParse({ header: { circularCategories: { enabled: false } } });
    expect(res.success).toBe(true);
    expect(Object.keys(res.data)).toEqual(["header"]);
  });

  it("a nested strip-only header payload does not inject defaults for sibling header keys", () => {
    const res = header({ circularCategories: { showTopSeparator: false } });
    expect(Object.keys(res.data.header)).toEqual(["circularCategories"]);
  });
});

describe("homepage config serialization", () => {
  it("every default section config validates and survives a JSON round-trip unchanged", () => {
    for (const [type, defaults] of Object.entries(DEFAULT_HOMEPAGE_CONTENT)) {
      const parsed = homepage(type, defaults);
      expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed);
    }
  });

  it("feature strip: section-level + per-item fields round-trip", () => {
    const config = {
      background: "PLAIN", showDividers: false, desktopColumns: 3, mobileLayout: "SCROLL", spacing: "COMPACT",
      items: [{ id: "t1", enabled: false, icon: "leaf", title: "Craft", description: "Slow", sortOrder: 2 }],
    };
    expect(homepage("TRUST_STRIP", config)).toEqual(config);
  });

  it("editorial banners: multiple banners with mobile image, alignment, overlay and order", () => {
    const items = [
      { id: "b1", enabled: true, image: "/m/a.jpg", mobileImage: "/m/a-m.jpg", eyebrow: "E", title: "One", subtitle: "S", ctaLabel: "Go", ctaUrl: "/a", textAlign: "RIGHT", overlayStrength: "STRONG", sortOrder: 1 },
      { id: "b2", enabled: false, title: "Two", textAlign: "CENTER", overlayStrength: "NONE", sortOrder: 2 },
    ];
    expect(homepage("PROMO_BANNERS_2UP", { items }).items).toEqual(items);
    expect(() => homepage("PROMO_BANNERS_2UP", { items: Array.from({ length: 9 }, (_, i) => ({ title: `b${i}` })) })).toThrow();
  });

  it("new arrivals: subtitle, CTA toggle, arrows and limit; dynamic source logic is untouched", () => {
    const config = { eyebrow: "New", title: "New This Week", subtitle: "Just landed", limit: 8, showArrows: true, showCta: false, ctaLabel: "All", ctaUrl: "/new-arrivals", sourceMode: "AUTO" };
    expect(homepage("NEW_ARRIVALS", config)).toEqual(config);
    expect(() => homepage("NEW_ARRIVALS", { limit: 25 })).toThrow();
  });

  it("reviews: motion, speed, overrides (nullable) and limits", () => {
    const config = { eyebrow: "Loved", title: "Reviews", averageRating: 4.8, reviewCount: 120, motion: "MARQUEE", speed: 80, pauseOnHover: false, showVerifiedBadge: true, limit: 6 };
    expect(homepage("TESTIMONIALS", config)).toEqual(config);
    expect(homepage("TESTIMONIALS", { averageRating: null, reviewCount: null }).averageRating).toBeNull();
    for (const bad of [{ motion: "SPIN" }, { speed: 5 }, { speed: 301 }, { averageRating: 5.1 }, { reviewCount: -1 }, { limit: 25 }]) {
      expect(() => homepage("TESTIMONIALS", bad)).toThrow();
    }
  });

  it("blog: display toggles, limit and View All URL", () => {
    const config = { eyebrow: "Journal", title: "Stories", limit: 3, showExcerpt: false, showAuthor: true, showDate: false, showReadingTime: true, showViewAll: true, viewAllUrl: "/blog" };
    expect(homepage("BLOG_PREVIEW", config)).toEqual(config);
    expect(() => homepage("BLOG_PREVIEW", { viewAllUrl: "javascript:alert(1)" })).toThrow();
    expect(() => homepage("BLOG_PREVIEW", { limit: 13 })).toThrow();
  });

  it("shared spacing accepts only COMPACT / NORMAL / SPACIOUS on every section type", () => {
    for (const type of Object.keys(DEFAULT_HOMEPAGE_CONTENT)) {
      for (const spacing of ["COMPACT", "NORMAL", "SPACIOUS"]) {
        expect(homepage(type, { ...DEFAULT_HOMEPAGE_CONTENT[type], spacing }).spacing).toBe(spacing);
      }
      expect(() => homepage(type, { ...DEFAULT_HOMEPAGE_CONTENT[type], spacing: "HUGE" })).toThrow();
    }
  });
});

describe("invalid homepage values are rejected", () => {
  it("rejects bad enums, bounds and unsafe URLs", () => {
    const item = { title: "T", description: "D", icon: "leaf" };
    expect(() => homepage("TRUST_STRIP", { desktopColumns: 5, items: [item] })).toThrow();
    expect(() => homepage("TRUST_STRIP", { mobileLayout: "CAROUSEL", items: [item] })).toThrow();
    expect(() => homepage("TRUST_STRIP", { background: "RED", items: [item] })).toThrow();
    expect(() => homepage("PROMO_BANNERS_2UP", { items: [{ title: "x", textAlign: "TOP" }] })).toThrow();
    expect(() => homepage("PROMO_BANNERS_2UP", { items: [{ title: "x", overlayStrength: "BLACK" }] })).toThrow();
    expect(() => homepage("PROMO_BANNERS_2UP", { items: [{ title: "x", mobileImage: "javascript:alert(1)" }] })).toThrow();
  });
});

describe("unrelated config is preserved on backfill", () => {
  it("backfilling a new-arrivals section only adds missing keys", () => {
    const merged = mergeMissingSettings("NEW_ARRIVALS", { title: "Custom", limit: 6, showCta: false });
    expect(merged).toMatchObject({ title: "Custom", limit: 6, showCta: false, showArrows: false });
  });
});

describe("blog reading time", () => {
  it("is at least one minute and strips markup", () => {
    expect(estimateReadingMinutes("")).toBe(1);
    expect(estimateReadingMinutes("<p>" + "word ".repeat(450) + "</p>")).toBe(3);
  });
});
