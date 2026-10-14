import { describe, expect, it, vi } from "vitest";
import { DEFAULT_HOMEPAGE_CONTENT, mergeMissingSettings, validateHomepageSettings } from "../src/modules/pages/homepage-content.js";
import { buildPublicReels, resolveReelsSection } from "../src/modules/pages/reels.js";

const reel = (over = {}) => ({ id: "r1", title: "Reel", videoUrl: "/uploads/products/a.mp4", coverImage: "/uploads/products/a.jpg", enabled: true, published: true, productIds: [], ...over });

describe("SHOPPABLE_REELS validation", () => {
  it("accepts the default and a full reel, and dedupes product ids", () => {
    expect(validateHomepageSettings("SHOPPABLE_REELS", DEFAULT_HOMEPAGE_CONTENT.SHOPPABLE_REELS).reels).toEqual([]);
    const out = validateHomepageSettings("SHOPPABLE_REELS", { spacing: "COMPACT", reels: [reel({ productIds: ["a", "b", "a", ""] })] });
    expect(out.reels[0].productIds).toEqual(["a", "b"]);
    expect(out.spacing).toBe("COMPACT");
  });
  it("new sections start from defaults", () => {
    expect(mergeMissingSettings("SHOPPABLE_REELS", {}).reels).toEqual([]);
  });
  it("rejects unsafe or non-video URLs, too many reels, and too many products", () => {
    expect(() => validateHomepageSettings("SHOPPABLE_REELS", { reels: [reel({ videoUrl: "javascript:alert(1)" })] })).toThrow();
    expect(() => validateHomepageSettings("SHOPPABLE_REELS", { reels: [reel({ videoUrl: "https://x.test/page.html" })] })).toThrow("Video must be");
    expect(() => validateHomepageSettings("SHOPPABLE_REELS", { reels: [reel({ coverImage: "javascript:x" })] })).toThrow();
    expect(() => validateHomepageSettings("SHOPPABLE_REELS", { reels: Array.from({ length: 25 }, (_, i) => reel({ id: `r${i}` })) })).toThrow();
    expect(() => validateHomepageSettings("SHOPPABLE_REELS", { reels: [reel({ productIds: Array.from({ length: 13 }, (_, i) => `p${i}`) })] })).toThrow();
    expect(validateHomepageSettings("SHOPPABLE_REELS", { reels: Array.from({ length: 24 }, (_, i) => reel({ id: `r${i}` })) }).reels).toHaveLength(24);
  });
  it("validates and dedupes categoryIds, max 12", () => {
    expect(validateHomepageSettings("SHOPPABLE_REELS", { reels: [reel({ categoryIds: ["c1", "c2", "c1", ""] })] }).reels[0].categoryIds).toEqual(["c1", "c2"]);
    expect(() => validateHomepageSettings("SHOPPABLE_REELS", { reels: [reel({ categoryIds: Array.from({ length: 13 }, (_, i) => `c${i}`) })] })).toThrow();
    expect(() => validateHomepageSettings("SHOPPABLE_REELS", { reels: [reel({ categoryIds: ["x".repeat(101)] })] })).toThrow();
    expect(() => validateHomepageSettings("SHOPPABLE_REELS", { reels: [reel({ categoryIds: [5] })] })).toThrow();
  });
  it("allows a draft reel with no media yet and video URLs with query strings", () => {
    expect(validateHomepageSettings("SHOPPABLE_REELS", { reels: [{ id: "d", published: false }] }).reels).toHaveLength(1);
    expect(() => validateHomepageSettings("SHOPPABLE_REELS", { reels: [reel({ videoUrl: "https://cdn.test/a.webm?sig=1" })] })).not.toThrow();
  });
});

