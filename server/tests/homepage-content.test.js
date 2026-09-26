import { describe, expect, it } from "vitest";
import { DEFAULT_HOMEPAGE_CONTENT, mergeMissingSettings, validateHomepageSettings } from "../src/modules/pages/homepage-content.js";

describe("Phase F.1 homepage content validation", () => {
  it("accepts trust, shop-look, editorial, and newsletter settings", () => {
    expect(validateHomepageSettings("TRUST_STRIP", DEFAULT_HOMEPAGE_CONTENT.TRUST_STRIP).items).toHaveLength(4);
    expect(validateHomepageSettings("SHOP_THE_LOOK", DEFAULT_HOMEPAGE_CONTENT.SHOP_THE_LOOK).items).toHaveLength(4);
    expect(validateHomepageSettings("EDITORIAL_BRAND", DEFAULT_HOMEPAGE_CONTENT.EDITORIAL_BRAND).features).toHaveLength(2);
    expect(validateHomepageSettings("NEWSLETTER", DEFAULT_HOMEPAGE_CONTENT.NEWSLETTER).title).toBe("Stories of Craft & New Arrivals");
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
});
