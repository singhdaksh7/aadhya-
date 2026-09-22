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
});
