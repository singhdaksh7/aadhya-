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

describe("category CRUD", () => {
  it("creates a category with a generated slug", async () => {
    const token = await getToken();
    const res = await request(app)
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Home Decor" });

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe("home-decor");
  });

  it("rejects category writes without admin auth", async () => {
    const res = await request(app).post("/api/admin/categories").send({ name: "Home Decor" });
    expect(res.status).toBe(401);
  });

  it("lists only active categories on the public endpoint", async () => {
    await seedTestCategory({ name: "Active One", slug: "active-one", isActive: true });
    await seedTestCategory({ name: "Hidden One", slug: "hidden-one", isActive: false });

    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.slug)).toEqual(["active-one"]);
  });

  it("updates a category", async () => {
    const token = await getToken();
    const category = await seedTestCategory();

    const res = await request(app)
      .patch(`/api/admin/categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isActive: false, sortOrder: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.sortOrder).toBe(5);
  });

  it("refuses to delete a category that still has products", async () => {
    const token = await getToken();
    const category = await seedTestCategory();
    await prisma.product.create({
      data: {
        name: "Linked Product",
        slug: "linked-product",
        productType: "PHYSICAL",
        categoryId: category.id,
        price: 100,
      },
    });

    const res = await request(app)
      .delete(`/api/admin/categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it("deletes an empty category", async () => {
    const token = await getToken();
    const category = await seedTestCategory();

    const res = await request(app)
      .delete(`/api/admin/categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  it("creates a subcategory under a parent and prevents circular parent relationships", async () => {
    const token = await getToken();
    const parent = await seedTestCategory({ name: "Home Decor", slug: "home-decor-parent" });

    const childRes = await request(app)
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Wall Decor", parentId: parent.id });

    expect(childRes.status).toBe(201);
    expect(childRes.body.data.parentId).toBe(parent.id);

    // Attempting to set parent as its own child (circular relationship) should fail
    const circularRes = await request(app)
      .patch(`/api/admin/categories/${parent.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ parentId: childRes.body.data.id });

    expect(circularRes.status).toBe(400);
  });

  it("manages dynamic header navigation items", async () => {
    const token = await getToken();
    
    // Create menu
    const menuRes = await request(app)
      .post("/api/navigation/admin/menus")
      .set("Authorization", `Bearer ${token}`)
      .send({ code: "HEADER_TEST_MENU", title: "Test Header Menu" });

    expect(menuRes.status).toBe(201);
    const menuId = menuRes.body.data.id;

    // Add item
    const itemRes = await request(app)
      .post(`/api/navigation/admin/menus/${menuId}/items`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Custom Shop", url: "/shop", type: "CUSTOM" });

    expect(itemRes.status).toBe(201);

    // Fetch public navigation menu
    const publicRes = await request(app).get("/api/navigation/HEADER_TEST_MENU");
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.items[0].title).toBe("Custom Shop");
  });
});

