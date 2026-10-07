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
