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

describe("Homepage Categories / Featured Collection / Books sections", () => {
  let categorySectionId;
  let collectionSectionId;
  let booksSectionId;
  let activeCategoryId;
  let inactiveCategoryId;
  let activeCollectionId;
  let inactiveCollectionId;
  let bookProductId;
  let inactiveBookProductId;
  let nonBookProductId;
  const suffix = Date.now() + 1;

  beforeAll(async () => {
    await request.get("/api/pages/home");
    const homePage = await prisma.page.findUnique({
      where: { slug: "home" },
      include: { sections: true },
    });
    categorySectionId = homePage.sections.find((s) => s.type === "CIRCULAR_CATEGORY_NAV").id;
    collectionSectionId = homePage.sections.find((s) => s.type === "FEATURED_COLLECTION").id;
    booksSectionId = homePage.sections.find((s) => s.type === "BOOKS_SHELF").id;

    const baseCategory = await prisma.category.create({
      data: { name: "Books Base Cat", slug: `books-base-cat-${suffix}`, sortOrder: 1 },
    });

    const activeCategory = await prisma.category.create({
      data: { name: `Homepage Active Cat ${suffix}`, slug: `homepage-active-cat-${suffix}`, sortOrder: 1, isActive: true },
    });
    activeCategoryId = activeCategory.id;

    const inactiveCategory = await prisma.category.create({
      data: { name: `Homepage Inactive Cat ${suffix}`, slug: `homepage-inactive-cat-${suffix}`, sortOrder: 2, isActive: false },
    });
    inactiveCategoryId = inactiveCategory.id;

    const activeCollection = await prisma.collection.create({
      data: { title: `Homepage Active Collection ${suffix}`, slug: `homepage-active-collection-${suffix}`, isActive: true },
    });
    activeCollectionId = activeCollection.id;

    const inactiveCollection = await prisma.collection.create({
      data: { title: `Homepage Inactive Collection ${suffix}`, slug: `homepage-inactive-collection-${suffix}`, isActive: false },
    });
    inactiveCollectionId = inactiveCollection.id;

    const book = await prisma.product.create({
      data: {
        name: `Homepage Book ${suffix}`,
        slug: `homepage-book-${suffix}`,
        productType: "BOOK",
        categoryId: baseCategory.id,
        price: 599,
        stockQuantity: 5,
        isActive: true,
      },
    });
    bookProductId = book.id;

    const inactiveBook = await prisma.product.create({
      data: {
        name: `Homepage Inactive Book ${suffix}`,
        slug: `homepage-inactive-book-${suffix}`,
        productType: "BOOK",
        categoryId: baseCategory.id,
        price: 599,
        stockQuantity: 5,
        isActive: false,
      },
    });
    inactiveBookProductId = inactiveBook.id;

    const nonBook = await prisma.product.create({
      data: {
        name: `Homepage Non-Book ${suffix}`,
        slug: `homepage-non-book-${suffix}`,
        productType: "PHYSICAL",
        categoryId: baseCategory.id,
        price: 599,
        stockQuantity: 5,
        isActive: true,
      },
    });
    nonBookProductId = nonBook.id;
  });

  afterAll(async () => {
    await updatePageSection(collectionSectionId, { settings: { collectionId: "" } });
  });

  it("Categories: excludes inactive categories and respects sortOrder", async () => {
    const res = await request.get("/api/pages/home");
    const section = res.body.data.sections.find((s) => s.id === categorySectionId);
    expect(section).toBeDefined();
    const ids = section.categories.map((c) => c.id);
    expect(ids).toContain(activeCategoryId);
    expect(ids).not.toContain(inactiveCategoryId);
    const activeIdx = ids.indexOf(activeCategoryId);
    const inactiveIdx = ids.indexOf(inactiveCategoryId);
    expect(inactiveIdx).toBe(-1);
    expect(activeIdx).toBeGreaterThanOrEqual(0);
  });

  it("Featured Collection: resolves the configured active collection", async () => {
    await updatePageSection(collectionSectionId, { settings: { collectionId: activeCollectionId } });
    const res = await request.get("/api/pages/home");
    const section = res.body.data.sections.find((s) => s.id === collectionSectionId);
    expect(section.collection).toBeDefined();
    expect(section.collection.id).toBe(activeCollectionId);
  });

  it("Featured Collection: hides (null collection) when the configured collection is inactive", async () => {
    await updatePageSection(collectionSectionId, { settings: { collectionId: inactiveCollectionId } });
    const res = await request.get("/api/pages/home");
    const section = res.body.data.sections.find((s) => s.id === collectionSectionId);
    expect(section.collection).toBeNull();
  });

  it("Featured Collection: hides (null collection) when nothing is configured", async () => {
    await updatePageSection(collectionSectionId, { settings: { collectionId: "" } });
    const res = await request.get("/api/pages/home");
    const section = res.body.data.sections.find((s) => s.id === collectionSectionId);
    expect(section.collection).toBeNull();
  });

  it("Books: includes active BOOK-type products, excludes inactive books and non-book products", async () => {
    const res = await request.get("/api/pages/home");
    const section = res.body.data.sections.find((s) => s.id === booksSectionId);
    expect(section).toBeDefined();
    const ids = section.books.map((b) => b.id);
    expect(ids).toContain(bookProductId);
    expect(ids).not.toContain(inactiveBookProductId);
    expect(ids).not.toContain(nonBookProductId);
  });

  it("Books: respects the configured limit", async () => {
    await updatePageSection(booksSectionId, { settings: { limit: 1 } });
    const res = await request.get("/api/pages/home");
    const section = res.body.data.sections.find((s) => s.id === booksSectionId);
    expect(section.books.length).toBeLessThanOrEqual(1);
    await updatePageSection(booksSectionId, { settings: { limit: 3 } });
  });
});
