import { describe, it, expect } from "vitest";
import { settingsValidationSchema } from "../src/modules/settings/settings.routes.js";

// DB-free validation tests for the nav mega menu config.
const item = (extra = {}) => ({
  id: "nav-1",
  label: "Lighting",
  enabled: true,
  destinationType: "CATEGORY",
  categoryId: "cat-1",
  categorySlug: "lighting",
  destination: "/shop/category/lighting",
  megaMenuMode: "AUTO_FROM_CATEGORY",
  ...extra,
});
const parse = (items) => settingsValidationSchema.safeParse({ header: { primaryNav: { items } } });

describe("header primaryNav mega menu schema", () => {
  it("accepts auto + manual config with promo card", () => {
    const res = parse([
      item({ promoCard: { enabled: true, image: "/uploads/a.jpg", title: "Edit", ctaUrl: "/shop", altText: "x" } }),
      item({
        id: "nav-2",
        destinationType: "BOOKS",
        destination: "/books",
        megaMenuMode: "MANUAL",
        manualColumns: [{ id: "c1", heading: "Browse", enabled: true, links: [{ label: "Fiction", destination: "/shop/category/fiction" }] }],
      }),
    ]);
    expect(res.success).toBe(true);
    expect(res.data.header.primaryNav.items[0].categoryId).toBe("cat-1");
    expect(res.data.header.primaryNav.items[1].manualColumns[0].links[0].label).toBe("Fiction");
  });

  it("accepts all supported destination types and legacy lower-case ones", () => {
    for (const t of ["CATEGORY", "COLLECTION", "PAGE", "BOOKS", "NEW_ARRIVALS", "CUSTOM_URL", "category", "custom", "new"]) {
      expect(parse([item({ destinationType: t })]).success).toBe(true);
    }
    expect(parse([item({ destinationType: "TELEPORT" })]).success).toBe(false);
  });

  it("validates allowed mega menu modes", () => {
    for (const m of ["DISABLED", "AUTO_FROM_CATEGORY", "MANUAL"]) {
      expect(parse([item({ megaMenuMode: m })]).success).toBe(true);
    }
    const bad = parse([item({ megaMenuMode: "HOVER" })]);
    expect(bad.success).toBe(false);
    expect(bad.error.errors[0].path.join(".")).toMatch(/megaMenuMode/);
  });

  it("rejects unsafe URLs in destination, manual links, and promo CTA/image", () => {
    for (const bad of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "java\tscript:alert(1)", "data:text/html,x", "vbscript:x", "file:///etc/passwd"]) {
      expect(parse([item({ destination: bad })]).success).toBe(false);
      expect(parse([item({ megaMenuMode: "MANUAL", manualColumns: [{ links: [{ label: "x", destination: bad }] }] })]).success).toBe(false);
      expect(parse([item({ promoCard: { enabled: true, ctaUrl: bad } })]).success).toBe(false);
      expect(parse([item({ promoCard: { enabled: true, image: bad } })]).success).toBe(false);
    }
    expect(parse([item({ destination: "https://example.com/a?b=c" })]).success).toBe(true);
  });

  it("enforces array limits", () => {
    expect(parse(Array.from({ length: 30 }, (_, i) => item({ id: `n${i}` }))).success).toBe(true);
    expect(parse(Array.from({ length: 31 }, (_, i) => item({ id: `n${i}` }))).success).toBe(false);
    expect(parse([item({ manualColumns: Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, links: [] })) })]).success).toBe(true);
    expect(parse([item({ manualColumns: Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, links: [] })) })]).success).toBe(false);
    const links = (n) => Array.from({ length: n }, (_, i) => ({ label: `L${i}`, destination: "/x" }));
    expect(parse([item({ manualColumns: [{ links: links(12) }] })]).success).toBe(true);
    expect(parse([item({ manualColumns: [{ links: links(13) }] })]).success).toBe(false);
  });

  it("keeps partial/legacy header settings valid", () => {
    expect(settingsValidationSchema.safeParse({ header: { showUtilityBar: true, stickyHeader: true, showCategoryCircles: true } }).success).toBe(true);
    expect(settingsValidationSchema.safeParse({ header: { stickyMode: "none", circularCategories: { enabled: false } } }).success).toBe(true);
    expect(parse([{ id: "l1", label: "Old", enabled: true, destinationType: "category", destination: "/shop" }]).success).toBe(true);
    expect(settingsValidationSchema.safeParse({ header: { stickyMode: "sometimes" } }).success).toBe(false);
  });
});
