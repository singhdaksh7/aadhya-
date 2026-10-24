import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import crypto from "node:crypto";
import request from "supertest";

// SMTP is faked at nodemailer (the network boundary); the templates, the notification ledger, order/payment
// handling, the Shiprocket webhook and the Admin settings API all run for real on the test DB.
process.env.SMTP_HOST = "smtp.test.local";
process.env.INTEGRATION_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");

const sendMailMock = vi.fn(async () => ({ messageId: "mock-message-id" }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: (...a) => sendMailMock(...a), verify: async () => true }) } }));
vi.mock("../src/modules/payments/cashfree.client.js", async () => (await import("./fakes/cashfree.js")).cashfreeClientMock());

const { createApp } = await import("../src/app.js");
const { prisma } = await import("../src/lib/prisma.js");
const { env } = await import("../src/config/env.js");
const { resetDb, seedTestAdmin, seedTestProduct, VALID_CUSTOMER, VALID_ADDRESS } = await import("./helpers.js");
const { resetCashfree, cfPay } = await import("./fakes/cashfree.js");
const { notifyAdminEvent, notifyOrderEvent } = await import("../src/modules/mailer/mailer.service.js");
const { markPaymentFailed } = await import("../src/modules/payments/payment.service.js");
const { toPublicSettings } = await import("../src/modules/settings/settings.routes.js");
const { generateShiprocketWebhookToken } = await import("../src/modules/integrations/shiprocket-webhook.service.js");

const app = createApp();
let adminToken;
let adminId;
const OWNER = "owner@shop.test";
const ORDERS = "orders@shop.test";

const auth = (req) => req.set("Authorization", `Bearer ${adminToken}`);
const addRecipient = (email) => auth(request(app).post("/api/admin/email/admin-notifications/recipients")).send({ email });
const setEvents = (events) => auth(request(app).put("/api/admin/email/admin-notifications/events")).send({ events });
const adminSet = (id, status, note) => auth(request(app).patch(`/api/admin/orders/${id}/status`)).send({ status, ...(note ? { note } : {}) });

beforeEach(async () => {
  await resetDb();
  await prisma.integrationCredential.deleteMany();
  await prisma.webhookDeliveryLog.deleteMany();
  await prisma.notificationEvent.deleteMany();
  await prisma.adminNotificationRecipient.deleteMany();
  await prisma.siteSetting.deleteMany({ where: { key: "adminNotifications" } });
  resetCashfree();
  sendMailMock.mockReset();
  sendMailMock.mockImplementation(async () => ({ messageId: "mock-message-id" }));
  const admin = await seedTestAdmin({ email: "notif-admin@test.local" });
  adminId = admin.id;
  const res = await request(app).post("/api/admin/auth/login").send({ email: "notif-admin@test.local", password: env.admin.password });
  adminToken = res.body.data.accessToken;
});
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

const sent = () => sendMailMock.mock.calls.map((c) => c[0]).filter((m) => !/Invoice/i.test(m.subject));
const toAddr = (email) => sent().filter((m) => m.to === email);
// Admin notifications are the only emails that deep-link into the Admin panel.
const adminMails = (email = OWNER) => toAddr(email).filter((m) => m.html.includes("/admin/orders/"));

async function codOrder(customer = VALID_CUSTOMER) {
  await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [], codSupported: true } }).catch(() => {});
  const product = await seedTestProduct({ price: 500, stockQuantity: 20, name: "Brass Lamp" });
  const res = await request(app).post("/api/orders").send({ customer, shippingAddress: VALID_ADDRESS, items: [{ slug: product.slug, quantity: 2 }], paymentMethod: "cod" });
  expect(res.status).toBe(201);
  return { id: res.body.data.orderId, number: res.body.data.orderNumber };
}

