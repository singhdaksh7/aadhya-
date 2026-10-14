import { describe, expect, it } from "vitest";
import { DEFAULT_HOMEPAGE_CONTENT, mergeMissingSettings, settingsEqual, validateHomepageSettings } from "../src/modules/pages/homepage-content.js";

describe("Phase F.1 homepage content validation", () => {
  it("accepts trust, shop-look, editorial, and newsletter settings", () => {
    expect(validateHomepageSettings("TRUST_STRIP", DEFAULT_HOMEPAGE_CONTENT.TRUST_STRIP).items).toHaveLength(4);
    expect(validateHomepageSettings("SHOP_THE_LOOK", DEFAULT_HOMEPAGE_CONTENT.SHOP_THE_LOOK).items).toHaveLength(4);
    expect(validateHomepageSettings("EDITORIAL_BRAND", DEFAULT_HOMEPAGE_CONTENT.EDITORIAL_BRAND).features).toHaveLength(2);
    expect(validateHomepageSettings("NEWSLETTER", DEFAULT_HOMEPAGE_CONTENT.NEWSLETTER).title).toBe("Stories of Craft & New Arrivals");
  });

  it("preserves the newer homepage section contracts (banners, product rail, reviews, blog and spacing)", () => {
    const banners = validateHomepageSettings("PROMO_BANNERS_2UP", {
      spacing: "SPACIOUS",
      items: [{ id: "editorial-1", title: "Autumn edit", mobileImage: "/media/autumn-mobile.jpg", image: "/media/autumn.jpg", ctaUrl: "/collections/autumn", textAlign: "CENTER", overlayStrength: "MEDIUM" }],
    });
    expect(banners).toMatchObject({ spacing: "SPACIOUS", items: [{ mobileImage: "/media/autumn-mobile.jpg", textAlign: "CENTER" }] });
    expect(validateHomepageSettings("NEW_ARRIVALS", { title: "New This Week", showArrows: true, showCta: false, limit: 8, spacing: "COMPACT" })).toMatchObject({ title: "New This Week", showArrows: true, spacing: "COMPACT" });
    expect(validateHomepageSettings("TESTIMONIALS", { motion: "MARQUEE", speed: 80, pauseOnHover: true, limit: 4 })).toMatchObject({ motion: "MARQUEE", speed: 80 });
    expect(validateHomepageSettings("BLOG_PREVIEW", { title: "Journal", limit: 3, showExcerpt: false, viewAllUrl: "/blog" })).toMatchObject({ showExcerpt: false, viewAllUrl: "/blog" });
    expect(validateHomepageSettings("TRUST_STRIP", { mobileLayout: "SCROLL", desktopColumns: 3, items: [{ title: "Craft", description: "Made slowly", icon: "leaf" }] })).toMatchObject({ mobileLayout: "SCROLL", desktopColumns: 3 });
  });

  it("rejects unsafe URLs and invalid target types", () => {
    expect(() => validateHomepageSettings("NEW_ARRIVALS", { ctaUrl: "javascript:alert(1)" })).toThrow("relative or http(s)");
    expect(() => validateHomepageSettings("SHOP_THE_LOOK", { items: [{ title: "Bad", targetType: "SCRIPT" }] })).toThrow();
  });

  it("backfills only missing values without replacing configured values", () => {
    const merged = mergeMissingSettings("NEWSLETTER", { title: "Our custom title" });
    expect(merged.title).toBe("Our custom title");
    expect(merged.buttonLabel).toBe("Subscribe");
    const existingItems = [{ id: "custom", title: "Custom", description: "Custom", icon: "heart" }];
    expect(mergeMissingSettings("TRUST_STRIP", { items: existingItems }).items).toEqual(existingItems);
  });

  it("treats equivalent JSON settings as equal regardless of key order", () => {
    expect(settingsEqual({ title: "Custom", nested: { limit: 3 } }, { nested: { limit: 3 }, title: "Custom" })).toBe(true);
  });
});

describe("TRUST_BANNER settings", () => {
  it("accepts the seeded defaults", () => {
    const parsed = validateHomepageSettings("TRUST_BANNER", DEFAULT_HOMEPAGE_CONTENT.TRUST_BANNER);
    expect(parsed.items.length).toBeGreaterThanOrEqual(3);
    expect(parsed.reviewScore).toBeNull();
  });

  it("keeps settings placeholders as plain text", () => {
    const parsed = validateHomepageSettings("TRUST_BANNER", { items: [{ title: "Free shipping", description: "Above {freeShippingThreshold}", icon: "truck" }] });
    expect(parsed.items[0].description).toBe("Above {freeShippingThreshold}");
  });

  it("allows zero items and more than three", () => {
    expect(validateHomepageSettings("TRUST_BANNER", { items: [] }).items).toEqual([]);
    expect(validateHomepageSettings("TRUST_BANNER", { items: Array.from({ length: 8 }, (_, i) => ({ title: `T${i}` })) }).items).toHaveLength(8);
    expect(() => validateHomepageSettings("TRUST_BANNER", { items: Array.from({ length: 13 }, (_, i) => ({ title: `T${i}` })) })).toThrow();
  });

  it("rejects bad colours, unknown icons, out-of-range numbers and unsafe URLs", () => {
    expect(() => validateHomepageSettings("TRUST_BANNER", { backgroundColor: "red", items: [] })).toThrow("#RRGGBB");
    expect(() => validateHomepageSettings("TRUST_BANNER", { items: [{ title: "x", icon: "skull" }] })).toThrow();
    expect(() => validateHomepageSettings("TRUST_BANNER", { reviewScore: 6, items: [] })).toThrow();
    expect(() => validateHomepageSettings("TRUST_BANNER", { borderRadius: 99, items: [] })).toThrow();
    expect(() => validateHomepageSettings("TRUST_BANNER", { backgroundImage: "javascript:alert(1)", items: [] })).toThrow("relative or http(s)");
    expect(validateHomepageSettings("TRUST_BANNER", { backgroundColor: "", backgroundImage: "", items: [] })).toMatchObject({ backgroundColor: "" });
  });

  it("backfills missing keys but never refills an emptied item list", () => {
    expect(mergeMissingSettings("TRUST_BANNER", { items: [] }).items).toEqual([]);
    expect(mergeMissingSettings("TRUST_BANNER", {}).items).toHaveLength(4);
    expect(mergeMissingSettings("TRUST_BANNER", { backgroundColor: "#FFFFFF", items: [] }).backgroundColor).toBe("#FFFFFF");
  });
});
