import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";
import { resetDb, seedTestAdmin, seedTestCategory, seedTestProduct } from "./helpers.js";

const app = createApp();
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const ago = (ms) => new Date(Date.now() - ms);
const ahead = (ms) => new Date(Date.now() + ms);

async function adminToken() {
  await seedTestAdmin();
  const res = await request(app)
    .post("/api/admin/auth/login")
    .send({ email: env.admin.email, password: env.admin.password });
  return res.body?.data?.accessToken;
}

function coupon(code, extra = {}) {
  return prisma.coupon.create({
    data: {
      code,
      discountType: "PERCENTAGE",
      value: 10,
      minimumOrderAmount: 999,
      maximumDiscountAmount: 500,
      validFrom: ago(DAY),
      isActive: true,
      isPublic: true,
      ...extra,
    },
  });
}

describe("Public offers API", () => {
  beforeEach(resetDb);

  it("lists only public + active coupons and hides private ones", async () => {
    await coupon("PUBLIC10", { displayTitle: "Festive 10% off", terms: "One use per order." });
    await coupon("PRIVATE20", { isPublic: false });
    await coupon("INACTIVE30", { isActive: false });

    const res = await request(app).get("/api/offers");
    expect(res.status).toBe(200);
    const codes = res.body.data.map((o) => o.code);
    expect(codes).toEqual(["PUBLIC10"]);
    const offer = res.body.data[0];
    expect(offer).toMatchObject({
      title: "Festive 10% off",
      discountType: "PERCENTAGE",
      value: 10,
      minimumOrderAmount: 999,
      maximumDiscountAmount: 500,
      status: "ACTIVE",
      terms: "One use per order.",
      applicability: "Applies to all products",
    });
  });

  it("hides expired and exhausted coupons, flags upcoming and expiring soon", async () => {
    await coupon("EXPIRED", { validUntil: ago(HOUR) });
    await coupon("USEDUP", { usageLimit: 5, usageCount: 5 });
    await coupon("SOON", { validUntil: ahead(5 * HOUR) });
    await coupon("LATER", { validFrom: ahead(2 * DAY) });
    await coupon("LONG", { validUntil: ahead(30 * DAY) });

    const res = await request(app).get("/api/offers");
    const byCode = Object.fromEntries(res.body.data.map((o) => [o.code, o.status]));
    expect(byCode).toEqual({ SOON: "EXPIRING_SOON", LATER: "UPCOMING", LONG: "ACTIVE" });
  });

  it("never exposes sensitive or internal fields", async () => {
    await coupon("SAFE", {
      name: "Internal campaign name",
      description: "INTERNAL NOTE do not show",
      usageLimit: 100,
      usageCount: 7,
      perCustomerLimit: 1,
    });
    const res = await request(app).get("/api/offers");
    const offer = res.body.data[0];
    const allowed = [
      "code", "title", "discountType", "value", "minimumOrderAmount", "maximumDiscountAmount",
      "validFrom", "validUntil", "status", "applicability", "terms",
    ];
    expect(Object.keys(offer).sort()).toEqual([...allowed].sort());
    const raw = JSON.stringify(res.body);
    for (const leak of ["INTERNAL NOTE", "usageCount", "usageLimit", "perCustomerLimit", "redemption", "customerId", "isActive", "isPublic"]) {
      expect(raw).not.toContain(leak);
    }
  });

  it("summarises category applicability by name", async () => {
    const cat = await seedTestCategory({ name: "Brass Lamps", slug: "brass-lamps-offer" });
    const c = await coupon("CATONLY", { targetType: "CATEGORY" });
    await prisma.couponTarget.create({ data: { couponId: c.id, targetId: cat.id } });
    const res = await request(app).get("/api/offers");
    expect(res.body.data[0].applicability).toBe("Applies to Brass Lamps");
  });

  it("private codes still validate at checkout", async () => {
    const product = await seedTestProduct({ price: 2000 });
    await coupon("HIDDEN15", { isPublic: false, minimumOrderAmount: 0, maximumDiscountAmount: null, value: 15 });
    const res = await request(app)
      .post("/api/coupons/validate")
      .send({ code: "hidden15", items: [{ slug: product.slug, quantity: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body.data.discountAmount).toBe(300);
  });
});

describe("Admin coupon public fields", () => {
  beforeEach(resetDb);

  it("defaults to private and persists isPublic/displayTitle/terms", async () => {
    const token = await adminToken();
    const base = { code: "ADM10", discountType: "PERCENTAGE", value: 10 };
    const created = await request(app).post("/api/admin/coupons").set("Authorization", `Bearer ${token}`).send(base);
    expect(created.status).toBe(201);
    expect(created.body.data.isPublic).toBe(false);

    const upd = await request(app)
      .patch(`/api/admin/coupons/${created.body.data.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ isPublic: true, displayTitle: "Welcome offer", terms: "T&C apply" });
    expect(upd.status).toBe(200);
    expect(upd.body.data).toMatchObject({ isPublic: true, displayTitle: "Welcome offer", terms: "T&C apply" });

    const pub = await request(app).get("/api/offers");
    expect(pub.body.data.map((o) => o.title)).toEqual(["Welcome offer"]);
  });
});

describe("What's New API", () => {
  beforeEach(resetDb);

  it("returns only active items inside their date window, ordered by sortOrder", async () => {
    const mk = (title, extra = {}) => prisma.whatsNewItem.create({ data: { title, ...extra } });
    await mk("Second", { sortOrder: 2 });
    await mk("First", { sortOrder: 1, ctaLabel: "Shop", ctaUrl: "/shop", badge: "New" });
    await mk("Disabled", { isActive: false });
    await mk("Future", { startDate: ahead(DAY) });
    await mk("Past", { endDate: ago(HOUR) });
    await mk("InWindow", { sortOrder: 3, startDate: ago(DAY), endDate: ahead(DAY) });

    const res = await request(app).get("/api/whats-new");
    expect(res.status).toBe(200);
    expect(res.body.data.map((i) => i.title)).toEqual(["First", "Second", "InWindow"]);
    expect(res.body.data[0]).toMatchObject({ ctaLabel: "Shop", ctaUrl: "/shop", badge: "New" });
    expect(JSON.stringify(res.body)).not.toContain("isActive");
  });

  it("requires admin auth for the admin endpoints", async () => {
    expect((await request(app).get("/api/admin/whats-new")).status).toBe(401);
    expect((await request(app).post("/api/admin/whats-new").send({ title: "x" })).status).toBe(401);
  });

  it("admin can create, update, list and delete; validates CTA and dates", async () => {
    const token = await adminToken();
    const auth = { Authorization: `Bearer ${token}` };

    const bad = await request(app).post("/api/admin/whats-new").set(auth).send({ title: "x", ctaUrl: "javascript:alert(1)" });
    expect(bad.status).toBe(400);
    const badDates = await request(app)
      .post("/api/admin/whats-new")
      .set(auth)
      .send({ title: "x", startDate: ahead(DAY).toISOString(), endDate: ago(DAY).toISOString() });
    expect(badDates.status).toBe(400);

    const created = await request(app)
      .post("/api/admin/whats-new")
      .set(auth)
      .send({ title: "Diwali drop", subtitle: "Lamps", ctaLabel: "Explore", ctaUrl: "/collections", sortOrder: 4 });
    expect(created.status).toBe(201);
    const id = created.body.data.id;

    const upd = await request(app).patch(`/api/admin/whats-new/${id}`).set(auth).send({ isActive: false });
    expect(upd.status).toBe(200);
    expect((await request(app).get("/api/whats-new")).body.data).toHaveLength(0);

    const list = await request(app).get("/api/admin/whats-new").set(auth);
    expect(list.body.data).toHaveLength(1);

    const del = await request(app).delete(`/api/admin/whats-new/${id}`).set(auth);
    expect(del.status).toBe(204);
    expect((await request(app).get("/api/admin/whats-new").set(auth)).body.data).toHaveLength(0);
  });
});