describe("recipient + settings API", () => {
  it("is Admin-only", async () => {
    expect((await request(app).get("/api/admin/email/admin-notifications")).status).toBe(401);
    expect((await request(app).post("/api/admin/email/admin-notifications/recipients").send({ email: OWNER })).status).toBe(401);
  });

  it("lists the recommended defaults: new order / payment / failed / cancelled / return ON, shipment milestones and refunds OFF", async () => {
    const res = await auth(request(app).get("/api/admin/email/admin-notifications"));
    expect(res.status).toBe(200);
    const on = Object.fromEntries(res.body.data.events.map((e) => [e.key, e.enabled]));
    expect(on).toMatchObject({ NEW_ORDER: true, PAYMENT_SUCCESS: true, PAYMENT_FAILED: true, ORDER_CANCELLED: true, RETURN_REQUESTED: true, ORDER_SHIPPED: false, OUT_FOR_DELIVERY: false, DELIVERED: false, REFUND_INITIATED: false, REFUND_COMPLETED: false });
    expect(res.body.data.recipients).toEqual([]);
  });

  it("adds, disables and removes recipients; validates email addresses; rejects duplicates", async () => {
    expect((await addRecipient("not-an-email")).status).toBe(400);
    expect((await addRecipient("")).status).toBe(400);
    const added = await addRecipient("  Owner@Shop.TEST ");
    expect(added.status).toBe(200);
    expect(added.body.data.recipients.map((r) => r.email)).toEqual([OWNER]); // trimmed + lower-cased
    expect((await addRecipient(OWNER)).status).toBe(409);
    const id = added.body.data.recipients[0].id;
    const off = await auth(request(app).patch(`/api/admin/email/admin-notifications/recipients/${id}`)).send({ enabled: false });
    expect(off.body.data.recipients[0].enabled).toBe(false);
    const gone = await auth(request(app).delete(`/api/admin/email/admin-notifications/recipients/${id}`));
    expect(gone.body.data.recipients).toEqual([]);
    expect((await auth(request(app).delete(`/api/admin/email/admin-notifications/recipients/${id}`))).status).toBe(404);
  });

  it("rejects unknown notification types and saves toggles", async () => {
    expect((await setEvents({ NOT_A_THING: true })).status).toBe(400);
    const res = await setEvents({ ORDER_SHIPPED: true, PAYMENT_FAILED: false });
    expect(res.body.data.events.find((e) => e.key === "ORDER_SHIPPED").enabled).toBe(true);
    expect(res.body.data.events.find((e) => e.key === "PAYMENT_FAILED").enabled).toBe(false);
    expect(res.body.data.events.find((e) => e.key === "NEW_ORDER").enabled).toBe(true); // untouched
  });

  it("never exposes the notification settings through the public settings payload", () => {
    const pub = toPublicSettings({ general: { storeName: "x" }, adminNotifications: { events: { NEW_ORDER: true } }, invoice: { gstin: "x" } });
    expect(pub).toEqual({ general: { storeName: "x" } });
  });
});

describe("new order", () => {
  it("emails the configured recipient exactly once with the order details and an Admin link; the customer gets only their own email", async () => {
    await addRecipient(OWNER);
    const order = await codOrder();
    const mails = adminMails();
    expect(mails).toHaveLength(1);
    const mail = mails[0];
    expect(mail.subject).toBe(`New order received — ${order.number}`);
    const body = mail.html + mail.text;
    for (const needle of [order.number, VALID_CUSTOMER.name, VALID_CUSTOMER.email, VALID_CUSTOMER.phone, "Brass Lamp", "× 2", "₹1,000", "Cash on Delivery", "Pending (pay on delivery)", "Bengaluru", "Karnataka"]) expect(body).toContain(needle);
    expect(mail.html).toContain(`${env.frontendUrl.replace(/\/$/, "")}/admin/orders/${order.id}`);
    expect(mail.html).toContain("Open order in Admin");
    expect(mail.html).not.toContain("Team Tushaqsa"); // internal wording, not the customer sign-off

    // Customer mail is a separate email and never carries the Admin wording.
    const customerMails = toAddr(VALID_CUSTOMER.email);
    expect(customerMails.some((m) => m.subject === `Order confirmed — ${order.number}`)).toBe(true);
    expect(customerMails.some((m) => /New order received/.test(m.subject))).toBe(false);
    expect(customerMails.every((m) => !m.html.includes("/admin/orders/"))).toBe(true);
    expect(adminMails(VALID_CUSTOMER.email)).toHaveLength(0);

    const log = await prisma.emailLog.findFirst({ where: { recipient: OWNER } });
    expect(log).toMatchObject({ audience: "ADMIN", status: "SENT", event: "ADMIN_NEW_ORDER", orderId: order.id });
    expect((await prisma.emailLog.findFirst({ where: { recipient: VALID_CUSTOMER.email, event: "ORDER_PLACED" } })).audience).toBe("CUSTOMER");
  });

  it("sends nothing when there are no recipients, or when the event is switched off", async () => {
    await codOrder();
    expect(adminMails()).toHaveLength(0);
    await addRecipient(OWNER);
    await setEvents({ NEW_ORDER: false });
    await codOrder({ ...VALID_CUSTOMER, email: "second@test.local" });
    expect(adminMails()).toHaveLength(0);
    expect(toAddr("second@test.local").length).toBeGreaterThan(0); // the customer still gets their confirmation
  });

  it("emails every enabled recipient once and skips disabled ones", async () => {
    await addRecipient(OWNER);
    const second = await addRecipient(ORDERS);
    const third = await addRecipient("muted@shop.test");
    const mutedId = third.body.data.recipients.find((r) => r.email === "muted@shop.test").id;
    await auth(request(app).patch(`/api/admin/email/admin-notifications/recipients/${mutedId}`)).send({ enabled: false });
    expect(second.status).toBe(200);
    await codOrder();
    expect(adminMails(OWNER)).toHaveLength(1);
    expect(adminMails(ORDERS)).toHaveLength(1);
    expect(toAddr("muted@shop.test")).toHaveLength(0);
  });

  it("a customer who switched the confirmation template off does not stop the Admin email", async () => {
    await addRecipient(OWNER);
    await auth(request(app).patch("/api/admin/email/templates/ORDER_PLACED/enabled")).send({ enabled: false });
    const order = await codOrder();
    expect(adminMails()).toHaveLength(1);
    expect(toAddr(VALID_CUSTOMER.email).some((m) => m.subject.startsWith("Order confirmed"))).toBe(false);
    expect(order.number).toBeTruthy();
  });

  it("repeating the event (retry / webhook replay) does not resend", async () => {
    await addRecipient(OWNER);
    const order = await codOrder();
    await notifyOrderEvent(order.id, "ORDER_PLACED", { source: "SYSTEM" });
    await notifyOrderEvent(order.id, "ORDER_PLACED", { source: "PAYMENT" });
    expect(adminMails().filter((m) => m.subject.startsWith("New order received"))).toHaveLength(1);
  });
});