describe("SHOPPABLE_REELS product resolution", () => {
  const products = new Map([["p1", { id: "p1", name: "One", slug: "one", price: 10, image: "" }], ["p2", { id: "p2", name: "Two", slug: "two", price: 20, image: "" }]]);

  it("hides unpublished/disabled/empty reels and never leaks their video URLs", () => {
    const out = buildPublicReels({ title: "T", reels: [reel({ id: "a" }), reel({ id: "b", published: false, videoUrl: "/secret.mp4" }), reel({ id: "c", enabled: false }), reel({ id: "d", videoUrl: "", coverImage: "" })] }, products);
    expect(out.reels.map((r) => r.id)).toEqual(["a"]);
    expect(JSON.stringify(out)).not.toContain("secret");
  });
  it("drops reels whose linked products are all inactive, keeps reels with none linked, keeps order of product ids", () => {
    const out = buildPublicReels({ reels: [reel({ id: "gone", productIds: ["x"] }), reel({ id: "none", productIds: [] }), reel({ id: "some", productIds: ["p2", "x", "p1"] })] }, products);
    expect(out.reels.map((r) => r.id)).toEqual(["none", "some"]);
    expect(out.reels[1].products.map((p) => p.id)).toEqual(["p2", "p1"]);
  });
  it("orders by sortOrder", () => {
    const out = buildPublicReels({ reels: [reel({ id: "a", sortOrder: 2 }), reel({ id: "b", sortOrder: 1 })] }, products);
    expect(out.reels.map((r) => r.id)).toEqual(["b", "a"]);
  });
  it("runs a single batched active-only query with minimal fields", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "p1", name: "One", slug: "one", price: "10.50", sku: "x", images: [{ url: "/i.jpg" }] }]);
    const out = await resolveReelsSection({ settings: { reels: [reel({ id: "a", productIds: ["p1", "p2"] }), reel({ id: "b", productIds: ["p1"] }), reel({ id: "c", published: false, productIds: ["p3"] })] } }, { product: { findMany } });
    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({ id: { in: ["p1", "p2"] }, isActive: true });
    expect(Object.keys(args.select).sort()).toEqual(["id", "images", "name", "price", "slug"]);
    expect(out.reels[0].products).toEqual([{ id: "p1", name: "One", slug: "one", price: 10.5, image: "/i.jpg" }]);
  });
  it("skips the query when nothing is linked", async () => {
    const findMany = vi.fn();
    const out = await resolveReelsSection({ settings: { reels: [reel()] } }, { product: { findMany } });
    expect(findMany).not.toHaveBeenCalled();
    expect(out.reels).toHaveLength(1);
  });
});

describe("SHOPPABLE_REELS category resolution", () => {
  const categories = new Map([["c1", { id: "c1", name: "Decor", slug: "decor", image: "" }]]);
  const products = new Map([["p1", { id: "p1", name: "One", slug: "one", price: 10, image: "" }]]);
  it("returns active categories, and drops reels whose only targets are inactive categories", () => {
    const out = buildPublicReels({ reels: [reel({ id: "ok", categoryIds: ["c1", "x"] }), reel({ id: "dead", categoryIds: ["x"] }), reel({ id: "mixed", productIds: ["p1"], categoryIds: ["x"] }), reel({ id: "dead2", productIds: ["zz"], categoryIds: ["x"] })] }, products, categories);
    expect(out.reels.map((r) => r.id)).toEqual(["ok", "mixed"]);
    expect(out.reels[0].categories).toEqual([{ id: "c1", name: "Decor", slug: "decor", image: "" }]);
  });
  it("runs one batched active-only category query with public fields", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "c1", name: "Decor", slug: "decor", image: null, description: "secret" }]);
    const out = await resolveReelsSection({ settings: { reels: [reel({ id: "a", categoryIds: ["c1", "c2"] }), reel({ id: "b", categoryIds: ["c1"] })] } }, { category: { findMany } });
    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({ id: { in: ["c1", "c2"] }, isActive: true });
    expect(Object.keys(args.select).sort()).toEqual(["id", "image", "name", "slug"]);
    expect(out.reels[0].categories).toEqual([{ id: "c1", name: "Decor", slug: "decor", image: "" }]);
    expect(JSON.stringify(out)).not.toContain("secret");
  });
});
