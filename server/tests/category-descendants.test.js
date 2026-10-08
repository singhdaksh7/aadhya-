import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb, seedTestProduct } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

const cat = (name, slug, parentId = null, isActive = true) => prisma.category.create({ data: { name, slug, parentId, isActive } });

async function tree() {
  const decor = await cat("Home Decor", "home-decor");
  const vases = await cat("Vases", "vases", decor.id);
  const tall = await cat("Tall Vases", "tall-vases", vases.id);
  const wall = await cat("Wall Decor", "wall-decor", decor.id, false); // hidden child still counts for the parent
  const lighting = await cat("Lighting", "lighting");
  const lamps = await cat("Table Lamps", "table-lamps", lighting.id);
  const p = {
    root: await seedTestProduct({ category: decor, name: "Decor Root Item", slug: "decor-root-item" }),
    vase: await seedTestProduct({ category: vases, name: "Vase", slug: "vase" }),
    tall: await seedTestProduct({ category: tall, name: "Tall Vase", slug: "tall-vase" }),
    wall: await seedTestProduct({ category: wall, name: "Wall Hanging", slug: "wall-hanging" }),
    lamp: await seedTestProduct({ category: lamps, name: "Lamp", slug: "lamp" }),
    light: await seedTestProduct({ category: lighting, name: "Lighting Root Item", slug: "lighting-root-item" }),
    inactive: await seedTestProduct({ category: vases, name: "Hidden Vase", slug: "hidden-vase", isActive: false }),
  };
  return { decor, vases, tall, wall, lighting, lamps, p };
}

const names = (res) => res.body.data.map((x) => x.name).sort();

describe("public product listing includes descendant categories", () => {
  it("a root category returns its own products and every descendant's (nested, even hidden children)", async () => {
    await tree();
    const res = await request(app).get("/api/products?category=home-decor&limit=50");
    expect(res.status).toBe(200);
    expect(names(res)).toEqual(["Decor Root Item", "Tall Vase", "Vase", "Wall Hanging"]);
  });

  it("a child category returns only its own products plus its descendants", async () => {
    await tree();
    const res = await request(app).get("/api/products?category=vases&limit=50");
    expect(names(res)).toEqual(["Tall Vase", "Vase"]);
  });

  it("a leaf category returns only its own products", async () => {
    await tree();
    const res = await request(app).get("/api/products?category=tall-vases&limit=50");
    expect(names(res)).toEqual(["Tall Vase"]);
  });

  it("unrelated categories are excluded", async () => {
    await tree();
    const res = await request(app).get("/api/products?category=lighting&limit=50");
    expect(names(res)).toEqual(["Lamp", "Lighting Root Item"]);
  });

  it("returns each product once (no duplicates) and a correct total", async () => {
    await tree();
    const res = await request(app).get("/api/products?category=home-decor&limit=50");
    const ids = res.body.data.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(res.body.meta.total).toBe(4);
  });

  it("the subcategory and categoryId parameters also include descendants", async () => {
    const t = await tree();
    const sub = await request(app).get("/api/products?subcategory=vases&limit=50");
    expect(names(sub)).toEqual(["Tall Vase", "Vase"]);
    const byId = await request(app).get(`/api/products?categoryId=${t.decor.id}&limit=50`);
    expect(names(byId)).toEqual(["Decor Root Item", "Tall Vase", "Vase", "Wall Hanging"]);
  });

  it("inactive products stay hidden and an unknown category returns nothing", async () => {
    await tree();
    const hidden = await request(app).get("/api/products?category=vases&limit=50");
    expect(names(hidden)).not.toContain("Hidden Vase");
    const none = await request(app).get("/api/products?category=does-not-exist&limit=50");
    expect(none.body.data).toEqual([]);
  });

  it("listing without a category filter is unchanged", async () => {
    await tree();
    const res = await request(app).get("/api/products?limit=50");
    expect(res.body.data.length).toBe(6);
  });
});
