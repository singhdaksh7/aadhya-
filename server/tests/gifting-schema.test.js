import { describe, it, expect } from "vitest";
import { validateHomepageSettings, DEFAULT_HOMEPAGE_CONTENT } from "../src/modules/pages/homepage-content.js";
import {
  GIFTING_HERO_DEFAULTS,
  GIFTS_BY_OCCASION_DEFAULTS,
  CURATED_STORIES_DEFAULTS,
  GIFTS_BY_FESTIVAL_DEFAULTS,
  GIFTING_BENEFITS_DEFAULTS,
  GIFTS_BY_CRAFT_DEFAULTS,
  FEATURED_GIFTS_DEFAULTS,
  GIFTS_BY_BUDGET_DEFAULTS,
  GIFTING_SEO_DEFAULTS,
  GIFTING_FAQ_DEFAULTS,
} from "../src/modules/pages/gifting-content.js";

describe("Gifting page section schemas validation", () => {
  it("validates GIFTING_HERO defaults and prevents unsafe URLs", () => {
    expect(() => validateHomepageSettings("GIFTING_HERO", GIFTING_HERO_DEFAULTS)).not.toThrow();
    expect(() =>
      validateHomepageSettings("GIFTING_HERO", {
        ...GIFTING_HERO_DEFAULTS,
        ctaUrl: "javascript:alert(1)",
      })
    ).toThrow();
  });

  it("validates GIFTS_BY_OCCASION defaults and limits items", () => {
    expect(() => validateHomepageSettings("GIFTS_BY_OCCASION", GIFTS_BY_OCCASION_DEFAULTS)).not.toThrow();
    expect(() =>
      validateHomepageSettings("GIFTS_BY_OCCASION", {
        heading: "Occasions",
        items: Array.from({ length: 25 }, (_, i) => ({ title: `Occasion ${i}` })),
      })
    ).toThrow();
  });

  it("validates CURATED_STORIES defaults", () => {
    expect(() => validateHomepageSettings("CURATED_STORIES", CURATED_STORIES_DEFAULTS)).not.toThrow();
  });

  it("validates GIFTS_BY_FESTIVAL defaults", () => {
    expect(() => validateHomepageSettings("GIFTS_BY_FESTIVAL", GIFTS_BY_FESTIVAL_DEFAULTS)).not.toThrow();
  });

  it("validates GIFTING_BENEFITS service strip defaults", () => {
    expect(() => validateHomepageSettings("GIFTING_BENEFITS", GIFTING_BENEFITS_DEFAULTS)).not.toThrow();
  });

  it("validates GIFTS_BY_CRAFT defaults", () => {
    expect(() => validateHomepageSettings("GIFTS_BY_CRAFT", GIFTS_BY_CRAFT_DEFAULTS)).not.toThrow();
  });

  it("validates FEATURED_GIFTS defaults and cleans productIds", () => {
    expect(() => validateHomepageSettings("FEATURED_GIFTS", FEATURED_GIFTS_DEFAULTS)).not.toThrow();
    const cleaned = validateHomepageSettings("FEATURED_GIFTS", {
      ...FEATURED_GIFTS_DEFAULTS,
      productIds: ["p1", "p2", "p1", "", null],
    });
    expect(cleaned.productIds).toEqual(["p1", "p2"]);
  });

  it("validates GIFTS_BY_BUDGET defaults", () => {
    expect(() => validateHomepageSettings("GIFTS_BY_BUDGET", GIFTS_BY_BUDGET_DEFAULTS)).not.toThrow();
  });

  it("validates GIFTING_SEO defaults", () => {
    expect(() => validateHomepageSettings("GIFTING_SEO", GIFTING_SEO_DEFAULTS)).not.toThrow();
  });

  it("validates GIFTING_FAQ defaults", () => {
    expect(() => validateHomepageSettings("GIFTING_FAQ", GIFTING_FAQ_DEFAULTS)).not.toThrow();
  });
});

