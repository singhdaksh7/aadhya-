import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { seedTestAdmin } from "./helpers.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import { DEFAULT_GIFTING_PAGE_SECTIONS } from "../src/modules/pages/gifting-content.js";

const app = createApp();
let token;
const auth = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  await seedTestAdmin();
  const login = await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password });
  token = login.body.data.accessToken;
});

describe("admin gifting page API", () => {
  it("requires admin auth", async () => {
    expect((await request(app).get("/api/admin/pages/gifting")).status).toBe(401);
    expect((await request(app).post("/api/admin/pages/gifting/restore-defaults")).status).toBe(401);
  });

  it("creates the page on demand and returns ordered sections including disabled ones", async () => {
    const first = await request(app).get("/api/admin/pages/gifting").set(auth());
    expect(first.status).toBe(200);
    expect(first.body.data.slug).toBe("gifting");
    const sections = first.body.data.sections;
    expect(sections.length).toBeGreaterThanOrEqual(1);

    await request(app).put(`/api/admin/pages/sections/${sections[0].id}`).set(auth()).send({ isEnabled: false }).expect(200);
    const again = await request(app).get("/api/admin/pages/gifting").set(auth());
    const hero = again.body.data.sections.find((s) => s.id === sections[0].id);
    expect(hero.isEnabled).toBe(false);
    const orders = again.body.data.sections.map((s) => s.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    await request(app).put(`/api/admin/pages/sections/${sections[0].id}`).set(auth()).send({ isEnabled: true }).expect(200);
  });

  it("restore-defaults only adds missing default types and never touches existing sections", async () => {
    const page = (await request(app).get("/api/admin/pages/gifting").set(auth())).body.data;
    const craft = page.sections.find((s) => s.type === "GIFTS_BY_CRAFT");
    if (craft) {
      await request(app).put(`/api/admin/pages/sections/${craft.id}`).set(auth()).send({ settings: { heading: "My custom craft heading", crafts: [], eyebrow: "Mine" } }).expect(200);
      const faq = page.sections.find((s) => s.type === "GIFTING_FAQ");
      if (faq) await request(app).delete(`/api/admin/pages/sections/${faq.id}`).set(auth()).expect(200);
    }
    const res = await request(app).post("/api/admin/pages/gifting/restore-defaults").set(auth());
    expect(res.status).toBe(200);
    const after = res.body.data.page.sections;
    expect(new Set(after.map((s) => s.type))).toEqual(new Set(DEFAULT_GIFTING_PAGE_SECTIONS.map((d) => d.type)));
    const keptCraft = after.find((s) => s.type === "GIFTS_BY_CRAFT");
    expect(keptCraft.settings.heading).toBe("My custom craft heading");
    // idempotent: nothing more to restore
    const second = await request(app).post("/api/admin/pages/gifting/restore-defaults").set(auth());
    expect(second.body.data.restoredTypes).toEqual([]);
  });

  it("reorders gifting sections through the page-scoped endpoint and rejects homepage sections", async () => {
    const page = (await request(app).get("/api/admin/pages/gifting").set(auth())).body.data;
    const ids = page.sections.map((s) => s.id);
    const swapped = [ids[1], ids[0], ...ids.slice(2)];
    const res = await request(app).put("/api/admin/pages/gifting/sections/reorder").set(auth()).send({ sectionIds: swapped });
    expect(res.status).toBe(200);
    expect(res.body.data.map((s) => s.id)).toEqual(swapped);
    const pub = await request(app).get("/api/pages/gifting");
    expect(pub.body.data.sections.map((s) => s.id).slice(0, 2)).toEqual([ids[1], ids[0]]);
    await request(app).put("/api/admin/pages/gifting/sections/reorder").set(auth()).send({ sectionIds: ids }).expect(200);

    const home = await prisma.page.findUnique({ where: { slug: "home" }, include: { sections: true } });
    if (home?.sections?.length) {
      const bad = await request(app).put("/api/admin/pages/gifting/sections/reorder").set(auth()).send({ sectionIds: [home.sections[0].id] });
      expect(bad.status).toBe(400);
    }
  });

  it("creates a section on the gifting page and a duplicate lands directly after its original", async () => {
    const created = await request(app).post("/api/admin/pages/gifting/sections").set(auth()).send({ type: "GIFTS_BY_CRAFT", name: "Extra crafts", settings: { heading: "Extra" }, sortOrder: 500 });
    expect(created.status).toBe(201);
    const page = (await request(app).get("/api/admin/pages/gifting").set(auth())).body.data;
    expect(page.sections.some((s) => s.id === created.body.data.id)).toBe(true);

    const target = page.sections[0];
    const dup = await request(app).post(`/api/admin/pages/sections/${target.id}/duplicate`).set(auth());
    expect(dup.status).toBe(201);
    const after = (await request(app).get("/api/admin/pages/gifting").set(auth())).body.data.sections;
    const idx = after.findIndex((s) => s.id === target.id);
    expect(after[idx + 1].id).toBe(dup.body.data.id);
    const orders = after.map((s) => s.sortOrder);
    expect(new Set(orders).size).toBe(orders.length);
    await request(app).delete(`/api/admin/pages/sections/${dup.body.data.id}`).set(auth()).expect(200);
    await request(app).delete(`/api/admin/pages/sections/${created.body.data.id}`).set(auth()).expect(200);
  });
});
