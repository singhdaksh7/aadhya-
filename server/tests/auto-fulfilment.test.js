import { describe, it, expect, beforeEach, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";

const providerMock = { getServiceability: vi.fn(), createShipment: vi.fn(), generateAwb: vi.fn(), schedulePickup: vi.fn(), cancelShipment: vi.fn() };
vi.mock("../src/modules/shipping/provider.service.js", async (orig) => ({ ...(await orig()), getShippingProvider: () => providerMock }));
const sendMailMock = vi.fn().mockResolvedValue({ messageId: "m" });
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: sendMailMock }) } }));

const { createApp } = await import("../src/app.js");
const { env } = await import("../src/config/env.js");
const { prisma } = await import("../src/lib/prisma.js");
const { saveCredential } = await import("../src/modules/integrations/credential.service.js");
const { resetDb, seedTestAdmin, seedTestProduct, VALID_CUSTOMER, VALID_ADDRESS } = await import("./helpers.js");
const { autoFulfilOrder } = await import("../src/modules/shipping/auto-fulfilment.js");
const { sortByCost } = await import("../src/modules/shipping/package.service.js");
const { trackingToken, verifyTrackingToken } = await import("../src/utils/trackingToken.js");
const { parseEtd } = await import("../src/modules/shipping/eta.js");
env.integrationEncryptionKey = env.integrationEncryptionKey || crypto.randomBytes(32).toString("hex");
const app = createApp();

const PICKUP = { location: "Home", name: "Aadya", phone: "9999999999", address: "1 Rd", city: "Meerut", state: "Uttar Pradesh", postalCode: "250001" };
const dims = { shipWeightGrams: 400, shipLengthMm: 280, shipWidthMm: 230, shipHeightMm: 60 };
const COURIERS = [
  { courierCompanyId: 11, name: "Fast", rate: 210, estimatedDeliveryDays: "2", etd: "Nov 04, 2026", cod: true },
  { courierCompanyId: 22, name: "Cheap", rate: 95.5, estimatedDeliveryDays: "5", etd: "Nov 07, 2026", cod: true },
  { courierCompanyId: 33, name: "CheapestNoCod", rate: 60, estimatedDeliveryDays: "6", etd: "Nov 08, 2026", cod: false },
];
const emails = () => sendMailMock.mock.calls.map(([m]) => m);
const bookedEmails = () => emails().filter((m) => /booked with the courier/i.test(m.subject));
const alerts = () => prisma.adminNotification.findMany({ where: { type: "SHIPMENT_FAILED" } });
let adminId;

async function settings(extra = {}) {
  const value = { provider: "SHIPROCKET", environment: "LIVE", pickup: PICKUP, autoFulfilSingleItem: true, ...extra };
  await prisma.siteSetting.upsert({ where: { key: "shippingBusiness" }, create: { key: "shippingBusiness", value }, update: { value } });
}
async function placeCod(items) {
  await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [], codSupported: true } }).catch(() => {});
  const res = await request(app).post("/api/orders").send({ customer: VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items, paymentMethod: "cod" });
  expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(201);
  return res.body.data.orderId;
}
const product = async (extra = {}, shipping = dims) => { const p = await seedTestProduct(extra); await prisma.product.update({ where: { id: p.id }, data: shipping }); return p; };

beforeEach(async () => {
  await resetDb();
  await prisma.integrationCredential.deleteMany();
  Object.values(providerMock).forEach((m) => m.mockReset());
  sendMailMock.mockClear(); sendMailMock.mockResolvedValue({ messageId: "m" });
  process.env.SMTP_HOST = "smtp.test.local";
  adminId = (await seedTestAdmin()).id;
  await saveCredential("SHIPROCKET", "LIVE", { apiEmail: "a@b.co", apiPassword: "pw" }, adminId);
  await settings();
  providerMock.getServiceability.mockResolvedValue({ couriers: COURIERS, recommendedCourierCompanyId: 11 });
  providerMock.createShipment.mockImplementation(async ({ input }) => ({ provider: "SHIPROCKET", providerOrderId: "SR1", providerShipmentId: "SH1", awb: "AWB-100", trackingNumber: "AWB-100", carrier: input.courierCompanyId === 22 ? "Cheap" : "Other", status: "CREATED" }));
  providerMock.schedulePickup.mockResolvedValue({ supported: true, pickupStatus: "PICKUP_SCHEDULED" });
  providerMock.generateAwb.mockResolvedValue({ awb: "AWB-200", carrier: "Cheap" });
});
afterEach(() => { delete process.env.SMTP_HOST; });
afterAll(async () => { await resetDb(); await prisma.$disconnect(); });

