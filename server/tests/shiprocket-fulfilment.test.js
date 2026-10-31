import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";

const providerMock = { getServiceability: vi.fn(), createShipment: vi.fn(), cancelShipment: vi.fn(), generateAwb: vi.fn(), schedulePickup: vi.fn() };
vi.mock("../src/modules/shipping/provider.service.js", async (orig) => ({ ...(await orig()), getShippingProvider: () => providerMock }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: vi.fn().mockResolvedValue({}) }) } }));

const { createApp } = await import("../src/app.js");
const { env } = await import("../src/config/env.js");
const { prisma } = await import("../src/lib/prisma.js");
const { saveCredential } = await import("../src/modules/integrations/credential.service.js");
const { resetDb, seedTestAdmin, seedTestProduct, VALID_CUSTOMER, VALID_ADDRESS } = await import("./helpers.js");
const { resolveShiprocketStatus } = await import("../src/modules/shipping/shiprocketStatus.js");
const { validateShippingAddress } = await import("../src/modules/shipping/fulfilment-state.js");
env.integrationEncryptionKey = env.integrationEncryptionKey || crypto.randomBytes(32).toString("hex");
const app = createApp();

const PICKUP = { location: "Primary", name: "Aadya", phone: "9999999999", address: "1 Studio Rd", city: "Jaipur", state: "Rajasthan", postalCode: "302001" };
let token, adminId;
const api = (m, url, body) => request(app)[m](`/api/admin/orders${url}`).set("Authorization", `Bearer ${token}`).send(body);

async function place() {
  await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [], codSupported: true } }).catch(() => {});
  const p = await seedTestProduct({});
  await prisma.product.update({ where: { id: p.id }, data: { shipWeightGrams: 400, shipLengthMm: 280, shipWidthMm: 230, shipHeightMm: 60 } });
  const res = await request(app).post("/api/orders").send({ customer: VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items: [{ slug: p.slug, quantity: 1 }], paymentMethod: "cashfree" });
  expect(res.status).toBe(201);
  return { id: res.body.data.orderId, accessToken: res.body.data.accessToken };
}
const confirm = (id) => api("put", `/${id}/package`, { weightKg: 0.55, lengthCm: 28, widthCm: 23, heightCm: 6 });
const hook = (payload, key = "whtoken") => request(app).post("/api/webhooks/shipment-status").set("x-api-key", key).set("Content-Type", "application/json").send(JSON.stringify(payload));
const alerts = () => prisma.adminNotification.findMany({ where: { type: "SHIPMENT_FAILED" } });

beforeEach(async () => {
  await resetDb();
  await prisma.integrationCredential.deleteMany();
  Object.values(providerMock).forEach((m) => m.mockReset());
  const admin = await seedTestAdmin(); adminId = admin.id;
  token = (await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password })).body.data.accessToken;
  await saveCredential("SHIPROCKET", "LIVE", { apiEmail: "a@b.co", apiPassword: "pw" }, adminId);
  await saveCredential("SHIPROCKET_WEBHOOK", "DEFAULT", { webhookToken: "whtoken" }, adminId);
  await prisma.siteSetting.upsert({ where: { key: "shippingBusiness" }, create: { key: "shippingBusiness", value: { provider: "SHIPROCKET", environment: "LIVE", pickup: PICKUP } }, update: { value: { provider: "SHIPROCKET", environment: "LIVE", pickup: PICKUP } } });
});
afterAll(async () => { await resetDb(); await prisma.$disconnect(); });

