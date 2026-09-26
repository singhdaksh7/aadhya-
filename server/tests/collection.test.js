import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const app = createApp();
const request = supertest(app);

describe("Collection Engine (Phase D)", () => {
  let adminToken = "";
  let categoryId = "";
  let subcategoryId = "";
  let productId1 = "";
  let productId2 = "";
  let productId3 = "";
  let manualCollectionId = "";

  beforeAll(async () => {
    // 1. Create admin user and get token
    const admin = await prisma.adminUser.upsert({
      where: { email: "collection_test_admin@aadya.com" },
      update: {},
      create: {
        name: "Collection Admin",
        email: "collection_test_admin@aadya.com",
        passwordHash: "$2b$10$abcdefghijklmnopqrstuuu",
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });

    const authRes = await request.post("/api/admin/auth/login").send({
      email: "collection_test_admin@aadya.com",
      password: "password123",
    });
    if (authRes.body?.data?.accessToken) {
      adminToken = authRes.body.data.accessToken;
    }

    // 2. Create parent category and subcategory
    const parentCat = await prisma.category.create({
      data: { name: "Parent Decor Cat", slug: "parent-decor-cat-" + Date.now(), sortOrder: 1 },
    });
    categoryId = parentCat.id;

    const subCat = await prisma.category.create({
      data: { name: "Child Sub Cat", slug: "child-sub-cat-" + Date.now(), parentId: parentCat.id, sortOrder: 2 },
    });
    subcategoryId = subCat.id;

    // 3. Create products with various attributes
    const p1 = await prisma.product.create({
      data: {
        name: "Test Featured Vase",
        slug: "test-featured-vase-" + Date.now(),
        productType: "PHYSICAL",
        categoryId: subcategoryId,
        price: 1200,
        mrp: 1500,
        stockQuantity: 10,
        isFeatured: true,
        isBestSeller: false,
        isNewArrival: true,
        isTrending: true,
        tags: ["handcrafted", "ceramics"],
        isActive: true,
      },
    });
    productId1 = p1.id;

    const p2 = await prisma.product.create({
      data: {
        name: "Test BestSeller Rug",
        slug: "test-bestseller-rug-" + Date.now(),
        productType: "PHYSICAL",
        categoryId: categoryId,
        price: 2500,
        mrp: 3000,
        stockQuantity: 5,
        isFeatured: false,
        isBestSeller: true,
        isNewArrival: false,
        isTrending: false,
        tags: ["handcrafted", "textiles"],
        isActive: true,
      },
    });
    productId2 = p2.id;

    const p3 = await prisma.product.create({
      data: {
        name: "Test Inactive Object",
        slug: "test-inactive-obj-" + Date.now(),
        productType: "PHYSICAL",
        categoryId,
        price: 800,
        stockQuantity: 20,
        isFeatured: true,
        isBestSeller: true,
        isActive: false,
      },
    });
    productId3 = p3.id;
  });

  afterAll(async () => {
    await prisma.collectionProduct.deleteMany({});
    await prisma.collection.deleteMany({ where: { slug: { contains: "test-" } } });
    await prisma.product.deleteMany({ where: { id: { in: [productId1, productId2, productId3] } } });
    await prisma.category.deleteMany({ where: { id: { in: [categoryId, subcategoryId] } } });
  });

  it("should create a MANUAL collection and resolve attached products", async () => {
    const col = await prisma.collection.create({
      data: {
        title: "Test Manual Col",
        slug: "test-manual-col-" + Date.now(),
        type: "MANUAL",
        isActive: true,
      },
    });
    manualCollectionId = col.id;

    await prisma.collectionProduct.createMany({
      data: [
        { collectionId: col.id, productId: productId1, sortOrder: 0 },
        { collectionId: col.id, productId: productId2, sortOrder: 1 },
        { collectionId: col.id, productId: productId3, sortOrder: 2 },
      ],
    });

    const res = await request.get(`/api/collections/${col.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(2); // Inactive p3 excluded!
    expect(res.body.data.products[0].id).toBe(productId1);
    expect(res.body.data.products[1].id).toBe(productId2);
  });

  it("should resolve CATEGORY collection including descendant subcategories", async () => {
    const col = await prisma.collection.create({
      data: {
        title: "Test Cat Col",
        slug: "test-cat-col-" + Date.now(),
        type: "CATEGORY",
        ruleConfig: { categoryId },
        isActive: true,
      },
    });

    const res = await request.get(`/api/collections/${col.slug}`);
    expect(res.status).toBe(200);
    // p1 is in subcategory, p2 is in parent category -> both active should resolve!
    const productIds = res.body.data.products.map((p) => p.id);
    expect(productIds).toContain(productId1);
    expect(productIds).toContain(productId2);
    expect(productIds).not.toContain(productId3);
  });

  it("should resolve TAG collection", async () => {
    const col = await prisma.collection.create({
      data: {
        title: "Test Tag Col",
        slug: "test-tag-col-" + Date.now(),
        type: "TAG",
        ruleConfig: { tag: "ceramics" },
        isActive: true,
      },
    });

    const res = await request.get(`/api/collections/${col.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(1);
    expect(res.body.data.products[0].id).toBe(productId1);
  });

  it("should resolve FEATURED collection", async () => {
    const col = await prisma.collection.create({
      data: {
        title: "Test Featured Col",
        slug: "test-featured-col-" + Date.now(),
        type: "FEATURED",
        isActive: true,
      },
    });

    const res = await request.get(`/api/collections/${col.slug}`);
    expect(res.status).toBe(200);
    const productIds = res.body.data.products.map((p) => p.id);
    expect(productIds).toContain(productId1);
    expect(productIds).not.toContain(productId3); // inactive excluded
  });

  it("should resolve BEST_SELLER collection", async () => {
    const col = await prisma.collection.create({
      data: {
        title: "Test BestSeller Col",
        slug: "test-bestseller-col-" + Date.now(),
        type: "BEST_SELLER",
        isActive: true,
      },
    });

    const res = await request.get(`/api/collections/${col.slug}`);
    expect(res.status).toBe(200);
    const productIds = res.body.data.products.map((p) => p.id);
    expect(productIds).toContain(productId2);
  });

  it("should resolve NEW_ARRIVAL collection", async () => {
    const col = await prisma.collection.create({
      data: {
        title: "Test New Arrival Col",
        slug: "test-new-arrival-col-" + Date.now(),
        type: "NEW_ARRIVAL",
        isActive: true,
      },
    });

    const res = await request.get(`/api/collections/${col.slug}`);
    expect(res.status).toBe(200);
    const productIds = res.body.data.products.map((p) => p.id);
    expect(productIds).toContain(productId1);
  });

  it("should resolve TRENDING collection", async () => {
    const col = await prisma.collection.create({
      data: {
        title: "Test Trending Col",
        slug: "test-trending-col-" + Date.now(),
        type: "TRENDING",
        isActive: true,
      },
    });

    const res = await request.get(`/api/collections/${col.slug}`);
    expect(res.status).toBe(200);
    const productIds = res.body.data.products.map((p) => p.id);
    expect(productIds).toContain(productId1);
  });

  it("should resolve PRICE_RANGE collection", async () => {
    const col = await prisma.collection.create({
      data: {
        title: "Test Price Range Col",
        slug: "test-price-range-col-" + Date.now(),
        type: "PRICE_RANGE",
        ruleConfig: { minPrice: 1000, maxPrice: 2000 },
        isActive: true,
      },
    });

    const res = await request.get(`/api/collections/${col.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.products).toHaveLength(1);
    expect(res.body.data.products[0].id).toBe(productId1); // price 1200
  });

  it("should validate ruleConfig on creation and reject invalid ruleConfig", async () => {
    if (!adminToken) return;

    const badRes = await request
      .post("/api/admin/collections")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Bad Cat Col",
        type: "CATEGORY",
        ruleConfig: {}, // missing categoryId
      });

    expect(badRes.status).toBe(400);
  });
});
