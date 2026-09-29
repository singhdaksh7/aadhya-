import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { updatePageSection } from "../src/modules/pages/pages.service.js";

const app = createApp();
const request = supertest(app);

describe("Homepage product merchandising (New Arrivals / Best Sellers)", () => {
  let newArrivalProductId;
  let bestSellerProductId;
  let inactiveNewArrivalId;
  let plainProductId;
  let newArrivalsSectionId;
  let bestSellersSectionId;
  const suffix = Date.now();

  beforeAll(async () => {
    // Ensure the default homepage (and its NEW_ARRIVALS / BEST_SELLERS sections) exists.
    await request.get("/api/pages/home");
    const homePage = await prisma.page.findUnique({
      where: { slug: "home" },
      include: { sections: true },
    });
    newArrivalsSectionId = homePage.sections.find((s) => s.type === "NEW_ARRIVALS").id;
    bestSellersSectionId = homePage.sections.find((s) => s.type === "BEST_SELLERS").id;

    // Reset both sections to a clean AUTO state with a small limit for deterministic assertions.
    await updatePageSection(newArrivalsSectionId, { settings: { limit: 2, sourceMode: "AUTO" } });
    await updatePageSection(bestSellersSectionId, { settings: { limit: 2, sourceMode: "AUTO" } });

    const category = await prisma.category.create({
      data: { name: "Homepage Test Cat", slug: `homepage-test-cat-${suffix}`, sortOrder: 1 },
    });

    const na = await prisma.product.create({
      data: {
        name: `Homepage New Arrival ${suffix}`,
        slug: `homepage-new-arrival-${suffix}`,
        productType: "PHYSICAL",
        categoryId: category.id,
        price: 999,
        stockQuantity: 5,
        isNewArrival: true,
        isActive: true,
      },
    });
    newArrivalProductId = na.id;

    const bs = await prisma.product.create({
      data: {
        name: `Homepage Best Seller ${suffix}`,
        slug: `homepage-best-seller-${suffix}`,
        productType: "PHYSICAL",
        categoryId: category.id,
        price: 1299,
        stockQuantity: 5,
        isBestSeller: true,
        isActive: true,
      },
    });
    bestSellerProductId = bs.id;

    const inactive = await prisma.product.create({
      data: {
        name: `Homepage Inactive New Arrival ${suffix}`,
        slug: `homepage-inactive-new-arrival-${suffix}`,
        productType: "PHYSICAL",
        categoryId: category.id,
        price: 499,
        stockQuantity: 5,
        isNewArrival: true,
        isActive: false,
      },
    });
    inactiveNewArrivalId = inactive.id;

    const plain = await prisma.product.create({
      data: {
        name: `Homepage Plain Product ${suffix}`,
        slug: `homepage-plain-product-${suffix}`,
        productType: "PHYSICAL",
        categoryId: category.id,
        price: 299,
        stockQuantity: 5,
        isActive: true,
      },
    });
    plainProductId = plain.id;
  });

  afterAll(async () => {
    // Restore defaults so other suites/manual runs see the standard homepage config.
    await updatePageSection(newArrivalsSectionId, { settings: { limit: 4, sourceMode: "AUTO" } });
    await updatePageSection(bestSellersSectionId, { settings: { limit: 4, sourceMode: "AUTO" } });
  });

  it("AUTO mode: New Arrivals section includes the flagged active product, excludes inactive/unflagged ones", async () => {
    const res = await request.get("/api/pages/home");
    expect(res.status).toBe(200);
    const section = res.body.data.sections.find((s) => s.id === newArrivalsSectionId);
    expect(section).toBeDefined();
    const ids = section.products.map((p) => p.id);
    expect(ids).toContain(newArrivalProductId);
    expect(ids).not.toContain(inactiveNewArrivalId);
    expect(ids).not.toContain(plainProductId);
  });

  it("AUTO mode: Best Sellers section includes the flagged active product", async () => {
    const res = await request.get("/api/pages/home");
    const section = res.body.data.sections.find((s) => s.id === bestSellersSectionId);
    const ids = section.products.map((p) => p.id);
    expect(ids).toContain(bestSellerProductId);
    expect(ids).not.toContain(plainProductId);
  });

  it("respects the configured limit", async () => {
    await updatePageSection(newArrivalsSectionId, { settings: { limit: 1, sourceMode: "AUTO" } });
    const res = await request.get("/api/pages/home");
    const section = res.body.data.sections.find((s) => s.id === newArrivalsSectionId);
    expect(section.products.length).toBeLessThanOrEqual(1);
    await updatePageSection(newArrivalsSectionId, { settings: { limit: 2, sourceMode: "AUTO" } });
  });

  it("MANUAL mode: renders only the configured productIds, in order, skipping inactive/missing ones", async () => {
    await updatePageSection(newArrivalsSectionId, {
      settings: {
        sourceMode: "MANUAL",
        limit: 8,
        productIds: [inactiveNewArrivalId, bestSellerProductId, newArrivalProductId],
      },
    });
    const res = await request.get("/api/pages/home");
    const section = res.body.data.sections.find((s) => s.id === newArrivalsSectionId);
    const ids = section.products.map((p) => p.id);
    expect(ids).not.toContain(inactiveNewArrivalId); // inactive is excluded even if selected
    expect(ids).toEqual([bestSellerProductId, newArrivalProductId]); // stored order preserved
    await updatePageSection(newArrivalsSectionId, { settings: { limit: 2, sourceMode: "AUTO" } });
  });

  it("empty state: section produces an empty products array (not a fake fallback) when nothing matches", async () => {
    const emptyCategory = await prisma.category.create({
      data: { name: "Empty Cat", slug: `empty-cat-${suffix}`, sortOrder: 2 },
    });
    void emptyCategory;
    await updatePageSection(bestSellersSectionId, { settings: { sourceMode: "MANUAL", limit: 4, productIds: [] } });
    const res = await request.get("/api/pages/home");
    const section = res.body.data.sections.find((s) => s.id === bestSellersSectionId);
    expect(section.products).toEqual([]);
    await updatePageSection(bestSellersSectionId, { settings: { limit: 4, sourceMode: "AUTO" } });
  });

  it("validation: rejects an out-of-range limit and duplicate productIds are normalized", async () => {
    await expect(updatePageSection(newArrivalsSectionId, { settings: { limit: 999 } })).rejects.toThrow();

    const updated = await updatePageSection(newArrivalsSectionId, {
      settings: { sourceMode: "MANUAL", limit: 4, productIds: [newArrivalProductId, newArrivalProductId, bestSellerProductId] },
    });
    expect(updated.settings.productIds).toEqual([newArrivalProductId, bestSellerProductId]);
    await updatePageSection(newArrivalsSectionId, { settings: { limit: 2, sourceMode: "AUTO" } });
  });
});