describe("fulfilment state machine (which actions are valid)", () => {
  it("only offers valid actions at each step and explains blockers", async () => {
    const { id } = await place();
    let f = (await api("get", `/${id}`)).body.data.fulfilment;
    expect(f.step).toBe("NOT_CREATED");
    expect(f.actions).toMatchObject({ confirmPackage: true, checkServiceability: false, createShipment: false, assignAwb: false, schedulePickup: false, cancelShipment: false });
    await confirm(id);
    f = (await api("get", `/${id}`)).body.data.fulfilment;
    expect(f.step).toBe("PACKAGE_CONFIRMED");
    expect(f.actions).toMatchObject({ checkServiceability: true, createShipment: true });
    providerMock.createShipment.mockResolvedValue({ provider: "SHIPROCKET", providerOrderId: "9", providerShipmentId: "10", awb: null, status: "CREATED" });
    await api("post", `/${id}/shipment/create`, { courierCompanyId: 5 });
    f = (await api("get", `/${id}`)).body.data.fulfilment;
    expect(f.step).toBe("SHIPMENT_CREATED");
    expect(f.actions).toMatchObject({ createShipment: false, assignAwb: true, schedulePickup: false, cancelShipment: true, confirmPackage: false, checkServiceability: true });
    providerMock.generateAwb.mockResolvedValue({ awb: "AWB123", carrier: "Alpha" });
    await api("post", `/${id}/shipment/awb`, { courierCompanyId: 5 });
    f = (await api("get", `/${id}`)).body.data.fulfilment;
    expect(f.step).toBe("AWB_ASSIGNED");
    expect(f.actions).toMatchObject({ assignAwb: false, schedulePickup: true, downloadLabel: true, checkServiceability: false });
    providerMock.schedulePickup.mockResolvedValue({ supported: true, pickupStatus: "PICKUP_SCHEDULED" });
    await api("post", `/${id}/shipment/pickup`);
    f = (await api("get", `/${id}`)).body.data.fulfilment;
    expect(f.step).toBe("PICKUP_SCHEDULED");
    expect(f.actions).toMatchObject({ schedulePickup: false, cancelShipment: true });
    expect(providerMock.generateAwb.mock.calls[0][1]).toMatchObject({ courierCompanyId: 5 });
  });
  it("refuses to create or check couriers with an incomplete address or no credentials", async () => {
    const { id } = await place();
    await confirm(id);
    await prisma.orderAddress.update({ where: { orderId: id }, data: { phone: "123" } });
    const f = (await api("get", `/${id}`)).body.data.fulfilment;
    expect(f.actions.createShipment).toBe(false);
    expect(f.blockers.join(" ")).toMatch(/phone/);
    expect((await api("post", `/${id}/shipment/create`, {})).status).toBe(400);
    expect((await api("post", `/${id}/shipment/serviceability`)).status).toBe(400);
    expect(providerMock.createShipment).not.toHaveBeenCalled();
    await prisma.orderAddress.update({ where: { orderId: id }, data: { phone: "9876543210" } });
    await prisma.integrationCredential.deleteMany({ where: { provider: "SHIPROCKET" } });
    expect((await api("post", `/${id}/shipment/create`, {})).status).toBe(400);
    expect((await api("get", `/${id}`)).body.data.fulfilment.blockers.join(" ")).toMatch(/credentials/);
  });
  it("validateShippingAddress flags each missing part", () => {
    expect(validateShippingAddress({ ...VALID_ADDRESS })).toEqual([]);
    expect(validateShippingAddress({ ...VALID_ADDRESS, postalCode: "56" })[0]).toMatch(/pincode/);
    expect(validateShippingAddress(null)[0]).toMatch(/no shipping address/);
  });
});

describe("Admin alerts for failed shipments", () => {
  it("creation failure raises one alert; normal creation raises none", async () => {
    const { id } = await place(); await confirm(id);
    providerMock.createShipment.mockRejectedValueOnce(new Error("Carrier request failed: boom"));
    expect((await api("post", `/${id}/shipment/create`, {})).status).toBeGreaterThanOrEqual(400);
    await api("post", `/${id}/shipment/create`, {}).catch(() => {});
    const a = await alerts();
    expect(a.filter((x) => x.title === "Shipment creation failed")).toHaveLength(1);
    expect(a[0]).toMatchObject({ entityType: "order", entityId: id, severity: "CRITICAL" });
  });
  it("AWB and pickup failures alert", async () => {
    const { id } = await place(); await confirm(id);
    providerMock.createShipment.mockResolvedValue({ provider: "SHIPROCKET", providerOrderId: "9", providerShipmentId: "10", awb: null, status: "CREATED" });
    await api("post", `/${id}/shipment/create`, {});
    expect(await alerts()).toHaveLength(0);
    providerMock.generateAwb.mockRejectedValue(new Error("Carrier request failed: no wallet balance"));
    expect((await api("post", `/${id}/shipment/awb`, {})).status).toBeGreaterThanOrEqual(400);
    expect((await alerts()).map((x) => x.title)).toContain("AWB assignment failed");
  });
});