describe("single-item orders are fulfilled automatically", () => {
  it("picks the lowest-cost courier, creates the shipment with its AWB, schedules pickup and emails the customer once", async () => {
    const p = await product({ price: 900 });
    const id = await placeCod([{ slug: p.slug, quantity: 1 }]);
    // COD: the cheapest COD-capable courier (22), not the cheapest overall (33) and not Shiprocket's recommendation (11)
    expect(providerMock.createShipment).toHaveBeenCalledTimes(1);
    const arg = providerMock.createShipment.mock.calls[0][0];
    expect(arg.input.courierCompanyId).toBe(22);
    expect(arg.input.order.paymentMethod).toBe("cod");
    expect(arg.input.package).toEqual({ weight: 0.4, length: 28, breadth: 23, height: 6 });
    const sh = await prisma.shipment.findUnique({ where: { orderId: id } });
    expect(sh).toMatchObject({ status: "PICKUP_SCHEDULED", awb: "AWB-100", pickupStatus: "PICKUP_SCHEDULED" });
    expect(sh.estimatedDelivery.toISOString().slice(0, 10)).toBe("2026-11-07");
    const pkg = await prisma.orderShipmentPackage.findUnique({ where: { orderId: id } });
    expect(pkg).toMatchObject({ source: "AUTO_SINGLE", confirmedBy: "AUTO" }); expect(pkg.lockedAt).not.toBeNull();
    expect((await prisma.shipmentEvent.findMany({ where: { shipmentId: sh.id } })).map((e) => e.status).sort()).toEqual(["AWB_ASSIGNED", "CREATED", "PICKUP_SCHEDULED"]);
    // customer email: booked, with OUR tracking page, never the courier / Shiprocket
    expect(bookedEmails()).toHaveLength(1);
    const mail = bookedEmails()[0];
    const order = await prisma.order.findUnique({ where: { id } });
    expect(mail.to).toBe(VALID_CUSTOMER.email);
    expect(mail.html).toContain(`/track-order?order=${order.orderNumber}&amp;t=${trackingToken(order.orderNumber)}`); // & is HTML-escaped in href
    expect(mail.text).toContain(`/track-order?order=${order.orderNumber}&t=${trackingToken(order.orderNumber)}`);
    expect(`${mail.html} ${mail.text}`).not.toMatch(/shiprocket/i);
    expect(mail.html).toContain("AWB-100");
    expect(mail.html).toMatch(/7 Nov 2026/);
  });

  it("prepaid orders use the cheapest courier overall", async () => {
    const p = await product({ price: 900 });
    await request(app).post("/api/orders").send({ customer: VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items: [{ slug: p.slug, quantity: 1 }], paymentMethod: "cashfree" }).then((r) => expect(r.status).toBe(201));
    const orderId = (await prisma.order.findFirst()).id;
    await prisma.order.update({ where: { id: orderId }, data: { status: "CONFIRMED", paymentStatus: "PAID" } });
    const out = await autoFulfilOrder(orderId);
    expect(out.outcome).toBe("SHIPPED_AUTOMATICALLY");
    expect(providerMock.createShipment.mock.calls[0][0].input.courierCompanyId).toBe(33);
    expect(providerMock.createShipment.mock.calls[0][0].input.order.paymentMethod).toBe("cashfree");
  });

  it("is replay-safe: a second trigger changes nothing and sends nothing", async () => {
    const p = await product({ price: 900 });
    const id = await placeCod([{ slug: p.slug, quantity: 1 }]);
    const again = await autoFulfilOrder(id);
    expect(again.outcome).toBe("ALREADY_SHIPPING");
    expect(providerMock.createShipment).toHaveBeenCalledTimes(1);
    expect(bookedEmails()).toHaveLength(1);
  });

  it("two simultaneous triggers create exactly one Shiprocket shipment", async () => {
    await settings({ autoFulfilSingleItem: false });
    const p = await product({ price: 900 });
    const id = await placeCod([{ slug: p.slug, quantity: 1 }]);
    await settings({ autoFulfilSingleItem: true });
    const [a, b] = await Promise.all([autoFulfilOrder(id), autoFulfilOrder(id)]);
    expect(providerMock.createShipment).toHaveBeenCalledTimes(1);
    expect([a.outcome, b.outcome].sort()).toContain("SHIPPED_AUTOMATICALLY");
  });

  it("does nothing while the switch is off", async () => {
    await settings({ autoFulfilSingleItem: false });
    const p = await product({ price: 900 });
    const id = await placeCod([{ slug: p.slug, quantity: 1 }]);
    expect(providerMock.createShipment).not.toHaveBeenCalled();
    expect(await prisma.shipment.count({ where: { orderId: id } })).toBe(0);
  });
});

