import { describe, it, expect } from "vitest";
import { validateHomepageSettings, DEFAULT_HOMEPAGE_CONTENT } from "../src/modules/pages/homepage-content.js";

// Saved section settings are parsed by zod, which strips unknown keys. `kind` must survive that round trip or the
// storefront could never tell which homepage cards are gifting content.
describe("homepage cards keep the explicit GIFTING marker", () => {
  it("Explore More keeps kind: GIFTING and rejects unknown kinds", () => {
    const out = validateHomepageSettings("EXPLORE_MORE", { items: [
      { id: "a", title: "Offers", url: "/offers" },
      { id: "b", title: "Gifting", url: "/gifting", kind: "GIFTING" },
    ] });
    expect(out.items[0].kind).toBeUndefined();
    expect(out.items[1].kind).toBe("GIFTING");
    expect(() => validateHomepageSettings("EXPLORE_MORE", { items: [{ title: "x", url: "/x", kind: "BOGUS" }] })).toThrow();
  });
  it("Promotional banners keep kind: GIFTING", () => {
    const out = validateHomepageSettings("PROMO_BANNERS_2UP", { items: [{ id: "p", title: "Gift Edit", ctaUrl: "/shop", kind: "GIFTING" }, { id: "q", title: "Perfect Gift Ideas", ctaUrl: "/shop" }] });
    expect(out.items[0].kind).toBe("GIFTING");
    expect(out.items[1].kind).toBeUndefined();
  });
  it("shipped defaults mark exactly the gifting cards", () => {
    const explore = DEFAULT_HOMEPAGE_CONTENT.EXPLORE_MORE.items;
    expect(explore.filter((i) => i.kind === "GIFTING").map((i) => i.url)).toEqual(["/gifting"]);
    expect(DEFAULT_HOMEPAGE_CONTENT.PROMO_BANNERS_2UP.items.filter((i) => i.kind === "GIFTING").map((i) => i.title)).toEqual(["Gift Edit"]);
  });
});
