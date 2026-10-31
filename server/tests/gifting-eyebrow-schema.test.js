import { describe, it, expect } from "vitest";
import { validateHomepageSettings } from "../src/modules/pages/homepage-content.js";
import { DEFAULT_GIFTING_PAGE_SECTIONS } from "../src/modules/pages/gifting-content.js";

const EYEBROW_TYPES = {
  GIFTS_BY_OCCASION: { heading: "H", items: [] },
  CURATED_STORIES: { heading: "H", stories: [] },
  GIFTS_BY_FESTIVAL: { heading: "H", items: [] },
  GIFTING_BENEFITS: { heading: "H", cards: [] },
  GIFTS_BY_CRAFT: { heading: "H", crafts: [] },
  FEATURED_GIFTS: { heading: "H" },
  GIFTS_BY_BUDGET: { heading: "H", tiers: [] },
  GIFTING_SEO: { heading: "H" },
  GIFTING_FAQ: { heading: "H", items: [] },
};

describe("gifting editable labels", () => {
  it.each(Object.entries(EYEBROW_TYPES))("%s accepts an eyebrow, an empty eyebrow, and legacy payloads without one", (type, base) => {
    expect(validateHomepageSettings(type, { ...base, eyebrow: "My label" }).eyebrow).toBe("My label");
    expect(validateHomepageSettings(type, { ...base, eyebrow: "" }).eyebrow).toBe("");
    expect(validateHomepageSettings(type, base).eyebrow).toBeUndefined();
    expect(() => validateHomepageSettings(type, { ...base, eyebrow: "x".repeat(121) })).toThrow();
  });

  it("keeps card / story / tier labels instead of stripping them", () => {
    expect(validateHomepageSettings("GIFTS_BY_OCCASION", { heading: "H", items: [], cardCtaLabel: "Shop" }).cardCtaLabel).toBe("Shop");
    expect(validateHomepageSettings("GIFTS_BY_FESTIVAL", { heading: "H", items: [], cardCtaLabel: "See" }).cardCtaLabel).toBe("See");
    expect(validateHomepageSettings("GIFTS_BY_CRAFT", { heading: "H", crafts: [], cardCtaLabel: "Browse" }).cardCtaLabel).toBe("Browse");
    expect(validateHomepageSettings("GIFTS_BY_BUDGET", { heading: "H", tiers: [], cardCtaLabel: "Go", tierLabel: "Level" })).toMatchObject({ cardCtaLabel: "Go", tierLabel: "Level" });
    expect(validateHomepageSettings("CURATED_STORIES", { heading: "H", stories: [], storyLabel: "" }).storyLabel).toBe("");
    expect(() => validateHomepageSettings("GIFTS_BY_BUDGET", { heading: "H", tiers: [], cardCtaLabel: "y".repeat(61) })).toThrow();
  });

  it("still rejects unsafe URLs alongside the new fields", () => {
    expect(() => validateHomepageSettings("GIFTS_BY_OCCASION", { heading: "H", eyebrow: "E", items: [{ title: "T", destinationUrl: "javascript:alert(1)" }] })).toThrow();
    expect(() => validateHomepageSettings("GIFTS_BY_BUDGET", { heading: "H", cardCtaLabel: "Go", tiers: [{ label: "L", destinationUrl: "data:text/html,x" }] })).toThrow();
  });

  it("every default section validates and carries its current visible eyebrow", () => {
    for (const def of DEFAULT_GIFTING_PAGE_SECTIONS) {
      expect(() => validateHomepageSettings(def.type, def.settings)).not.toThrow();
    }
    const byType = Object.fromEntries(DEFAULT_GIFTING_PAGE_SECTIONS.map((d) => [d.type, d.settings]));
    expect(byType.GIFTS_BY_OCCASION.eyebrow).toBe("Celebrate Milestones");
    expect(byType.GIFTING_FAQ.eyebrow).toBe("Help & Assurance");
    expect(byType.GIFTS_BY_BUDGET).toMatchObject({ eyebrow: "Considered Values", cardCtaLabel: "Explore Collection", tierLabel: "Tier" });
    expect(byType.FEATURED_GIFTS.eyebrow).toBe("Artisan Selection");
  });
});
