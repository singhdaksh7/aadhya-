import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { catalogFiltersSchema } from "../src/modules/settings/settings.routes.js";
import { validateHomepageSettings } from "../src/modules/pages/homepage-content.js";
import { getPublicHomepage, updatePageSection } from "../src/modules/pages/pages.service.js";
import { seedTestAdmin } from "./helpers.js";

const request = supertest(createApp());

describe("catalog filter configuration schema", () => {
  it("accepts per-category groups with labels, order, selection mode and device flags", () => {
    const parsed = catalogFiltersSchema.parse({ categories: [{ categoryId: "cat-1", applyToSubcategories: true, groups: [
      { id: "g1", type: "BOOK_AUTHOR", label: "Author", order: 1, defaultOpen: true, selection: "MULTI", showDesktop: true, showMobile: false },
      { id: "g2", type: "ATTRIBUTE", attributeKey: "Material", selection: "SINGLE" },
      { id: "g3", type: "PRICE" },
    ] }] });
    expect(parsed.categories[0].groups).toHaveLength(3);
  });

  it("rejects unknown types, attribute groups without a key and oversized configs", () => {
    expect(() => catalogFiltersSchema.parse({ categories: [{ categoryId: "c", groups: [{ id: "x", type: "NOPE" }] }] })).toThrow();
    expect(() => catalogFiltersSchema.parse({ categories: [{ categoryId: "c", groups: [{ id: "x", type: "ATTRIBUTE" }] }] })).toThrow();
    expect(() => catalogFiltersSchema.parse({ categories: [{ categoryId: "c", groups: Array.from({ length: 15 }, (_, i) => ({ id: `g${i}`, type: "PRICE" })) }] })).toThrow();
  });
});

describe("catalog filter config is saved and read through admin settings", () => {
  let auth;
  beforeAll(async () => {
    await seedTestAdmin({ email: "filters-admin@test.local", password: "TestPassword123!" });
    const login = await request.post("/api/admin/auth/login").send({ email: "filters-admin@test.local", password: "TestPassword123!" });
    const token = login.body.data.accessToken;
    auth = { put: (url) => request.put(url).set("Authorization", `Bearer ${token}`) };
  });
  afterAll(async () => { await prisma.siteSetting.deleteMany({ where: { key: "catalogFilters" } }); });

  it("round-trips a per-category config and exposes it on the public settings endpoint", async () => {
    const config = { categories: [{ categoryId: "books-cat", applyToSubcategories: true, groups: [{ id: "a", type: "BOOK_AUTHOR", label: "Author", order: 0 }, { id: "b", type: "PRICE", order: 1 }] }, { categoryId: "lighting-cat", groups: [{ id: "m", type: "ATTRIBUTE", attributeKey: "Material", order: 0 }] }] };
    const saved = await auth.put("/api/admin/settings").send({ catalogFilters: config });
    expect(saved.status).toBe(200);
    const pub = await request.get("/api/settings");
    expect(pub.body.data.catalogFilters.categories).toHaveLength(2);
    expect(pub.body.data.catalogFilters.categories[0].groups[0]).toMatchObject({ type: "BOOK_AUTHOR", label: "Author" });
  });

  it("rejects an invalid config with a 400", async () => {
    const res = await auth.put("/api/admin/settings").send({ catalogFilters: { categories: [{ categoryId: "c", groups: [{ id: "x", type: "BOGUS" }] }] } });
    expect(res.status).toBe(400);
  });

  it("defaults to no custom config (every category falls back to the default filter set)", async () => {
    await prisma.siteSetting.deleteMany({ where: { key: "catalogFilters" } });
    const pub = await request.get("/api/settings");
    expect(pub.body.data.catalogFilters).toEqual({ categories: [] });
  });
});

describe("homepage demo reviews", () => {
  let sectionId;
  beforeAll(async () => {
    await request.get("/api/pages/home");
    sectionId = (await prisma.pageSection.findFirst({ where: { type: "TESTIMONIALS" } })).id;
  });
  const reviewsSection = async () => (await getPublicHomepage()).sections.find((s) => s.type === "TESTIMONIALS");
  const setDemo = (settings) => updatePageSection(sectionId, { settings });

  it("validates demo settings", () => {
    expect(validateHomepageSettings("TESTIMONIALS", { demoMode: true, demoReviews: [{ customerName: "Ananya S.", rating: 5, comment: "Lovely" }] })).toMatchObject({ demoMode: true });
    expect(() => validateHomepageSettings("TESTIMONIALS", { demoReviews: [{ customerName: "A", rating: 9, comment: "x" }] })).toThrow();
  });

  it("is off by default: no approved reviews and demo mode off -> nothing to show", async () => {
    await setDemo({ demoMode: false });
    const section = await reviewsSection();
    expect(section.reviewSource).toBe("NONE");
    expect(section.reviews).toEqual([]);
  });

  it("shows clearly flagged demo reviews only when demo mode is on and there are no real reviews", async () => {
    await prisma.productReview.deleteMany({});
    await setDemo({ demoMode: true });
    const section = await reviewsSection();
    expect(section.reviewSource).toBe("DEMO");
    expect(section.reviews.length).toBeGreaterThanOrEqual(3);
    section.reviews.forEach((r) => { expect(r.isDemo).toBe(true); expect(r.isVerifiedPurchase).toBe(false); });
    expect(section.reviewSummary.reviewCount).toBe(0);
    await setDemo({ demoMode: false });
  });

  it("real approved reviews always override demo mode and are never mixed with demo ones", async () => {
    const cat = await prisma.category.create({ data: { name: "Demo Rev Cat", slug: `demo-rev-cat-${Date.now()}` } });
    const product = await prisma.product.create({ data: { name: "Rev Product", slug: `rev-product-${Date.now()}`, price: 100, productType: "PHYSICAL", categoryId: cat.id, isActive: true } });
    const customer = await prisma.customer.create({ data: { name: "Real Person", email: `real${Date.now()}@example.com`, passwordHash: "x" } });
    await prisma.productReview.create({ data: { productId: product.id, customerId: customer.id, rating: 5, comment: "Genuinely lovely", status: "APPROVED" } });
    await setDemo({ demoMode: true });
    const section = await reviewsSection();
    expect(section.reviewSource).toBe("REAL");
    expect(section.reviews.map((r) => r.comment)).toEqual(["Genuinely lovely"]);
    expect(section.reviews.some((r) => r.isDemo)).toBe(false);
    await prisma.productReview.deleteMany({ where: { productId: product.id } });
    await setDemo({ demoMode: false });
  });
});
