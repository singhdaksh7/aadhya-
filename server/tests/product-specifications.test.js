import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb, seedTestAdmin, seedTestCategory } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";
import { normalizeSpecifications } from "../src/utils/specifications.js";

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

describe("normalizeSpecifications", () => {
  it("keeps array order and trims rows", () => {
    expect(
      normalizeSpecifications([
        { label: " Materials ", value: " Kilim " },
        { label: "Dimensions", value: "28 cm" },
      ]),
    ).toEqual([
      { label: "Materials", value: "Kilim" },
      { label: "Dimensions", value: "28 cm" },
    ]);
  });

  it("drops blank rows and reads the legacy object shape", () => {
    expect(normalizeSpecifications([{ label: "", value: "x" }, { label: "a", value: " " }])).toEqual([]);
    expect(normalizeSpecifications({ Fabric: "Cotton", Empty: "" })).toEqual([{ label: "Fabric", value: "Cotton" }]);
    expect(normalizeSpecifications(null)).toEqual([]);
    expect(normalizeSpecifications("nope")).toEqual([]);
  });
});

describe("product specifications API", () => {
  it("stores ordered free-form rows and exposes them on the public detail route", async () => {
    const token = await getToken();
    const category = await seedTestCategory();
    const specifications = [
      { label: "Materials", value: "Kilim (flat-woven textile)" },
      { label: "Dimensions", value: "28 cm (H) × 23 cm (W) / approx. 11 in × 9 in" },
      { label: "Care Instructions", value: "Spot clean" },
      { label: "Weight", value: "N/A" },
    ];
    const create = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Kilim Tab Bag", productType: "PHYSICAL", categoryId: category.id, price: 999, specifications });
    expect(create.status).toBe(201);

    const detail = await request(app).get("/api/products/kilim-tab-bag");
    expect(detail.status).toBe(200);
    expect(detail.body.data.specifications).toEqual(specifications);
  });

  it("edits, reorders and deletes rows through update", async () => {
    const token = await getToken();
    const category = await seedTestCategory();
    const create = await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Spec Product",
        productType: "PHYSICAL",
        categoryId: category.id,
        price: 100,
        specifications: [{ label: "A", value: "1" }, { label: "B", value: "2" }, { label: "C", value: "3" }],
      });
    const id = create.body.data.id;

    const update = await request(app)
      .patch(`/api/admin/products/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ specifications: [{ label: "C", value: "three" }, { label: "A", value: "1" }] });
    expect(update.status).toBe(200);

    const detail = await request(app).get("/api/products/spec-product");
    expect(detail.body.data.specifications).toEqual([
      { label: "C", value: "three" },
      { label: "A", value: "1" },
    ]);

    const cleared = await request(app)
      .patch(`/api/admin/products/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ specifications: [] });
    expect(cleared.status).toBe(200);
    const after = await request(app).get("/api/products/spec-product");
    expect(after.body.data.specifications).toEqual([]);
  });

  it("serves products without specifications and legacy object data as arrays", async () => {
    const token = await getToken();
    const category = await seedTestCategory();
    await request(app)
      .post("/api/admin/products")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Plain", productType: "PHYSICAL", categoryId: category.id, price: 10 });
    const plain = await request(app).get("/api/products/plain");
    expect(plain.status).toBe(200);
    expect(plain.body.data.specifications).toEqual([]);

    await prisma.product.update({ where: { slug: "plain" }, data: { specifications: { Fabric: "Cotton" } } });
    const legacy = await request(app).get("/api/products/plain");
    expect(legacy.body.data.specifications).toEqual([{ label: "Fabric", value: "Cotton" }]);
  });
});