describe("everything else waits for the Admin", () => {
  it("several different products: no automatic shipment, no provider call, nothing locked", async () => {
    const a = await product({ slug: "pa", price: 500 }), b = await product({ slug: "pb", price: 700 });
    const id = await placeCod([{ slug: a.slug, quantity: 1 }, { slug: b.slug, quantity: 1 }]);
    expect(providerMock.createShipment).not.toHaveBeenCalled();
    expect(providerMock.getServiceability).not.toHaveBeenCalled();
    expect(await prisma.shipment.count({ where: { orderId: id } })).toBe(0);
    expect(await prisma.orderShipmentPackage.count({ where: { orderId: id } })).toBe(0);
    expect(bookedEmails()).toHaveLength(0);
  });
  it("quantity above one is treated as multi-item (stacking is an estimate the Admin must confirm)", async () => {
    const p = await product({ price: 500 });
    const id = await placeCod([{ slug: p.slug, quantity: 2 }]);
    expect(providerMock.createShipment).not.toHaveBeenCalled();
    expect(await prisma.shipment.count({ where: { orderId: id } })).toBe(0);
  });
  it("a single item without package data alerts the owner instead of guessing", async () => {
    const p = await product({ price: 500 }, { shipWeightGrams: null, shipLengthMm: null, shipWidthMm: null, shipHeightMm: null });
    const id = await placeCod([{ slug: p.slug, quantity: 1 }]);
    expect(providerMock.createShipment).not.toHaveBeenCalled();
    expect((await alerts()).map((x) => x.title)).toContain("Order needs package details");
    expect(await prisma.shipment.count({ where: { orderId: id } })).toBe(0);
  });
  it("no courier available: alert, lock released, nothing created", async () => {
    providerMock.getServiceability.mockResolvedValue({ couriers: [], recommendedCourierCompanyId: null });
    const p = await product({ price: 500 });
    const id = await placeCod([{ slug: p.slug, quantity: 1 }]);
    expect(providerMock.createShipment).not.toHaveBeenCalled();
    expect((await alerts()).map((x) => x.title)).toContain("No courier available");
    expect(await prisma.shipment.count({ where: { orderId: id } })).toBe(0);
  });
  it("a provider failure is alerted once and never retried automatically", async () => {
    providerMock.createShipment.mockRejectedValue(new Error("Carrier request failed: wallet balance low"));
    const p = await product({ price: 500 });
    const id = await placeCod([{ slug: p.slug, quantity: 1 }]);
    expect((await prisma.shipment.findUnique({ where: { orderId: id } })).status).toBe("FAILED");
    expect((await alerts()).filter((x) => x.title === "Shipment creation failed")).toHaveLength(1);
    const again = await autoFulfilOrder(id);
    expect(again.outcome).toBe("NEEDS_REVIEW");
    expect(providerMock.createShipment).toHaveBeenCalledTimes(1);
    expect(bookedEmails()).toHaveLength(0);
  });
  it("a pickup failure keeps the AWB, alerts the owner and still tells the customer", async () => {
    providerMock.schedulePickup.mockRejectedValue(new Error("Carrier request failed: pickup not serviceable"));
    const p = await product({ price: 500 });
    const id = await placeCod([{ slug: p.slug, quantity: 1 }]);
    const sh = await prisma.shipment.findUnique({ where: { orderId: id } });
    expect(sh.awb).toBe("AWB-100"); expect(sh.status).toBe("CREATED");
    expect((await alerts()).map((x) => x.title)).toContain("Pickup scheduling failed");
    expect(bookedEmails()).toHaveLength(1);
  });
  it("without an AWB from creation it assigns one with the chosen courier", async () => {
    providerMock.createShipment.mockResolvedValue({ provider: "SHIPROCKET", providerOrderId: "SR1", providerShipmentId: "SH1", awb: null, status: "CREATED" });
    const p = await product({ price: 500 });
    const id = await placeCod([{ slug: p.slug, quantity: 1 }]);
    expect(providerMock.generateAwb.mock.calls[0][1]).toMatchObject({ courierCompanyId: 22 });
    expect((await prisma.shipment.findUnique({ where: { orderId: id } })).awb).toBe("AWB-200");
  });
});

