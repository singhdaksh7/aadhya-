import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";

const providerMock = { getServiceability: vi.fn(), createShipment: vi.fn() };
vi.mock("../src/modules/shipping/provider.service.js", () => ({ getShippingProvider: () => providerMock }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: vi.fn().mockResolvedValue({}) }) } }));

const { createApp } = await import("../src/app.js");
const { env } = await import("../src/config/env.js");
const { prisma } = await import("../src/lib/prisma.js");
const { attemptAutomaticShipment } = await import("../src/modules/shipping/fulfilment.service.js");
const { saveCredential } = await import("../src/modules/integrations/credential.service.js");
const crypto = await import("node:crypto");
env.integrationEncryptionKey = env.integrationEncryptionKey || crypto.randomBytes(32).toString("hex");
const { resetDb, seedTestAdmin, seedTestProduct, VALID_CUSTOMER, VALID_ADDRESS } = await import("./helpers.js");
const app = createApp();

const PICKUP = { location: "Primary", name: "Aadya", phone: "9999999999", address: "1 Studio Rd", city: "Jaipur", state: "Rajasthan", postalCode: "302001" };
async function settings(extra = {}) {
  const value = { provider: "SHIPROCKET", environment: "TEST", autoCreateShipment: false, pickup: PICKUP, packagingTareGrams: 150, packageDefaults: { length: 20, width: 15, height: 10, weight: 0.5 }, ...extra };
  await prisma.siteSetting.upsert({ where: { key: "shippingBusiness" }, create: { key: "shippingBusiness", value }, update: { value } });
}
async function adminToken() {
  await seedTestAdmin();
  return (await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password })).body.data.accessToken;
}
const dims = { shipWeightGrams: 400, shipLengthMm: 280, shipWidthMm: 230, shipHeightMm: 60 };
async function place(items, paymentMethod = "cashfree") {
  await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [], codSupported: true } }).catch(() => {});
  const res = await request(app).post("/api/orders").send({ customer: VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items, paymentMethod });
  expect(res.status).toBe(201);
  return res.body.data.orderId;
}
let token;
const api = (m, url, body) => request(app)[m](`/api/admin/orders${url}`).set("Authorization", `Bearer ${token}`).send(body);

beforeEach(async () => {
  await resetDb();
  providerMock.getServiceability.mockReset();
  providerMock.createShipment.mockReset();
  await prisma.integrationCredential.deleteMany();
  token = await adminToken();
  const admin = await prisma.adminUser.findFirst();
  await saveCredential("SHIPROCKET", "LIVE", { apiEmail: "api@example.com", apiPassword: "pw" }, admin.id);
  await settings();
});
afterAll(async () => { await resetDb(); await prisma.$disconnect(); });