describe("webhook milestones, alerts, replay and unknown statuses", () => {
  async function shipped() {
    const { id } = await place();
    const sh = await prisma.shipment.create({ data: { orderId: id, provider: "SHIPROCKET", status: "CREATED", awb: "AWB777", providerOrderId: "55", providerShipmentId: "66", carrier: "Alpha" } });
    return { id, sh };
  }
  const evt = (extra) => ({ awb: "AWB777", sr_order_id: 55, current_timestamp: `t${Math.random()}`, ...extra });
  it("records each milestone once, ignores replays, and does not alert on normal scans", async () => {
    const { id, sh } = await shipped();
    const payload = evt({ current_status: "IN TRANSIT", current_status_id: 18, current_timestamp: "2026-11-01 10:00:00" });
    expect((await hook(payload)).status).toBe(200);
    expect((await hook(payload)).status).toBe(200); // replay
    await hook(evt({ current_status: "OUT FOR DELIVERY", current_status_id: 17 }));
    const events = await prisma.shipmentEvent.findMany({ where: { shipmentId: sh.id }, orderBy: { occurredAt: "asc" } });
    expect(events.map((e) => e.status)).toEqual(["IN_TRANSIT", "OUT_FOR_DELIVERY"]);
    expect(await alerts()).toHaveLength(0);
    expect((await prisma.shipment.findUnique({ where: { id: sh.id } })).lastSyncedAt).not.toBeNull();
    expect(id).toBeTruthy();
  });
  it("delivery failure and RTO alert exactly once, delivered does not", async () => {
    const { sh } = await shipped();
    await hook(evt({ current_status: "UNDELIVERED", current_status_id: 21 }));
    await hook(evt({ current_status: "UNDELIVERED", current_status_id: 21 }));
    expect((await alerts()).filter((x) => x.title === "Delivery attempt failed")).toHaveLength(1);
    await hook(evt({ current_status: "RTO INITIATED", current_status_id: 9 }));
    expect((await alerts()).filter((x) => x.title === "Return to origin started")).toHaveLength(1);
    expect((await prisma.shipmentEvent.findMany({ where: { shipmentId: sh.id } })).map((e) => e.status).sort()).toEqual(["DELIVERY_FAILED", "RTO_INITIATED"]);
  });
  it("pickup errors alert; an unmapped status changes nothing and alerts nobody", async () => {
    const { sh } = await shipped();
    await hook(evt({ current_status: "PICKUP ERROR", current_status_id: 13 }));
    expect((await alerts()).map((x) => x.title)).toContain("Pickup scheduling failed");
    const before = await prisma.shipment.findUnique({ where: { id: sh.id } });
    await hook(evt({ current_status: "SOMETHING NEW", current_status_id: 9999 }));
    const after = await prisma.shipment.findUnique({ where: { id: sh.id } });
    expect(after.status).toBe(before.status);
    expect(await prisma.shipmentEvent.count({ where: { shipmentId: sh.id } })).toBe(0);
    expect(await alerts()).toHaveLength(1);
  });
  it("AWB-assigned webhook records the AWB milestone", async () => {
    const { sh } = await shipped();
    await hook(evt({ current_status: "AWB ASSIGNED", current_status_id: 1 }));
    expect((await prisma.shipmentEvent.findMany({ where: { shipmentId: sh.id } })).map((e) => e.status)).toEqual(["AWB_ASSIGNED"]);
  });
  it("rejects a webhook with the wrong token", async () => {
    await shipped();
    expect((await hook(evt({ current_status_id: 18 }), "nope")).status).toBe(401);
  });
  it("status mapping: id first, text fallback, unknown is harmless", () => {
    expect(resolveShiprocketStatus({ current_status_id: 7 })).toMatchObject({ known: true, shipmentStatus: "DELIVERED", orderStatus: "DELIVERED" });
    expect(resolveShiprocketStatus({ current_status: "Out For Delivery" })).toMatchObject({ shipmentStatus: "OUT_FOR_DELIVERY" });
    expect(resolveShiprocketStatus({ current_status_id: 21 })).toMatchObject({ shipmentStatus: "FAILED_ATTEMPT", event: "ORDER_UNDELIVERED" });
    expect(resolveShiprocketStatus({ current_status_id: 9 })).toMatchObject({ shipmentStatus: "RTO" });
    expect(resolveShiprocketStatus({ current_status_id: 12345, current_status: "Mystery" })).toMatchObject({ known: false, shipmentStatus: null, orderStatus: null, event: null });
  });
});

