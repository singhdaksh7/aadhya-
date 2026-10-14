import { describe, it, expect } from "vitest";
import { validateHomepageSettings, DEFAULT_HOMEPAGE_CONTENT } from "../src/modules/pages/homepage-content.js";

const base = () => ({ title: "How We Work", items: [{ title: "A", description: "B", icon: "leaf", enabled: true, sortOrder: 1 }] });

describe("HOW_WE_WORK settings validation", () => {
  it("accepts the seeded default", () => {
    expect(() => validateHomepageSettings("HOW_WE_WORK", DEFAULT_HOMEPAGE_CONTENT.HOW_WE_WORK)).not.toThrow();
    expect(DEFAULT_HOMEPAGE_CONTENT.HOW_WE_WORK.items.length).toBeGreaterThanOrEqual(3);
  });

  it("accepts a full valid payload", () => {
    const out = validateHomepageSettings("HOW_WE_WORK", { ...base(), image: "/uploads/x.jpg", imagePosition: "LEFT", background: "CUSTOM", backgroundColor: "#AABBCC", borderColor: "#112233", borderRadius: 12, spacing: "COMPACT" });
    expect(out.imagePosition).toBe("LEFT");
  });

  it("rejects an unsafe image URL", () => {
    expect(() => validateHomepageSettings("HOW_WE_WORK", { ...base(), image: "javascript:alert(1)" })).toThrow();
    expect(() => validateHomepageSettings("HOW_WE_WORK", { ...base(), items: [{ title: "A", iconImage: "data:text/html,x" }] })).toThrow();
  });

  it("rejects bad colours, positions and icons", () => {
    expect(() => validateHomepageSettings("HOW_WE_WORK", { ...base(), backgroundColor: "red" })).toThrow();
    expect(() => validateHomepageSettings("HOW_WE_WORK", { ...base(), imagePosition: "TOP" })).toThrow();
    expect(() => validateHomepageSettings("HOW_WE_WORK", { items: [{ title: "A", icon: "nope" }] })).toThrow();
  });

  it("rejects more than eight items", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ title: `P${i}` }));
    expect(() => validateHomepageSettings("HOW_WE_WORK", { items })).toThrow();
    expect(() => validateHomepageSettings("HOW_WE_WORK", { items: items.slice(0, 8) })).not.toThrow();
  });
});