describe("online payment", () => {
  async function onlineOrder() {
    const product = await seedTestProduct({ price: 500, stockQuantity: 10, name: "Jute Mat" });
    const placed = await request(app).post("/api/orders").send({ customer: VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items: [{ slug: product.slug, quantity: 1 }] });
    const { orderId, orderNumber } = placed.body.data;
    const session = (await request(app).post(`/api/orders/${orderId}/payment`)).body.data;
    return { orderId, orderNumber, session };
  }
  const verify = (session) => request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId: session.cashfreeOrderId });

  it("an unpaid online order sends no Admin email; once paid there is exactly one New order email showing Paid", async () => {
    await addRecipient(OWNER);
    const { orderNumber, session } = await onlineOrder();
    await verify(session);
    expect(adminMails()).toHaveLength(0);
    cfPay(session.cashfreeOrderId);
    await verify(session);
    await verify(session);
    const mails = adminMails();
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe(`New order received — ${orderNumber}`);
    expect(mails[0].html).toContain("Online payment");
    expect(mails[0].html).toContain("Paid");
    expect(mails[0].html).toContain("Jute Mat");
  });

  it("with New order switched off, the payment-successful email is sent instead (once)", async () => {
    await addRecipient(OWNER);
    await setEvents({ NEW_ORDER: false });
    const { orderNumber, session } = await onlineOrder();
    cfPay(session.cashfreeOrderId);
    await verify(session);
    await verify(session);
    const mails = adminMails();
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe(`Online payment successful — ${orderNumber}`);
  });

  it("a failed payment emails Admin once, even if the failure is reported twice", async () => {
    await addRecipient(OWNER);
    const { orderNumber } = await onlineOrder();
    const payment = await prisma.payment.findFirst();
    await markPaymentFailed({ providerOrderId: payment.providerOrderId });
    await markPaymentFailed({ providerOrderId: payment.providerOrderId });
    const mails = adminMails();
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe(`Payment failed — ${orderNumber}`);
    expect(mails[0].html).toContain("Failed");
    const body = JSON.stringify(mails[0]);
    expect(body).not.toMatch(/secret|api[_-]?key|password/i);
  });

  it("payment failed can be switched off", async () => {
    await addRecipient(OWNER);
    await setEvents({ PAYMENT_FAILED: false });
    await onlineOrder();
    const payment = await prisma.payment.findFirst();
    await markPaymentFailed({ providerOrderId: payment.providerOrderId });
    expect(adminMails()).toHaveLength(0);
  });
});

