import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { updatePageSection } from "../src/modules/pages/pages.service.js";

const request = supertest(createApp());
const DAY = 24 * 60 * 60 * 1000;
const suffix = Date.now();

describe("effective New Arrivals across list API, homepage and collections", () => {
  const ids = {};
  let categoryId;
  let sectionId;
  let colSlug;

  const make = (key, { daysOld, manual = false }) =>
    prisma.product.create({
      data: {
        name: `NA ${key} ${suffix}`, slug: `na-${key}-${suffix}`, productType: "PHYSICAL", categoryId,
        price: 500, stockQuantity: 5, isActive: true, isNewArrival: manual,
        createdAt: new Date(Date.now() - daysOld * DAY),
      },
    }).then((p) => { ids[key] = p.id; });

  beforeAll(async () => {
    await request.get("/api/pages/home");
    const home = await prisma.page.findUnique({ where: { slug: "home" }, include: { sections: true } });
    sectionId = home.sections.find((s) => s.type === "NEW_ARRIVALS").id;
    await updatePageSection(sectionId, { settings: { limit: 24, sourceMode: "AUTO" } });
    categoryId = (await prisma.category.create({ data: { name: "NA cat", slug: `na-cat-${suffix}`, sortOrder: 1 } })).id;
    await make("fresh", { daysOld: 0 });
    await make("sixdays", { daysOld: 6 });
    await make("old", { daysOld: 10 });
    await make("oldmanual", { daysOld: 60, manual: true });
    await make("freshoff", { daysOld: 1, manual: false });
    colSlug = `na-col-${suffix}`;
    await prisma.collection.create({ data: { title: "NA col", slug: colSlug, type: "NEW_ARRIVAL", isActive: true } });
  });

  afterAll(async () => {
    await updatePageSection(sectionId, { settings: { limit: 4, sourceMode: "AUTO" } });
    await prisma.collection.deleteMany({ where: { slug: colSlug } });
    await prisma.product.deleteMany({ where: { id: { in: Object.values(ids) } } });
    await prisma.category.delete({ where: { id: categoryId } });
  });

  it("list API newArrival=true: auto-window and manual products in, old unflagged out", async () => {
    const res = await request.get(`/api/products?newArrival=true&category=na-cat-${suffix}&limit=50`);
    expect(res.status).toBe(200);
    const got = res.body.data.map((p) => p.id);
    expect(got).toEqual(expect.arrayContaining([ids.fresh, ids.sixdays, ids.oldmanual, ids.freshoff]));
    expect(got).not.toContain(ids.old);
  });

  it("list API newArrival=false returns exactly the non-new products", async () => {
    const res = await request.get(`/api/products?newArrival=false&category=na-cat-${suffix}&limit=50`);
    expect(res.body.data.map((p) => p.id)).toEqual([ids.old]);
  });

  it("serialized products carry the effective flag used by badges", async () => {
    const res = await request.get(`/api/products?category=na-cat-${suffix}&limit=50`);
    const flag = Object.fromEntries(res.body.data.map((p) => [p.id, p.isNewArrival]));
    expect(flag[ids.fresh]).toBe(true);
    expect(flag[ids.oldmanual]).toBe(true);
    expect(flag[ids.old]).toBe(false);
  });

  it("homepage New Arrivals section uses the same rule", async () => {
    const res = await request.get("/api/pages/home");
    const section = res.body.data.sections.find((s) => s.id === sectionId);
    const got = section.products.map((p) => p.id);
    expect(got).toEqual(expect.arrayContaining([ids.fresh, ids.sixdays, ids.oldmanual]));
    expect(got).not.toContain(ids.old);
  });

  it("NEW_ARRIVAL collection uses the same rule", async () => {
    const res = await request.get(`/api/collections/${colSlug}`);
    const got = res.body.data.products.map((p) => p.id);
    expect(got).toEqual(expect.arrayContaining([ids.fresh, ids.sixdays, ids.oldmanual]));
    expect(got).not.toContain(ids.old);
  });

  it("editing an old product's price does not make it new again", async () => {
    await prisma.product.update({ where: { id: ids.old }, data: { price: 777 } });
    const res = await request.get(`/api/products?newArrival=true&category=na-cat-${suffix}&limit=50`);
    expect(res.body.data.map((p) => p.id)).not.toContain(ids.old);
  });

  it("MANUAL mode still returns exactly the curated products (and AUTO restores the effective rule)", async () => {
    await updatePageSection(sectionId, { settings: { limit: 24, sourceMode: "MANUAL", productIds: [ids.old] } });
    try {
      const res = await request.get("/api/pages/home");
      const section = res.body.data.sections.find((s) => s.id === sectionId);
      expect(section.products.map((p) => p.id)).toEqual([ids.old]);
    } finally {
      await updatePageSection(sectionId, { settings: { limit: 24, sourceMode: "AUTO" } });
    }
    const after = await request.get("/api/pages/home");
    const auto = after.body.data.sections.find((s) => s.id === sectionId).products.map((p) => p.id);
    expect(auto).not.toContain(ids.old);
    expect(auto).toContain(ids.fresh);
  });
});