describe("manual shipments also email the customer and pick the cheapest courier first", () => {
  it("serviceability is sorted lowest cost first and names the cheapest", async () => {
    await settings({ autoFulfilSingleItem: false });
    const token = (await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password })).body.data.accessToken;
    const a = await product({ slug: "ma", price: 500 }), b = await product({ slug: "mb", price: 700 });
    const id = await placeCod([{ slug: a.slug, quantity: 1 }, { slug: b.slug, quantity: 1 }]);
    const api = (m, u, body) => request(app)[m](`/api/admin/orders/${id}${u}`).set("Authorization", `Bearer ${token}`).send(body);
    await api("put", "/package", { weightKg: 0.9, lengthCm: 30, widthCm: 25, heightCm: 12 });
    const res = await api("post", "/shipment/serviceability");
    expect(res.body.data.couriers.map((c) => c.courierCompanyId)).toEqual([22, 11]); // COD: no-COD courier removed
    expect(res.body.data.cheapestCourierCompanyId).toBe(22);
    const created = await api("post", "/shipment/create", { courierCompanyId: 22 });
    expect(created.status).toBe(200);
    expect(bookedEmails()).toHaveLength(1);
    expect((await prisma.shipment.findUnique({ where: { orderId: id } })).estimatedDelivery.toISOString().slice(0, 10)).toBe("2026-11-07");
  });
  it("sortByCost: rate ascending, ties by speed, unknown rates last", () => {
    const sorted = sortByCost([{ courierCompanyId: 1, rate: 0 }, { courierCompanyId: 2, rate: 80, estimatedDeliveryDays: "5" }, { courierCompanyId: 3, rate: 80, estimatedDeliveryDays: "2" }, { courierCompanyId: 4, rate: 50 }]);
    expect(sorted.map((c) => c.courierCompanyId)).toEqual([4, 3, 2, 1]);
  });
  it("parseEtd reads Shiprocket dates and rejects junk", () => {
    expect(parseEtd("Nov 04, 2026").toISOString().slice(0, 10)).toBe("2026-11-04");
    expect(parseEtd("soon")).toBeNull(); expect(parseEtd(null)).toBeNull();
  });
});

describe("website order tracking (no redirect to the courier)", () => {
  async function shippedOrder() {
    const p = await product({ price: 900 });
    const id = await placeCod([{ slug: p.slug, quantity: 1 }]);
    return prisma.order.findUnique({ where: { id } });
  }
  it("the emailed link works with the signed token and never needs the email", async () => {
    const order = await shippedOrder();
    const ok = await request(app).post("/api/orders/track").send({ orderNumber: order.orderNumber, token: trackingToken(order.orderNumber) });
    expect(ok.status).toBe(200);
    expect(ok.body.data.tracking).toMatchObject({ awb: "AWB-100", status: "PICKUP_SCHEDULED", statusLabel: "Pickup scheduled" });
    expect(ok.body.data.tracking.events.map((e) => e.status)).toEqual(expect.arrayContaining(["CREATED", "AWB_ASSIGNED", "PICKUP_SCHEDULED"]));
    expect(JSON.stringify(ok.body.data.tracking)).not.toMatch(/trackingUrl|shiprocket|providerShipmentId|providerOrderId/i);
    expect(ok.body.data.shipment).toBeUndefined();
  });
  it("order number plus checkout email still works; a wrong email, wrong token, or order number alone does not", async () => {
    const order = await shippedOrder();
    expect((await request(app).post("/api/orders/track").send({ orderNumber: order.orderNumber, email: VALID_CUSTOMER.email })).status).toBe(200);
    expect((await request(app).post("/api/orders/track").send({ orderNumber: order.orderNumber, email: "other@example.com" })).status).toBe(404);
    expect((await request(app).post("/api/orders/track").send({ orderNumber: order.orderNumber, token: "0".repeat(40) })).status).toBe(404);
    expect((await request(app).post("/api/orders/track").send({ orderNumber: order.orderNumber })).status).toBe(400);
  });
  it("tokens are bound to the order number", () => {
    expect(verifyTrackingToken("TUS-1", trackingToken("TUS-1"))).toBe(true);
    expect(verifyTrackingToken("TUS-2", trackingToken("TUS-1"))).toBe(false);
    expect(verifyTrackingToken("TUS-1", "short")).toBe(false);
  });
  it("shipped / out-for-delivery emails also link to our own tracking page", async () => {
    const order = await shippedOrder();
    const { notifyOrderEvent } = await import("../src/modules/mailer/mailer.service.js");
    await notifyOrderEvent(order.id, "ORDER_SHIPPED", { source: "SYSTEM" });
    const shipped = emails().find((m) => /has shipped/i.test(m.subject));
    expect(shipped.html).toContain(`/track-order?order=${order.orderNumber}&amp;t=${trackingToken(order.orderNumber)}`);
    expect(`${shipped.html}${shipped.text}`).not.toMatch(/shiprocket/i);
  });
});
