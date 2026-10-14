import { describe, expect, it } from "vitest";
import { DEFAULT_HOMEPAGE_CONTENT, mergeMissingSettings, validateHomepageSettings } from "../src/modules/pages/homepage-content.js";

describe("OUR_JOURNEY homepage section", () => {
  it("accepts the neutral placeholder defaults", () => {
    const out = validateHomepageSettings("OUR_JOURNEY", DEFAULT_HOMEPAGE_CONTENT.OUR_JOURNEY);
    expect(out.milestones).toHaveLength(3);
    expect(out.milestones[0].date).toBe("Year");
  });

  it("allows zero milestones and does not refill them", () => {
    const merged = mergeMissingSettings("OUR_JOURNEY", { milestones: [], title: "T" });
    expect(merged.milestones).toEqual([]);
    expect(validateHomepageSettings("OUR_JOURNEY", merged).milestones).toEqual([]);
  });

  it("rejects more than 12 milestones, unsafe image URLs, bad icons and background", () => {
    const ms = (n) => Array.from({ length: n }, (_, i) => ({ title: `T${i}` }));
    expect(validateHomepageSettings("OUR_JOURNEY", { milestones: ms(12) }).milestones).toHaveLength(12);
    expect(() => validateHomepageSettings("OUR_JOURNEY", { milestones: ms(13) })).toThrow();
    expect(() => validateHomepageSettings("OUR_JOURNEY", { milestones: [{ title: "x", image: "javascript:alert(1)" }] })).toThrow("relative or http(s)");
    expect(() => validateHomepageSettings("OUR_JOURNEY", { milestones: [{ title: "x", icon: "rocket" }] })).toThrow();
    expect(() => validateHomepageSettings("OUR_JOURNEY", { milestones: [], background: "NEON" })).toThrow();
  });

  it("accepts spacing, optional images and sort order", () => {
    const out = validateHomepageSettings("OUR_JOURNEY", { spacing: "SPACIOUS", image: "/media/a.jpg", milestones: [{ title: "x", sortOrder: 3, enabled: false, icon: "leaf", image: "" }] });
    expect(out).toMatchObject({ spacing: "SPACIOUS", milestones: [{ sortOrder: 3, enabled: false }] });
  });
});
