import { describe, it, expect } from "vitest";
import { createCategorySchema, updateCategorySchema, categoryBannersSchema, MAX_CATEGORY_BANNERS } from "../src/modules/categories/category.validators.js";

// DB-free validation contract for multi-banner categories.
const banner = (i, extra = {}) => ({ id: `b${i}`, enabled: true, desktopImage: "/uploads/a.jpg", sortOrder: i, ...extra });

describe("category banners validation", () => {
  it("accepts relative and http(s) URLs, optional text and CTA", () => {
    const r = categoryBannersSchema.safeParse([
      banner(1, { mobileImage: "https://cdn.example.com/m.jpg", title: "T", subtitle: "S", ctaLabel: "Shop", ctaUrl: "/shop/category/vases" }),
    ]);
    expect(r.success).toBe(true);
  });
  it("allows up to the cap and rejects beyond it", () => {
    expect(MAX_CATEGORY_BANNERS).toBe(20);
    expect(categoryBannersSchema.safeParse(Array.from({ length: 20 }, (_, i) => banner(i))).success).toBe(true);
    expect(categoryBannersSchema.safeParse(Array.from({ length: 21 }, (_, i) => banner(i))).success).toBe(false);
  });
  it("rejects unsafe URLs (javascript:, data:, protocol-relative, ftp)", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "//evil.com/x.jpg", "ftp://x/y.jpg", "relative/no-slash.jpg"]) {
      expect(categoryBannersSchema.safeParse([banner(1, { desktopImage: bad })]).success).toBe(false);
      expect(categoryBannersSchema.safeParse([banner(1, { ctaLabel: "Go", ctaUrl: bad })]).success).toBe(false);
    }
  });
  it("requires an image on enabled banners but not disabled ones", () => {
    expect(categoryBannersSchema.safeParse([banner(1, { desktopImage: null })]).success).toBe(false);
    expect(categoryBannersSchema.safeParse([banner(1, { desktopImage: null, enabled: false })]).success).toBe(true);
  });
  it("requires a destination when a CTA label is set, and unique ids", () => {
    expect(categoryBannersSchema.safeParse([banner(1, { ctaLabel: "Go" })]).success).toBe(false);
    expect(categoryBannersSchema.safeParse([banner(1), banner(1)]).success).toBe(false);
  });
  it("is wired into create/update with autoplay settings validated and legacy fields still accepted", () => {
    expect(createCategorySchema.safeParse({ name: "X", desktopBanner: "/old.jpg", banners: [banner(1)], bannerAutoplay: false, bannerIntervalMs: 4000 }).success).toBe(true);
    expect(updateCategorySchema.safeParse({ bannerIntervalMs: 100 }).success).toBe(false);
    expect(updateCategorySchema.safeParse({ banners: null }).success).toBe(true);
    expect(updateCategorySchema.safeParse({ banners: [banner(1, { desktopImage: "javascript:x" })] }).success).toBe(false);
  });
});