describe("status changes (manual Admin and Shiprocket share one event path)", () => {
  async function processing() {
    const order = await codOrder();
    await adminSet(order.id, "PROCESSING");
    sendMailMock.mockClear();
    return order;
  }

  it("shipment milestones are off by default; cancelled is on", async () => {
    await addRecipient(OWNER);
    const a = await processing();
    await adminSet(a.id, "SHIPPED");
    await adminSet(a.id, "OUT_FOR_DELIVERY");
    await adminSet(a.id, "DELIVERED");
    expect(adminMails()).toHaveLength(0);
    const b = await processing();
    await adminSet(b.id, "CANCELLED", "Customer asked");
    const mails = adminMails();
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe(`Order cancelled — ${b.number}`);
    expect(mails[0].html).toContain("Customer asked");
  });

  it("an enabled Shipped / Out for delivery / Delivered each send one Admin email from a manual change", async () => {
    await addRecipient(OWNER);
    await setEvents({ ORDER_SHIPPED: true, OUT_FOR_DELIVERY: true, DELIVERED: true });
    const order = await processing();
    await prisma.shipment.create({ data: { orderId: order.id, provider: "MANUAL", carrier: "Delhivery", trackingNumber: "AWB123456", status: "CREATED" } });
    await adminSet(order.id, "SHIPPED");
    await adminSet(order.id, "OUT_FOR_DELIVERY");
    await adminSet(order.id, "DELIVERED");
    expect(adminMails().map((m) => m.subject)).toEqual([`Order shipped — ${order.number}`, `Order out for delivery — ${order.number}`, `Order delivered — ${order.number}`]);
    expect(adminMails()[0].html).toContain("AWB123456");
    const rows = await prisma.notificationEvent.findMany({ where: { audience: "ADMIN", orderId: order.id, event: { not: "ADMIN_NEW_ORDER" } }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.source)).toEqual(["ADMIN", "ADMIN", "ADMIN"]);
  });

  describe("Shiprocket", () => {
    const post = (token, payload) => request(app).post("/api/webhooks/shipment-status").set("Content-Type", "application/json").set("x-api-key", token).send(JSON.stringify(payload));
    const payloadFor = (order, id, label) => ({ awb: "141123221084922", courier_name: "Delhivery Surface", current_status: label, current_status_id: id, shipment_status: label, shipment_status_id: id, current_timestamp: `24 10 2026 10:${String(id).padStart(2, "0")}:00`, order_id: order.number, sr_order_id: 445905009, is_return: 0 });

    it("a courier Shipped event emails Admin once, and a manual Shipped before it does not cause a second email", async () => {
      await addRecipient(OWNER);
      await setEvents({ ORDER_SHIPPED: true });
      const order = await processing();
      const { webhookToken } = await generateShiprocketWebhookToken(adminId);
      await prisma.shipment.create({ data: { orderId: order.id, provider: "MANUAL", trackingNumber: "141123221084922", awb: "141123221084922", status: "CREATED" } });
      await adminSet(order.id, "SHIPPED"); // manual first...
      await post(webhookToken, payloadFor(order, 6, "SHIPPED")); // ...courier later
      await post(webhookToken, payloadFor(order, 6, "SHIPPED")); // ...and a replay
      expect(adminMails().filter((m) => m.subject.startsWith("Order shipped"))).toHaveLength(1);
    });

    it("courier-first Shipped event is emailed with source SHIPROCKET", async () => {
      await addRecipient(OWNER);
      await setEvents({ ORDER_SHIPPED: true, DELIVERED: true });
      const order = await processing();
      const { webhookToken } = await generateShiprocketWebhookToken(adminId);
      await post(webhookToken, payloadFor(order, 6, "SHIPPED"));
      await post(webhookToken, payloadFor(order, 7, "DELIVERED"));
      expect(adminMails().map((m) => m.subject)).toEqual([`Order shipped — ${order.number}`, `Order delivered — ${order.number}`]);
      const rows = await prisma.notificationEvent.findMany({ where: { audience: "ADMIN", orderId: order.id, event: { not: "ADMIN_NEW_ORDER" } } });
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.source === "SHIPROCKET")).toBe(true);
    });
  });
});

describe("returns and refunds", () => {
  it("return requested / refund events use the order-update template and honour their toggles", async () => {
    await addRecipient(OWNER);
    const order = await codOrder();
    sendMailMock.mockClear();
    await notifyAdminEvent(order.id, "RETURN_REQUESTED", { dedupeSuffix: "r1", extra: { returnReason: "Item arrived damaged" } });
    await notifyAdminEvent(order.id, "RETURN_REQUESTED", { dedupeSuffix: "r1", extra: { returnReason: "Item arrived damaged" } });
    expect(adminMails()).toHaveLength(1);
    expect(adminMails()[0].subject).toBe(`Return requested — ${order.number}`);
    expect(adminMails()[0].html).toContain("Item arrived damaged");
    await notifyOrderEvent(order.id, "REFUND_INITIATED", { source: "ADMIN", dedupeSuffix: "f1", extra: { refundAmount: 100 } });
    expect(adminMails()).toHaveLength(1); // refund milestones default to off
    await setEvents({ REFUND_INITIATED: true });
    await notifyOrderEvent(order.id, "REFUND_INITIATED", { source: "ADMIN", dedupeSuffix: "f2", extra: { refundAmount: 100 } });
    expect(adminMails().map((m) => m.subject)).toContain(`Refund initiated — ${order.number}`);
  });
});

