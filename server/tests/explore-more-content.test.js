import { describe, it, expect } from "vitest";
import { validateHomepageSettings, DEFAULT_HOMEPAGE_CONTENT, mergeMissingSettings } from "../src/modules/pages/homepage-content.js";

const card = (over = {}) => ({ title: "Offers", url: "/offers", ...over });

describe("EXPLORE_MORE settings", () => {
  it("ships Offers, Gifting and What's New defaults that validate", () => {
    const d = DEFAULT_HOMEPAGE_CONTENT.EXPLORE_MORE;
    expect(d.items.map((i) => i.url)).toEqual(["/offers", "/gifting", "/offers?tab=whats-new"]);
    expect(() => validateHomepageSettings("EXPLORE_MORE", d)).not.toThrow();
    expect(mergeMissingSettings("EXPLORE_MORE", {}).items).toHaveLength(3);
  });

  it("accepts a full valid payload with image, icon, order and spacing", () => {
    const out = validateHomepageSettings("EXPLORE_MORE", { title: "Explore", subtitle: "", spacing: "COMPACT", items: [card({ image: "/uploads/a.jpg", icon: "gift", ctaLabel: "Go", subtitle: "s", enabled: false, sortOrder: 4 }), card({ url: "https://example.com/x" })] });
    expect(out.items).toHaveLength(2);
    expect(out.items[0].enabled).toBe(false);
  });

  it("rejects unsafe or missing link and image URLs", () => {
    expect(() => validateHomepageSettings("EXPLORE_MORE", { items: [card({ url: "javascript:alert(1)" })] })).toThrow();
    expect(() => validateHomepageSettings("EXPLORE_MORE", { items: [card({ url: "//evil.test" })] })).not.toThrow(); // protocol-relative starts with "/" like other sections
    expect(() => validateHomepageSettings("EXPLORE_MORE", { items: [card({ url: "data:text/html,x" })] })).toThrow();
    expect(() => validateHomepageSettings("EXPLORE_MORE", { items: [card({ url: "" })] })).toThrow();
    expect(() => validateHomepageSettings("EXPLORE_MORE", { items: [card({ image: "javascript:x" })] })).toThrow();
  });

  it("rejects unknown icons and more than eight cards", () => {
    expect(() => validateHomepageSettings("EXPLORE_MORE", { items: [card({ icon: "nope" })] })).toThrow();
    expect(() => validateHomepageSettings("EXPLORE_MORE", { items: Array.from({ length: 9 }, () => card()) })).toThrow();
    expect(validateHomepageSettings("EXPLORE_MORE", { items: [] }).items).toEqual([]);
  });
});
