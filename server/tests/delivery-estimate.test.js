import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";

const providerMock = { getServiceability: vi.fn() };
vi.mock("../src/modules/shipping/provider.service.js", () => ({ getShippingProvider: () => providerMock }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: vi.fn().mockResolvedValue({}) }) } }));

const { createApp } = await import("../src/app.js");
const { env } = await import("../src/config/env.js");
const { prisma } = await import("../src/lib/prisma.js");
const { saveCredential } = await import("../src/modules/integrations/credential.service.js");
const { pickCheapest, computeWindow, parseEtd, clearEstimateCache, todayInStoreZone } = await import("../src/modules/shipping/estimate.service.js");
const { ESTIMATE_LIMIT } = await import("../src/middleware/rateLimiters.js");
const crypto = await import("node:crypto");
env.integrationEncryptionKey = env.integrationEncryptionKey || crypto.randomBytes(32).toString("hex");
const { resetDb, seedTestAdmin, seedTestProduct } = await import("./helpers.js");
const app = createApp();

const PICKUP = { location: "Primary", name: "Aadya", phone: "9999999999", address: "1 Studio Rd", city: "Jaipur", state: "Rajasthan", postalCode: "302001" };
async function settings(extra = {}) {
  const value = { provider: "SHIPROCKET", environment: "TEST", pickup: PICKUP, packagingTareGrams: 150, packageDefaults: { length: 20, width: 15, height: 10, weight: 0.5 }, ...extra };
  await prisma.siteSetting.upsert({ where: { key: "shippingBusiness" }, create: { key: "shippingBusiness", value }, update: { value } });
}
const post = (body) => request(app).post("/api/shipping/estimate").send(body);
const courier = (o) => ({ courierCompanyId: 1, name: "SecretCourier", rate: 100, estimatedDeliveryDays: "3", etd: null, cod: false, ...o });

beforeEach(async () => {
  await resetDb();
  clearEstimateCache();
  providerMock.getServiceability.mockReset();
  await prisma.integrationCredential.deleteMany();
  await seedTestAdmin();
  const admin = await prisma.adminUser.findFirst();
  await saveCredential("SHIPROCKET", "LIVE", { apiEmail: "api@example.com", apiPassword: "pw" }, admin.id);
  await settings();
});
afterAll(async () => { await resetDb(); await prisma.$disconnect(); });

describe("pure helpers", () => {
  it("parses Shiprocket etd and ISO dates, rejects junk", () => {
    expect(parseEtd("Nov 04, 2026")).toBe("2026-11-04");
    expect(parseEtd("2026-11-04")).toBe("2026-11-04");
    expect(parseEtd("Feb 31, 2026")).toBeNull();
    expect(parseEtd("soon")).toBeNull();
    expect(parseEtd(null)).toBeNull();
  });
  it("computes the window from etd with dispatch buffer", () => {
    const w = computeWindow({ etd: "Nov 04, 2026", today: "2026-10-31", bufferDays: 1 });
    expect(w.estimatedDelivery).toEqual({ earliest: "2026-11-05", latest: "2026-11-07" });
    expect(w.days).toEqual({ min: 5, max: 7 });
  });
  it("falls back to today + estimatedDeliveryDays and honours buffer 0", () => {
    const w = computeWindow({ etd: null, estimatedDeliveryDays: "3", today: "2026-10-31", bufferDays: 0 });
    expect(w.estimatedDelivery).toEqual({ earliest: "2026-11-03", latest: "2026-11-05" });
    expect(w.days).toEqual({ min: 3, max: 5 });
    expect(computeWindow({ etd: "garbage", estimatedDeliveryDays: null, today: "2026-10-31" })).toBeNull();
  });
  it("picks the cheapest positive-rate courier, ties to the earlier delivery, optional COD filter", () => {
    const list = [courier({ name: "A", rate: 90, cod: false }), courier({ name: "B", rate: 70, estimatedDeliveryDays: "5", cod: true }), courier({ name: "C", rate: 70, estimatedDeliveryDays: "2", cod: true }), courier({ name: "Z", rate: 0 })];
    expect(pickCheapest(list).name).toBe("C");
    expect(pickCheapest(list, { cod: true }).name).toBe("C");
    expect(pickCheapest([courier({ rate: 50, cod: false })], { cod: true })).toBeNull();
    expect(pickCheapest([courier({ rate: 0 })])).toBeNull();
    expect(pickCheapest([])).toBeNull();
  });
});