describe("package suggestion + confirmation", () => {
  it("suggests the single-product package with configured tare and exposes kg/cm", async () => {
    const p = await seedTestProduct({}); await prisma.product.update({ where: { id: p.id }, data: dims });
    const id = await place([{ slug: p.slug, quantity: 1 }]);
    const res = await api("get", `/${id}/package`);
    expect(res.status).toBe(200);
    expect(res.body.data.suggestion).toMatchObject({ source: "AUTO_SINGLE", weightKg: 0.55, lengthCm: 28, widthCm: 23, heightCm: 6 });
    expect(res.body.data.confirmed).toBeNull();
  });
  it("variant values override the product, field by field", async () => {
    const p = await seedTestProduct({}); await prisma.product.update({ where: { id: p.id }, data: dims });
    const v = await prisma.productVariant.create({ data: { productId: p.id, name: "Large", sku: "V-L", stockQuantity: 5, shipWeightGrams: 900 } });
    const id = await place([{ slug: p.slug, variantId: v.id, quantity: 1 }]);
    const res = await api("get", `/${id}/package`);
    expect(res.body.data.suggestion).toMatchObject({ weightKg: 1.05, lengthCm: 28 });
  });
  it("mixed items are flagged for confirmation", async () => {
    const a = await seedTestProduct({ slug: "pa" }), b = await seedTestProduct({ slug: "pb" });
    await prisma.product.update({ where: { id: a.id }, data: dims }); await prisma.product.update({ where: { id: b.id }, data: { ...dims, shipHeightMm: 100 } });
    const id = await place([{ slug: "pa", quantity: 1 }, { slug: "pb", quantity: 1 }]);
    const s = (await api("get", `/${id}/package`)).body.data.suggestion;
    expect(s).toMatchObject({ source: "AUTO_ESTIMATE", requiresConfirmation: true, heightCm: 16 });
  });
  it("rejects invalid package values and records a manual override with who", async () => {
    const p = await seedTestProduct({}); await prisma.product.update({ where: { id: p.id }, data: dims });
    const id = await place([{ slug: p.slug, quantity: 1 }]);
    expect((await api("put", `/${id}/package`, { weightKg: -1, lengthCm: 28, widthCm: 23, heightCm: 6 })).status).toBe(400);
    expect((await api("put", `/${id}/package`, { weightKg: "abc", lengthCm: 28, widthCm: 23, heightCm: 6 })).status).toBe(400);
    expect((await api("put", `/${id}/package`, { weightKg: 1, lengthCm: 0, widthCm: 23, heightCm: 6 })).status).toBe(400);
    const ok = await api("put", `/${id}/package`, { weightKg: 0.75, lengthCm: 30, widthCm: 25, heightCm: 8 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.confirmed).toMatchObject({ source: "MANUAL_OVERRIDE", weightKg: 0.75, lengthCm: 30 });
    expect(ok.body.data.confirmed.confirmedBy).toBeTruthy();
  });
  it("accepting the unchanged suggestion keeps the AUTO source", async () => {
    const p = await seedTestProduct({}); await prisma.product.update({ where: { id: p.id }, data: dims });
    const id = await place([{ slug: p.slug, quantity: 1 }]);
    const res = await api("put", `/${id}/package`, { weightKg: 0.55, lengthCm: 28, widthCm: 23, heightCm: 6 });
    expect(res.body.data.confirmed.source).toBe("AUTO_SINGLE");
  });
});

describe("Shiprocket gating, serviceability and creation", () => {
  async function confirmedOrder(method = "cashfree") {
    const p = await seedTestProduct({}); await prisma.product.update({ where: { id: p.id }, data: dims });
    const id = await place([{ slug: p.slug, quantity: 1 }], method);
    await api("put", `/${id}/package`, { weightKg: 0.75, lengthCm: 30, widthCm: 25, heightCm: 8 });
    return { id, p };
  }
  it("refuses to create or check couriers without a confirmed package, and never calls the provider", async () => {
    const p = await seedTestProduct({}); await prisma.product.update({ where: { id: p.id }, data: dims });
    const id = await place([{ slug: p.slug, quantity: 1 }]);
    const create = await api("post", `/${id}/shipment/create`, {});
    expect(create.status).toBe(400);
    expect(JSON.stringify(create.body)).toMatch(/Confirm the package/);
    expect((await api("post", `/${id}/shipment/serviceability`)).status).toBe(400);
    expect(providerMock.createShipment).not.toHaveBeenCalled();
    expect(providerMock.getServiceability).not.toHaveBeenCalled();
    expect(await prisma.shipment.count()).toBe(0);
  });
  it("serviceability uses the confirmed package in kg/cm, real pincodes, and prepaid mapping", async () => {
    const { id } = await confirmedOrder("cashfree");
    providerMock.getServiceability.mockResolvedValue({ couriers: [{ courierCompanyId: 7, name: "X", cod: false, rate: 80 }], recommendedCourierCompanyId: 7 });
    const res = await api("post", `/${id}/shipment/serviceability`);
    expect(res.status).toBe(200);
    expect(providerMock.getServiceability).toHaveBeenCalledWith(expect.objectContaining({ pickupPostcode: "302001", deliveryPostcode: "560001", cod: false, package: { weight: 0.75, length: 30, breadth: 25, height: 8 } }));
    expect(res.body.data.couriers).toHaveLength(1);
  });
  it("COD orders ask for COD and hide non-COD couriers", async () => {
    const { id } = await confirmedOrder("cod");
    providerMock.getServiceability.mockResolvedValue({ couriers: [{ courierCompanyId: 1, name: "A", cod: true }, { courierCompanyId: 2, name: "B", cod: false }], recommendedCourierCompanyId: 1 });
    const res = await api("post", `/${id}/shipment/serviceability`);
    expect(providerMock.getServiceability).toHaveBeenCalledWith(expect.objectContaining({ cod: true }));
    expect(res.body.data.couriers.map((c) => c.name)).toEqual(["A"]);
  });
  it("creates from the snapshot, locks it, ignores later product edits, and is replay-safe", async () => {
    const { id, p } = await confirmedOrder("cod");
    providerMock.createShipment.mockResolvedValue({ provider: "SHIPROCKET", providerOrderId: "1", providerShipmentId: "2", awb: null, status: "CREATED" });
    const res = await api("post", `/${id}/shipment/create`, { courierCompanyId: 7 });
    expect(res.status).toBe(200);
    const arg = providerMock.createShipment.mock.calls[0][0];
    expect(arg.input.package).toEqual({ weight: 0.75, length: 30, breadth: 25, height: 8 });
    expect(arg.input.order.paymentMethod).toBe("cod");
    expect(arg.input.courierCompanyId).toBe(7);
    await prisma.product.update({ where: { id: p.id }, data: { shipWeightGrams: 9000 } });
    expect((await api("put", `/${id}/package`, { weightKg: 2, lengthCm: 30, widthCm: 25, heightCm: 8 })).status).toBe(400);
    const snap = await prisma.orderShipmentPackage.findUnique({ where: { orderId: id } });
    expect(snap).toMatchObject({ weightGrams: 750, lengthMm: 300, source: "MANUAL_OVERRIDE" });
    expect(snap.lockedAt).not.toBeNull();
    expect((await api("post", `/${id}/shipment/create`, {})).status).toBe(400);
    expect(providerMock.createShipment).toHaveBeenCalledTimes(1);
  });
  it("automatic creation also waits for a confirmed package", async () => {
    await settings({ autoCreateShipment: true });
    const p = await seedTestProduct({}); await prisma.product.update({ where: { id: p.id }, data: dims });
    const id = await place([{ slug: p.slug, quantity: 1 }]);
    expect(await attemptAutomaticShipment(id)).toBeNull();
    expect(providerMock.createShipment).not.toHaveBeenCalled();
    expect(await prisma.shipment.count()).toBe(0);
  });
  it("a provider failure leaves the package editable and records a safe error", async () => {
    const { id } = await confirmedOrder("cashfree");
    providerMock.createShipment.mockRejectedValue(new Error("Carrier request failed: boom"));
    expect((await api("post", `/${id}/shipment/create`, {})).status).toBeGreaterThanOrEqual(400);
    expect((await prisma.orderShipmentPackage.findUnique({ where: { orderId: id } })).lockedAt).toBeNull();
    expect((await prisma.shipment.findUnique({ where: { orderId: id } })).status).toBe("FAILED");
  });
});

describe("product + variant shipping fields via the admin API", () => {
  it("stores kg/cm as g/mm, round-trips, allows incomplete drafts, rejects bad values, hides them from the storefront", async () => {
    const category = await prisma.category.create({ data: { name: "C", slug: "c-ship" } });
    const base = { name: "Kilim Bag", categoryId: category.id, productType: "PHYSICAL", price: 999 };
    const auth = (r) => r.set("Authorization", `Bearer ${token}`);
    const draft = await auth(request(app).post("/api/admin/products")).send({ ...base, isActive: false });
    expect(draft.status).toBe(201);
    const bad = await auth(request(app).post("/api/admin/products")).send({ ...base, name: "Bad", shipping: { lengthCm: -4 } });
    expect(bad.status).toBe(400);
    const good = await auth(request(app).post("/api/admin/products")).send({ ...base, name: "Good", shipping: { weightKg: 0.4, lengthCm: 28, widthCm: 23, heightCm: 6 } });
    expect(good.status).toBe(201);
    const got = await auth(request(app).get(`/api/admin/products/${good.body.data.id}`));
    expect(got.body.data.shipping).toEqual({ weightKg: 0.4, lengthCm: 28, widthCm: 23, heightCm: 6 });
    const v = await auth(request(app).post(`/api/admin/products/${good.body.data.id}/variants`)).send({ name: "L", sku: "KB-L", stockQuantity: 3, shipping: { weightKg: 0.9 } });
    expect(v.body.data.shipping).toMatchObject({ weightKg: 0.9, lengthCm: null });
    const pub = await request(app).get(`/api/products/${got.body.data.slug}`);
    expect(JSON.stringify(pub.body)).not.toMatch(/shipWeightGrams|shipLengthMm/);
  });
});
