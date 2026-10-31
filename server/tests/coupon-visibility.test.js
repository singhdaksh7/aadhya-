import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const request = supertest(createApp());
const DAY = 86_400_000;
const PREFIX = "VIS";
let product;

const make = (code, extra = {}) => prisma.coupon.create({ data: { code: `${PREFIX}${code}`, name: code, discountType: "PERCENTAGE", value: 10, isActive: true, ...extra } });
const listed = async () => (await request.get("/api/coupons/active")).body.data.map((c) => c.code);

beforeAll(async () => {
  await prisma.coupon.deleteMany({ where: { code: { startsWith: PREFIX } } });
  const cat = await prisma.category.create({ data: { name: "Vis Cat", slug: `vis-cat-${Date.now()}` } });
  product = await prisma.product.create({ data: { name: "Vis Product", slug: `vis-product-${Date.now()}`, productType: "PHYSICAL", categoryId: cat.id, price: 1000, stockQuantity: 5 } });
  await make("PUBLIC", { isPublic: true });
  await make("PUBLICNODATES", { isPublic: true, validFrom: null, validUntil: null });
  await make("PRIVATE", { isPublic: false });
  await make("DEFAULT"); // isPublic defaults to false
  await make("EXPIRED", { isPublic: true, validUntil: new Date(Date.now() - DAY) });
  await make("UPCOMING", { isPublic: true, validFrom: new Date(Date.now() + DAY) });
  await make("DISABLED", { isPublic: true, isActive: false });
  await make("USEDUP", { isPublic: true, usageLimit: 1, usageCount: 1 });
});

afterAll(async () => {
  await prisma.coupon.deleteMany({ where: { code: { startsWith: PREFIX } } });
  await prisma.product.deleteMany({ where: { id: product.id } });
  await prisma.$disconnect();
});

describe("GET /api/coupons/active (storefront / product pages)", () => {
  it("lists only enabled, currently valid, explicitly public coupons", async () => {
    const codes = (await listed()).filter((c) => c.startsWith(PREFIX));
    expect(codes.sort()).toEqual([`${PREFIX}PUBLIC`, `${PREFIX}PUBLICNODATES`]);
  });
  it("never lists private or default-private coupons", async () => {
    const codes = await listed();
    expect(codes).not.toContain(`${PREFIX}PRIVATE`);
    expect(codes).not.toContain(`${PREFIX}DEFAULT`);
  });
  it("hides expired, upcoming, disabled and exhausted coupons", async () => {
    const codes = await listed();
    for (const c of ["EXPIRED", "UPCOMING", "DISABLED", "USEDUP"]) expect(codes).not.toContain(`${PREFIX}${c}`);
  });
  it("includes a public coupon that has no start date (previously hidden by the validFrom filter)", async () => {
    expect(await listed()).toContain(`${PREFIX}PUBLICNODATES`);
  });
  it("does not expose internals", async () => {
    const body = JSON.stringify((await request.get("/api/coupons/active")).body);
    expect(body).not.toMatch(/usageCount|usageLimit|perCustomerLimit|redemptions|isPublic|targets/);
  });
});

describe("/api/offers uses the same visibility rule", () => {
  it("shows public coupons and hides private ones", async () => {
    const codes = (await request.get("/api/offers")).body.data.map((c) => c.code);
    expect(codes).toContain(`${PREFIX}PUBLIC`);
    expect(codes).not.toContain(`${PREFIX}PRIVATE`);
    expect(codes).not.toContain(`${PREFIX}EXPIRED`);
    expect(codes).not.toContain(`${PREFIX}DISABLED`);
  });
});

describe("POST /api/coupons/validate (manual entry)", () => {
  const validate = (code) => request.post("/api/coupons/validate").send({ code, items: [{ slug: product.slug, quantity: 1 }] });
  it("still accepts a private coupon typed in by the customer", async () => {
    const res = await validate(`${PREFIX}PRIVATE`.toLowerCase());
    expect(res.status).toBe(200);
    expect(res.body.data.discountAmount).toBe(100);
  });
  it("still rejects expired, upcoming and disabled coupons", async () => {
    for (const c of ["EXPIRED", "UPCOMING", "DISABLED"]) expect((await validate(`${PREFIX}${c}`)).status).toBeGreaterThanOrEqual(400);
  });
});
