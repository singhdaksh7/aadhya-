import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb, seedTestAdmin, seedTestCategory } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";

const app = createApp();

async function getToken() {
  await seedTestAdmin();
  const res = await request(app)
    .post("/api/admin/auth/login")
    .send({ email: env.admin.email, password: env.admin.password });
  return res.body.data.accessToken;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("product CRUD + storefront rules", () => {
  it("creates a physical product", async () => {
    const token = await getToken();
    const category = await seedTestCategory();

    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Ceramic Vase",
        productType: "PHYSICAL",
        categoryId: category.id,
        price: 1890,
        stockQuantity: 10,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe("ceramic-vase");
    expect(res.body.data.productType).toBe("PHYSICAL");
    expect(res.body.data.bookDetail).toBeNull();
  });

  it("creates a book with book metadata", async () => {
    const token = await getToken();
    const category = await seedTestCategory({ name: "Books", slug: "books" });

    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Everyday Resilience",
        productType: "BOOK",
        categoryId: category.id,
        price: 399,
        bookDetail: { author: "Dr. Aqsa", isbn: "9780000000001", pageCount: 180 },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.bookDetail.author).toBe("Dr. Aqsa");
    expect(res.body.data.bookDetail.isbn).toBe("9780000000001");
  });

  it("hides inactive products from the public catalog and product-detail route", async () => {
    const token = await getToken();
    const category = await seedTestCategory();
    const create = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Hidden Product", productType: "PHYSICAL", categoryId: category.id, price: 100, isActive: false });

    const list = await request(app).get("/api/products");
    expect(list.body.data.find((p) => p.slug === "hidden-product")).toBeUndefined();

    const detail = await request(app).get(`/api/products/${create.body.data.slug}`);
    expect(detail.status).toBe(404);
  });

  it("supports search, type filter, and pagination on the public listing", async () => {
    const token = await getToken();
    const category = await seedTestCategory();
    for (const name of ["Alpha Candle", "Beta Candle", "Gamma Basket"]) {
      await request(app)
        .post("/api/admin/products")
        .set("Authorization", `Bearer ${token}`)
        .send({ name, productType: "PHYSICAL", categoryId: category.id, price: 100 });
    }

    const searchRes = await request(app).get("/api/products?search=Candle");
    expect(searchRes.body.data).toHaveLength(2);

    const pageRes = await request(app).get("/api/products?limit=1&page=2");
    expect(pageRes.body.meta).toMatchObject({ page: 2, limit: 1, total: 3 });
    expect(pageRes.body.data).toHaveLength(1);
  });

  it("enforces stock rules: trackInventory + stockQuantity are authoritative", async () => {
    const token = await getToken();
    const category = await seedTestCategory();

    const outOfStock = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Sold Out Candle", productType: "PHYSICAL", categoryId: category.id, price: 100, stockQuantity: 0 });
    expect(outOfStock.body.data.stockQuantity).toBe(0);
    expect(outOfStock.body.data.trackInventory).toBe(true);

    const untracked = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Made To Order Basket",
        productType: "PHYSICAL",
        categoryId: category.id,
        price: 100,
        stockQuantity: 0,
        trackInventory: false,
      });
    expect(untracked.body.data.trackInventory).toBe(false);
  });

  it("rejects a duplicate SKU", async () => {
    const token = await getToken();
    const category = await seedTestCategory();
    await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Product One", productType: "PHYSICAL", categoryId: category.id, price: 100, sku: "SKU-1" });

    const dup = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Product Two", productType: "PHYSICAL", categoryId: category.id, price: 100, sku: "SKU-1" });

    expect(dup.status).toBe(409);
  });

  it("rejects product writes without admin auth", async () => {
    const category = await seedTestCategory();
    const res = await request(app)
      .post("/api/admin/products")
      .send({ name: "No Auth", productType: "PHYSICAL", categoryId: category.id, price: 100 });
    expect(res.status).toBe(401);
  });

  it("deletes a product", async () => {
    const token = await getToken();
    const category = await seedTestCategory();
    const create = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Deletable", productType: "PHYSICAL", categoryId: category.id, price: 100 });

    const del = await request(app)
      .delete(`/api/admin/products/${create.body.data.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);

    const detail = await request(app).get(`/api/products/deletable`);
    expect(detail.status).toBe(404);
  });
});