describe("failures and the Email Log", () => {
  it("an SMTP failure is logged for Admin, never breaks the order, and a failed Admin notification can be retried", async () => {
    await addRecipient(OWNER);
    sendMailMock.mockImplementation(async (m) => {
      if (m.to === OWNER) throw new Error("550 mailbox unavailable");
      return { messageId: "ok" };
    });
    const order = await codOrder();
    expect((await prisma.order.findUnique({ where: { id: order.id } })).status).toBe("CONFIRMED"); // order unaffected
    const row = await prisma.notificationEvent.findFirst({ where: { audience: "ADMIN", recipient: OWNER } });
    expect(row.status).toBe("FAILED");
    expect(row.lastError).toContain("550");
    const log = await prisma.emailLog.findFirst({ where: { recipient: OWNER, status: "FAILED" } });
    expect(log).toMatchObject({ audience: "ADMIN", event: "ADMIN_NEW_ORDER", orderId: order.id });
    expect(toAddr(VALID_CUSTOMER.email).some((m) => m.subject.startsWith("Order confirmed"))).toBe(true); // customer unaffected

    sendMailMock.mockImplementation(async () => ({ messageId: "ok" }));
    sendMailMock.mockClear();
    const retry = await auth(request(app).post(`/api/admin/email/logs/${log.id}/retry`));
    expect(retry.status).toBe(200);
    expect(adminMails()).toHaveLength(1);
    expect(adminMails()[0].subject).toBe(`New order received — ${order.number}`);
    expect((await prisma.notificationEvent.findUnique({ where: { id: row.id } })).status).toBe("SENT");
  });

  it("the Email Log can be filtered by audience and shows the order number", async () => {
    await addRecipient(OWNER);
    const order = await codOrder();
    const adminLogs = await auth(request(app).get("/api/admin/email/logs?audience=ADMIN"));
    expect(adminLogs.body.data.items.length).toBeGreaterThan(0);
    expect(adminLogs.body.data.items.every((l) => l.audience === "ADMIN")).toBe(true);
    expect(adminLogs.body.data.items[0].orderNumber).toBe(order.number);
    const customerLogs = await auth(request(app).get("/api/admin/email/logs?audience=CUSTOMER"));
    expect(customerLogs.body.data.items.every((l) => l.audience === "CUSTOMER")).toBe(true);
    const ledger = await auth(request(app).get("/api/admin/email/notifications?audience=ADMIN"));
    expect(ledger.body.data.items.every((n) => n.audience === "ADMIN")).toBe(true);
  });

  it("Admin templates are editable, grouped by audience, and cannot carry unknown placeholders", async () => {
    const list = await auth(request(app).get("/api/admin/email/templates"));
    const adminKeys = list.body.data.templates.filter((t) => t.audience === "admin").map((t) => t.key).sort();
    expect(adminKeys).toEqual(["ADMIN_NEW_ORDER", "ADMIN_ORDER_UPDATE", "ADMIN_PAYMENT_STATUS", "ADMIN_SHIPMENT_STATUS"]);
    const bad = await auth(request(app).put("/api/admin/email/templates/ADMIN_NEW_ORDER")).send({ subject: "New {{orderNumber}} {{nope}}", heading: "Heading", body: "Body text here" });
    expect(bad.status).toBe(400);
    const good = await auth(request(app).put("/api/admin/email/templates/ADMIN_NEW_ORDER")).send({ subject: "NEW ORDER {{orderNumber}}", heading: "New order", body: "Total {{orderTotal}}" });
    expect(good.status).toBe(200);
    await addRecipient(OWNER);
    const order = await codOrder();
    expect(adminMails()[0].subject).toBe(`NEW ORDER ${order.number}`);
  });

  it("an Admin template can never be used to email a customer", async () => {
    const order = await codOrder();
    sendMailMock.mockClear();
    const res = await notifyOrderEvent(order.id, "ADMIN_NEW_ORDER", {});
    expect(res.sent).toBe(false);
    expect(sent()).toHaveLength(0);
  });
});