describe("POST /api/shipping/estimate", () => {
  it("validates input", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ pincode: "12345" })).status).toBe(400);
    expect((await post({ pincode: "12345a" })).status).toBe(400);
    expect((await post({ pincode: 560001 })).status).toBe(400);
    expect((await post({ pincode: "560001", items: [{ slug: "x", quantity: 0 }] })).status).toBe(400);
    expect((await post({ pincode: "560001", items: [{ slug: "x", quantity: 100 }] })).status).toBe(400);
    expect((await post({ pincode: "560001", items: [{ slug: "x", quantity: 1, variantId: "nope" }] })).status).toBe(400);
    expect((await post({ pincode: "560001", cod: "yes" })).status).toBe(400);
    expect(providerMock.getServiceability).not.toHaveBeenCalled();
  });

  it("returns serviceable:null when the provider is not Shiprocket", async () => {
    await settings({ provider: "MANUAL" });
    const res = await post({ pincode: "560001" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ serviceable: null, estimatedDelivery: null, days: null, codAvailable: null });
    expect(providerMock.getServiceability).not.toHaveBeenCalled();
  });

  it("returns serviceable:null without credentials or pickup postcode", async () => {
    await prisma.integrationCredential.deleteMany();
    expect((await post({ pincode: "560001" })).body.data.serviceable).toBeNull();
    const admin = await prisma.adminUser.findFirst();
    await saveCredential("SHIPROCKET", "LIVE", { apiEmail: "api@example.com", apiPassword: "pw" }, admin.id);
    await settings({ pickup: {} });
    expect((await post({ pincode: "560001" })).body.data.serviceable).toBeNull();
    expect(providerMock.getServiceability).not.toHaveBeenCalled();
  });

  it("chooses the cheapest courier (not the recommended one) and applies the dispatch buffer", async () => {
    providerMock.getServiceability.mockResolvedValue({
      recommendedCourierCompanyId: 2,
      couriers: [
        courier({ courierCompanyId: 2, name: "Recommended", rate: 200, etd: "2099-01-05" }),
        courier({ courierCompanyId: 3, name: "Cheap", rate: 60, etd: "2099-01-10", cod: true }),
      ],
    });
    await settings({ dispatchBufferDays: 2 });
    const res = await post({ pincode: "560001" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ serviceable: true, estimatedDelivery: { earliest: "2099-01-12", latest: "2099-01-14" }, codAvailable: true });
    expect(res.body.data.days.max - res.body.data.days.min).toBe(2);
    const call = providerMock.getServiceability.mock.calls[0][0];
    expect(call).toMatchObject({ pickupPostcode: "302001", deliveryPostcode: "560001", cod: false });
  });

  it("uses estimatedDeliveryDays relative to the store's today when etd is missing", async () => {
    providerMock.getServiceability.mockResolvedValue({ couriers: [courier({ rate: 80, estimatedDeliveryDays: "4" })] });
    const res = await post({ pincode: "560001" });
    const today = todayInStoreZone();
    const expected = computeWindow({ etd: null, estimatedDeliveryDays: "4", today, bufferDays: 1 });
    expect(res.body.data.estimatedDelivery).toEqual(expected.estimatedDelivery);
    expect(res.body.data.days).toEqual({ min: 5, max: 7 });
    expect(res.body.data.codAvailable).toBe(false);
  });

  it("filters to COD-capable couriers when cod:true, and reports codAvailable from the non-COD lookup", async () => {
    providerMock.getServiceability.mockResolvedValue({
      couriers: [courier({ rate: 50, etd: "2099-01-05", cod: false }), courier({ rate: 90, etd: "2099-01-20", cod: true })],
    });
    const cod = await post({ pincode: "560001", cod: true });
    expect(cod.body.data).toMatchObject({ serviceable: true, estimatedDelivery: { earliest: "2099-01-21" }, codAvailable: true });
    const prepaid = await post({ pincode: "560001" });
    expect(prepaid.body.data.estimatedDelivery.earliest).toBe("2099-01-06");
    expect(providerMock.getServiceability.mock.calls.every(([a]) => a.cod === false)).toBe(true);

    clearEstimateCache();
    providerMock.getServiceability.mockResolvedValue({ couriers: [courier({ rate: 50, cod: false })] });
    const none = await post({ pincode: "560001", cod: true });
    expect(none.body.data).toMatchObject({ serviceable: false, estimatedDelivery: null, days: null, codAvailable: false });
  });

  it("reports not serviceable when no courier is returned", async () => {
    providerMock.getServiceability.mockResolvedValue({ couriers: [] });
    const res = await post({ pincode: "999999" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ serviceable: false, estimatedDelivery: null, days: null, codAvailable: false });
    expect(typeof res.body.data.message).toBe("string");
  });

  it("returns serviceable:null on provider error without leaking its text", async () => {
    providerMock.getServiceability.mockRejectedValue(new Error("Carrier request failed: token abc123 invalid for api@example.com"));
    const res = await post({ pincode: "560001" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ serviceable: null, estimatedDelivery: null, days: null, codAvailable: null });
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/abc123|api@example|Carrier request failed/);
  });

  it("never exposes courier, rate or provider fields", async () => {
    providerMock.getServiceability.mockResolvedValue({ recommendedCourierCompanyId: 7, couriers: [courier({ courierCompanyId: 7, name: "SecretCourier", rate: 123.45, etd: "2099-01-05", cod: true, rating: 4.5 })] });
    const text = JSON.stringify((await post({ pincode: "560001" })).body);
    expect(text).not.toMatch(/SecretCourier|123\.45|courier|rate|rating|provider|recommended/i);
  });

  it("caches successful lookups (second call does not hit the provider)", async () => {
    providerMock.getServiceability.mockResolvedValue({ couriers: [courier({ rate: 80, etd: "2099-01-05" })] });
    const a = await post({ pincode: "560001" });
    const b = await post({ pincode: "560001" });
    expect(b.body.data).toEqual(a.body.data);
    expect(providerMock.getServiceability).toHaveBeenCalledTimes(1);
    await post({ pincode: "560002" });
    expect(providerMock.getServiceability).toHaveBeenCalledTimes(2);
  });

  it("derives package weight from product data (tare included) and ignores digital items", async () => {
    providerMock.getServiceability.mockResolvedValue({ couriers: [courier({ rate: 80, etd: "2099-01-05" })] });
    const p = await seedTestProduct({});
    await prisma.product.update({ where: { id: p.id }, data: { shipWeightGrams: 400, shipLengthMm: 280, shipWidthMm: 230, shipHeightMm: 60 } });
    const v = await prisma.productVariant.create({ data: { productId: p.id, name: "Large", sku: "V-L", stockQuantity: 5, shipWeightGrams: 900 } });

    await post({ pincode: "560001", items: [{ slug: p.slug, quantity: 1 }] });
    expect(providerMock.getServiceability.mock.calls[0][0].package).toEqual({ weight: 0.55, length: 28, breadth: 23, height: 6 });

    await post({ pincode: "560001", items: [{ slug: p.slug, quantity: 1, variantId: v.id }] });
    expect(providerMock.getServiceability.mock.calls[1][0].package).toMatchObject({ weight: 1.05, length: 28 });

    // unknown slug only -> default package (0.5kg, no dimensions)
    await post({ pincode: "560003", items: [{ slug: "does-not-exist", quantity: 2 }] });
    expect(providerMock.getServiceability.mock.calls[2][0].package).toEqual({ weight: 0.5 });
  });

  it("falls back to default weight and omits dimensions when product data is incomplete", async () => {
    providerMock.getServiceability.mockResolvedValue({ couriers: [courier({ rate: 80, etd: "2099-01-05" })] });
    const p = await seedTestProduct({});
    await prisma.product.update({ where: { id: p.id }, data: { shipWeightGrams: null, shipLengthMm: null, shipWidthMm: null, shipHeightMm: null } });
    await settings({ packageDefaults: { weight: 0.8 } });
    await post({ pincode: "560001", items: [{ slug: p.slug, quantity: 1 }] });
    expect(providerMock.getServiceability.mock.calls[0][0].package).toEqual({ weight: 0.8 });
  });
});

describe("rate limiting", () => {
  it("is configured at ~30 requests per 10 minutes", () => {
    expect(ESTIMATE_LIMIT).toEqual({ windowMs: 10 * 60 * 1000, limit: 30 });
  });
  it("a limiter with that config returns 429 after the cap (the route's own limiter is skipped under NODE_ENV=test)", async () => {
    const limiter = rateLimit({ ...ESTIMATE_LIMIT, limit: 3, standardHeaders: true, legacyHeaders: false });
    const a = express();
    a.post("/e", limiter, (req, res) => res.json({ ok: true }));
    for (let i = 0; i < 3; i++) expect((await request(a).post("/e")).status).toBe(200);
    expect((await request(a).post("/e")).status).toBe(429);
  });
});
