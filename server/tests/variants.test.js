import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import { registerCustomer, resetDb, seedTestAdmin, seedTestCategory, seedTestProduct } from "./helpers.js";
const app = createApp();
async function adminToken() { await seedTestAdmin(); return (await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password })).body.data.accessToken; }
beforeEach(resetDb); afterAll(async () => { await resetDb(); await prisma.$disconnect(); });
describe("product variants", () => {
  it("supports protected CRUD and keeps inactive variants out of public detail", async () => {
    const token = await adminToken(); const product = await seedTestProduct({ price: 100, salePrice: 90 });
    expect((await request(app).post(`/api/admin/products/${product.id}/variants`).send({ name: "Small", sku: "V-S", stockQuantity: 3 })).status).toBe(401);
    const created = await request(app).post(`/api/admin/products/${product.id}/variants`).set("Authorization", `Bearer ${token}`).send({ name: "Small", sku: "V-S", stockQuantity: 3, priceOverride: 80, attributes: { size: "S" } });
    expect(created.status).toBe(201); expect((await request(app).get(`/api/admin/products/${product.id}/variants`).set("Authorization", `Bearer ${token}`)).body.data).toHaveLength(1);
    expect((await request(app).patch(`/api/admin/products/${product.id}/variants/${created.body.data.id}`).set("Authorization", `Bearer ${token}`).send({ isActive: false })).status).toBe(200);
    expect((await request(app).get(`/api/products/${product.slug}`)).body.data.variants).toEqual([]);
    expect((await request(app).delete(`/api/admin/products/${product.id}/variants/${created.body.data.id}`).set("Authorization", `Bearer ${token}`)).status).toBe(204);
  });
  it("enforces variant product ownership and SKU uniqueness", async () => {
    const token = await adminToken(); const category = await seedTestCategory(); const one = await seedTestProduct({ category }); const two = await seedTestProduct({ category, name: "Other", slug: "other" });
    const first = await request(app).post(`/api/admin/products/${one.id}/variants`).set("Authorization", `Bearer ${token}`).send({ name: "One", sku: "UNIQUE", stockQuantity: 1 });
    expect((await request(app).post(`/api/admin/products/${two.id}/variants`).set("Authorization", `Bearer ${token}`).send({ name: "Two", sku: "UNIQUE", stockQuantity: 1 })).status).toBe(409);
    expect((await request(app).patch(`/api/admin/products/${two.id}/variants/${first.body.data.id}`).set("Authorization", `Bearer ${token}`).send({ name: "bad" })).status).toBe(404);
  });
  it("cart lines merge by product and variant, never client price", async () => {
    const product = await seedTestProduct({ stockQuantity: 99 }); const [a, b] = await Promise.all([prisma.productVariant.create({ data: { productId: product.id, name: "A", sku: "A", stockQuantity: 3, priceOverride: 50 } }), prisma.productVariant.create({ data: { productId: product.id, name: "B", sku: "B", stockQuantity: 4 } })]);
    const customer = await registerCustomer(app); const auth = { Authorization: `Bearer ${customer.accessToken}` };
    await request(app).post("/api/cart/items").set(auth).send({ slug: product.slug, variantId: a.id, quantity: 1, price: 1 });
    await request(app).post("/api/cart/items").set(auth).send({ slug: product.slug, variantId: a.id, quantity: 2 });
    await request(app).post("/api/cart/items").set(auth).send({ slug: product.slug, variantId: b.id, quantity: 1 });
    const cart = await request(app).get("/api/cart").set(auth); expect(cart.body.data).toHaveLength(2); expect(cart.body.data.find((x) => x.variant.id === a.id).quantity).toBe(3);
    expect((await request(app).post("/api/cart/items").set(auth).send({ slug: product.slug, variantId: "00000000-0000-0000-0000-000000000000", quantity: 1 })).status).toBe(400);
  });
});