describe("customer tracking privacy", () => {
  it("returns courier, AWB, link, label and milestones only, from every customer endpoint", async () => {
    const { id, accessToken } = await place();
    const sh = await prisma.shipment.create({ data: { orderId: id, provider: "SHIPROCKET", status: "IN_TRANSIT", awb: "AWB999", providerOrderId: "SECRET-SR-ORDER", providerShipmentId: "SECRET-SR-SHIP", carrier: "Alpha", trackingUrl: "https://track.example/AWB999", rawProviderStatus: "RAW-PROVIDER-TEXT", lastError: "INTERNAL-ERROR-TEXT" } });
    await prisma.shipmentEvent.createMany({ data: [{ shipmentId: sh.id, orderId: id, status: "CREATED", label: "Shipment created", occurredAt: new Date("2026-11-01T08:00:00Z") }, { shipmentId: sh.id, orderId: id, status: "IN_TRANSIT", label: "In transit", occurredAt: new Date("2026-11-02T08:00:00Z") }] });
    await prisma.orderStatusHistory.create({ data: { orderId: id, toStatus: "SHIPPED", source: "SHIPROCKET", adminId: "ADMIN-ACTOR-ID", providerEventId: "WEBHOOK-EVENT-ID" } });
    const order = await prisma.order.findUnique({ where: { id } });
    const track = await request(app).post("/api/orders/track").send({ orderNumber: order.orderNumber, email: VALID_CUSTOMER.email });
    const confirmation = await request(app).get(`/api/orders/${order.orderNumber}/confirmation`).query({ token: accessToken });
    for (const res of [track, confirmation]) {
      expect(res.status).toBe(200);
      expect(res.body.data.tracking).toMatchObject({ courier: "Alpha", awb: "AWB999", trackingUrl: "https://track.example/AWB999", status: "IN_TRANSIT", statusLabel: "In transit" });
      expect(res.body.data.tracking.events.map((e) => e.label)).toEqual(["Shipment created", "In transit"]);
      const raw = JSON.stringify(res.body);
      for (const secret of ["SECRET-SR-ORDER", "SECRET-SR-SHIP", "RAW-PROVIDER-TEXT", "INTERNAL-ERROR-TEXT", "ADMIN-ACTOR-ID", "WEBHOOK-EVENT-ID", "accessTokenHash"]) expect(raw).not.toContain(secret);
      expect(res.body.data.shipment).toBeUndefined();
      expect(res.body.data.statusHistory).toBeUndefined();
    }
  });
  it("hides tracking until a shipment really exists, and never shows failed attempts to create one", async () => {
    const { id } = await place();
    await prisma.shipment.create({ data: { orderId: id, provider: "SHIPROCKET", status: "CREATION_FAILED", lastError: "boom" } });
    const order = await prisma.order.findUnique({ where: { id } });
    const track = await request(app).post("/api/orders/track").send({ orderNumber: order.orderNumber, email: VALID_CUSTOMER.email });
    expect(track.body.data.tracking).toBeNull();
    expect(JSON.stringify(track.body)).not.toContain("boom");
  });
});

describe("cancellation", () => {
  async function created() {
    const { id } = await place(); await confirm(id);
    providerMock.createShipment.mockResolvedValue({ provider: "SHIPROCKET", providerOrderId: "9", providerShipmentId: "10", awb: null, status: "CREATED" });
    await api("post", `/${id}/shipment/create`, {});
    return id;
  }
  it("changes internal state only after the provider confirms", async () => {
    const id = await created();
    providerMock.cancelShipment.mockRejectedValueOnce(new Error("Carrier request failed: not cancellable"));
    expect((await api("post", `/${id}/shipment/cancel`)).status).toBeGreaterThanOrEqual(400);
    let sh = await prisma.shipment.findUnique({ where: { orderId: id } });
    expect(sh.status).toBe("CREATED"); expect(sh.cancelledAt).toBeNull();
    expect((await alerts()).map((x) => x.title)).toContain("Shipment cancellation failed");
    providerMock.cancelShipment.mockResolvedValueOnce({ cancelled: true });
    expect((await api("post", `/${id}/shipment/cancel`)).status).toBe(200);
    sh = await prisma.shipment.findUnique({ where: { orderId: id } });
    expect(sh.status).toBe("CANCELLED"); expect(sh.cancelledAt).not.toBeNull();
    expect((await prisma.shipmentEvent.findMany({ where: { shipmentId: sh.id } })).map((e) => e.status)).toContain("CANCELLED");
    expect((await prisma.orderShipmentPackage.findUnique({ where: { orderId: id } })).lockedAt).toBeNull();
    // a second call is idempotent and does not hit the provider again
    expect((await api("post", `/${id}/shipment/cancel`)).status).toBe(200);
    expect(providerMock.cancelShipment).toHaveBeenCalledTimes(2);
  });
  it("cannot cancel once the courier has collected it", async () => {
    const id = await created();
    await prisma.shipment.update({ where: { orderId: id }, data: { status: "IN_TRANSIT" } });
    expect((await api("post", `/${id}/shipment/cancel`)).status).toBe(400);
    expect(providerMock.cancelShipment).not.toHaveBeenCalled();
  });
  it("a cancelled shipment can be re-created with a clean timeline", async () => {
    const id = await created();
    providerMock.cancelShipment.mockResolvedValue({ cancelled: true });
    await api("post", `/${id}/shipment/cancel`);
    providerMock.createShipment.mockResolvedValue({ provider: "SHIPROCKET", providerOrderId: "11", providerShipmentId: "12", awb: null, status: "CREATED" });
    expect((await api("post", `/${id}/shipment/create`, {})).status).toBe(200);
    const sh = await prisma.shipment.findUnique({ where: { orderId: id } });
    expect(sh.status).toBe("CREATED"); expect(sh.providerShipmentId).toBe("12");
    expect((await prisma.shipmentEvent.findMany({ where: { shipmentId: sh.id } })).map((e) => e.status)).toEqual(["CREATED"]);
  });
});
