import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import crypto from "node:crypto";
import request from "supertest";

// SMTP is faked at nodemailer (the network boundary); everything else - templates, the notification
// ledger, order-status handling, the Shiprocket webhook, idempotency - runs for real on the test DB.
process.env.SMTP_HOST = "smtp.test.local";
process.env.INTEGRATION_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");

const sendMailMock = vi.fn(async () => ({ messageId: "mock-message-id" }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: (...a) => sendMailMock(...a), verify: async () => true }) } }));
vi.mock("../src/modules/payments/cashfree.client.js", async () => (await import("./fakes/cashfree.js")).cashfreeClientMock());

const { createApp } = await import("../src/app.js");
const { prisma } = await import("../src/lib/prisma.js");
const { env } = await import("../src/config/env.js");
const { resetDb, seedTestAdmin, seedTestProduct, registerCustomer, VALID_CUSTOMER, VALID_ADDRESS } = await import("./helpers.js");
const { cf, resetCashfree, cfPay } = await import("./fakes/cashfree.js");
const { notifyOrderEvent, retryDueNotifications } = await import("../src/modules/mailer/mailer.service.js");
const { generateShiprocketWebhookToken } = await import("../src/modules/integrations/shiprocket-webhook.service.js");

const app = createApp();
let adminToken;
let adminId;

async function adminLogin() {
  const admin = await seedTestAdmin({ email: "mail-admin@test.local" });
  adminId = admin.id;
  const res = await request(app).post("/api/admin/auth/login").send({ email: "mail-admin@test.local", password: env.admin.password });
  return res.body.data.accessToken;
}

beforeEach(async () => {
  await resetDb();
  await prisma.integrationCredential.deleteMany();
  await prisma.webhookDeliveryLog.deleteMany();
  await prisma.notificationEvent.deleteMany();
  resetCashfree();
  sendMailMock.mockReset();
  sendMailMock.mockImplementation(async () => ({ messageId: "mock-message-id" }));
  adminToken = await adminLogin();
});
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

// Invoice emails are a separate (existing) system that may land asynchronously; these tests are about notifications.
const sent = () => sendMailMock.mock.calls.map((c) => c[0]).filter((m) => !/Invoice/i.test(m.subject));
const subjects = () => sent().map((m) => m.subject);
const to = (email) => sent().filter((m) => m.to === email);

async function codOrder(overrides = {}) {
  await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [], codSupported: true } }).catch(() => {});
  const product = overrides.product || (await seedTestProduct({ price: 500, stockQuantity: 20, name: "Brass Lamp" }));
  const res = await request(app)
    .post("/api/orders")
    .send({ customer: overrides.customer || VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items: [{ slug: product.slug, quantity: 2 }], paymentMethod: "cod" });
  expect(res.status).toBe(201);
  return { id: res.body.data.orderId, number: res.body.data.orderNumber, email: (overrides.customer || VALID_CUSTOMER).email, product };
}
const adminSet = (id, status, note) => request(app).patch(`/api/admin/orders/${id}/status`).set("Authorization", `Bearer ${adminToken}`).send({ status, ...(note ? { note } : {}) });
async function toProcessing(id) {
  expect((await adminSet(id, "PROCESSING")).status).toBe(200);
  sendMailMock.mockClear();
}

describe("account emails", () => {
  it("sends one Welcome email on registration (no password inside) and not again", async () => {
    const { customer, credentials } = await registerCustomer(app, { email: "new.person@test.local", name: "Meera Rao" });
    const mails = to("new.person@test.local");
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe("Welcome to Tushaqsa");
    expect(mails[0].html).toContain("Meera");
    expect(mails[0].html).toContain("/account");
    expect(mails[0].text).toContain("Team Tushaqsa");
    expect(mails[0].html + mails[0].text).not.toContain(credentials.password);
    expect(/aadya/i.test(mails[0].html + mails[0].text)).toBe(false);
    await request(app).post("/api/auth/login").send({ email: credentials.email, password: credentials.password });
    expect(to("new.person@test.local")).toHaveLength(1);
    expect(customer.email).toBe("new.person@test.local");
  });

  it("guest COD checkout: Welcome (login-code wording) and Order confirmation both arrive, once each", async () => {
    const order = await codOrder({ customer: { name: "Guest Buyer", email: "guest.buyer@test.local", phone: "9876543210" } });
    const mails = to("guest.buyer@test.local");
    const welcome = mails.find((m) => m.subject === "Welcome to Tushaqsa");
    const confirm = mails.find((m) => m.subject === `Order confirmed — ${order.number}`);
    expect(welcome).toBeTruthy();
    expect(welcome.html).toContain("login code");
    expect(welcome.html + welcome.text).not.toMatch(/password[^.]*is/i);
    expect(confirm).toBeTruthy();
    expect(confirm.html).toContain("Brass Lamp");
    expect(confirm.html).toContain("Cash on Delivery");
    expect(confirm.html).toContain("₹1,000"); // 2 x 500 subtotal
    expect(confirm.html).toContain("Bengaluru"); // shipping address
    expect(confirm.text).toContain("Brass Lamp x 2");
    expect(mails.filter((m) => m.subject === "Welcome to Tushaqsa")).toHaveLength(1);
    expect(mails.filter((m) => m.subject.startsWith("Order confirmed"))).toHaveLength(1);
  });
});

describe("login code email", () => {
  it("contains the code, expiry and a do-not-share warning; the code is never logged", async () => {
    const reg = await registerCustomer(app, { email: "otp.user@test.local" });
    sendMailMock.mockClear();
    await request(app).post("/api/auth/otp/request").send({ email: reg.credentials.email });
    const mail = to("otp.user@test.local")[0];
    expect(mail.subject).toBe("Your Tushaqsa login code");
    const code = mail.html.match(/>(\d{6})</)?.[1];
    expect(code).toMatch(/^\d{6}$/);
    expect(mail.text).toContain(code);
    expect(mail.html).toMatch(/10 minutes/);
    expect(mail.html).toMatch(/Never share this code/);
    expect(mail.subject).not.toContain(code);
    expect(mail.html).not.toMatch(/ORD|TUS-\d{4}/); // no order/personal detail
    const logs = JSON.stringify(await prisma.emailLog.findMany());
    expect(logs).not.toContain(code);
    expect((await prisma.emailLog.findMany({ where: { type: "LOGIN_CODE" } })).length).toBe(1);
  });
});

describe("status emails: manual Admin changes", () => {
  it("Processing -> Shipped -> Out for delivery -> Delivered sends exactly one email each, with history", async () => {
    const order = await codOrder();
    await toProcessing(order.id);
    await prisma.shipment.create({ data: { orderId: order.id, provider: "MANUAL", carrier: "Delhivery", trackingNumber: "AWB123456", trackingUrl: "https://track.example/AWB123456", status: "CREATED" } });

    expect((await adminSet(order.id, "SHIPPED")).status).toBe(200);
    expect(subjects()).toEqual(["Your Tushaqsa order has shipped"]);
    const shipped = sent()[0];
    expect(shipped.html).toContain(order.number);
    expect(shipped.html).toContain("Delhivery");
    expect(shipped.html).toContain("AWB123456");
    expect(shipped.html).toContain("https://track.example/AWB123456");

    expect((await adminSet(order.id, "OUT_FOR_DELIVERY")).status).toBe(200);
    expect((await adminSet(order.id, "DELIVERED")).status).toBe(200);
    expect(subjects()).toEqual(["Your Tushaqsa order has shipped", "Your Tushaqsa order is out for delivery", "Your Tushaqsa order has been delivered"]);

    // Repeating a status is rejected and sends nothing.
    expect((await adminSet(order.id, "DELIVERED")).status).toBe(409);
    expect(sent()).toHaveLength(3);

    const history = await prisma.orderStatusHistory.findMany({ where: { orderId: order.id }, orderBy: { changedAt: "asc" } });
    const manual = history.filter((h) => ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(h.toStatus));
    expect(manual.map((h) => h.source)).toEqual(["ADMIN", "ADMIN", "ADMIN"]);
    expect(manual.every((h) => h.adminId === adminId)).toBe(true);
    expect(manual[0].fromStatus).toBe("PROCESSING");

    const logs = await prisma.emailLog.findMany({ where: { orderId: order.id, status: "SENT" } });
    expect(logs.map((l) => l.event).sort()).toEqual(expect.arrayContaining(["ORDER_DELIVERED", "ORDER_OUT_FOR_DELIVERY", "ORDER_SHIPPED", "ORDER_PLACED"]));
    expect(logs.every((l) => l.subject && l.recipient && l.notificationId !== undefined)).toBe(true);
  });

  it("Cancelled email says the order was cancelled, includes the Admin's reason, and invents none otherwise", async () => {
    const a = await codOrder({ customer: { name: "Cancel One", email: "c1@test.local", phone: "9876543210" } });
    sendMailMock.mockClear();
    await adminSet(a.id, "CANCELLED", "Item out of stock");
    const withReason = to("c1@test.local").find((m) => m.subject === "Update on your Tushaqsa order");
    expect(withReason.subject).toBe("Update on your Tushaqsa order");
    expect(withReason.html).toContain("cancelled");
    expect(withReason.html).toContain("Item out of stock");

    const b = await codOrder({ customer: { name: "Cancel Two", email: "c2@test.local", phone: "9876543210" } });
    sendMailMock.mockClear();
    await adminSet(b.id, "CANCELLED");
    const noReason = to("c2@test.local").find((m) => m.subject === "Update on your Tushaqsa order");
    expect(noReason.html).not.toContain("Reason:");
  });

  it("emails work for status changes regardless of newsletter consent (transactional vs marketing)", async () => {
    const order = await codOrder({ customer: { name: "No News", email: "nonews@test.local", phone: "9876543210" } });
    expect(await prisma.newsletterSubscriber.count({ where: { email: "nonews@test.local" } })).toBe(0);
    await toProcessing(order.id);
    await adminSet(order.id, "SHIPPED");
    expect(subjects()).toContain("Your Tushaqsa order has shipped");
    await prisma.newsletterSubscriber.create({ data: { email: "nonews@test.local" } });
    await prisma.newsletterSubscriber.deleteMany();
    await adminSet(order.id, "OUT_FOR_DELIVERY");
    expect(subjects()).toContain("Your Tushaqsa order is out for delivery");
  });
});

describe("online payment confirmation", () => {
  it("sends one clean confirmation only after the payment is verified server-side", async () => {
    const product = await seedTestProduct({ price: 500, stockQuantity: 10, name: "Jute Mat" });
    const placed = await request(app).post("/api/orders").send({ customer: VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items: [{ slug: product.slug, quantity: 1 }] });
    const { orderId, orderNumber } = placed.body.data;
    const session = (await request(app).post(`/api/orders/${orderId}/payment`)).body.data;
    expect(to(VALID_CUSTOMER.email).filter((m) => m.subject.startsWith("Order confirmed"))).toHaveLength(0); // unpaid: no "confirmed" email

    await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId: session.cashfreeOrderId }); // Cashfree says unpaid
    expect(subjects().filter((s) => s.startsWith("Order confirmed"))).toHaveLength(0);

    cfPay(session.cashfreeOrderId);
    await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId: session.cashfreeOrderId });
    await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId: session.cashfreeOrderId }); // repeat
    const confirmations = to(VALID_CUSTOMER.email).filter((m) => m.subject === `Order confirmed — ${orderNumber}`);
    expect(confirmations).toHaveLength(1);
    expect(confirmations[0].html).toContain("Paid online");
    expect(confirmations[0].html).toContain("Jute Mat");
  });
});

describe("Shiprocket tracking webhook", () => {
  const URL_ = "/api/webhooks/shipment-status";
  let token;
  const post = (payload, key = token) => {
    const req = request(app).post(URL_).set("Content-Type", "application/json");
    if (key) req.set("x-api-key", key);
    return req.send(JSON.stringify(payload));
  };
  const payloadFor = (order, id, label, extra = {}) => ({
    awb: "141123221084922",
    courier_name: "Delhivery Surface",
    current_status: label,
    current_status_id: id,
    shipment_status: label,
    shipment_status_id: id,
    current_timestamp: `24 10 2026 10:${String(id).padStart(2, "0")}:00`,
    order_id: order.number,
    sr_order_id: 445905009,
    is_return: 0,
    ...extra,
  });
  async function shipped() {
    const order = await codOrder();
    await toProcessing(order.id);
    token = (await generateShiprocketWebhookToken(adminId)).webhookToken;
    return order;
  }

  it("rejects a missing, wrong, or unconfigured token with 401 and changes nothing", async () => {
    const order = await codOrder();
    await toProcessing(order.id);
    expect((await post(payloadFor(order, 6, "SHIPPED"), null)).status).toBe(401); // nothing configured yet
    token = (await generateShiprocketWebhookToken(adminId)).webhookToken;
    expect((await post(payloadFor(order, 6, "SHIPPED"), null)).status).toBe(401);
    expect((await post(payloadFor(order, 6, "SHIPPED"), "not-the-token")).status).toBe(401);
    expect((await post(payloadFor(order, 6, "SHIPPED"), token + "x")).status).toBe(401);
    expect((await prisma.order.findUnique({ where: { id: order.id } })).status).toBe("PROCESSING");
    expect(sent()).toHaveLength(0);
    const logs = await prisma.webhookDeliveryLog.findMany({ where: { provider: "shiprocket" } });
    expect(logs.every((l) => l.result === "REJECTED")).toBe(true);
    expect(JSON.stringify(logs)).not.toContain(token);
  });

  it("Shipped event: order becomes SHIPPED (source SHIPROCKET), shipment saved, ONE email with courier + AWB", async () => {
    const order = await shipped();
    const res = await post(payloadFor(order, 6, "SHIPPED"));
    expect(res.status).toBe(200);
    expect(res.text).toBe("");
    const row = await prisma.order.findUnique({ where: { id: order.id }, include: { shipment: true } });
    expect(row.status).toBe("SHIPPED");
    expect(row.shipment.awb).toBe("141123221084922");
    expect(row.shipment.carrier).toBe("Delhivery Surface");
    const history = await prisma.orderStatusHistory.findFirst({ where: { orderId: order.id, toStatus: "SHIPPED" } });
    expect(history.source).toBe("SHIPROCKET");
    expect(history.shipmentId).toBe(row.shipment.id);
    expect(history.adminId).toBeNull();
    expect(subjects()).toEqual(["Your Tushaqsa order has shipped"]);
    expect(sent()[0].html).toContain("141123221084922");
    expect(sent()[0].html).toContain("Delhivery Surface");
  });

  it("a duplicate webhook delivery sends no second email", async () => {
    const order = await shipped();
    const body = payloadFor(order, 6, "SHIPPED");
    await post(body);
    const again = await post(body);
    expect(again.status).toBe(200);
    expect(subjects()).toEqual(["Your Tushaqsa order has shipped"]);
    const logs = await prisma.webhookDeliveryLog.findMany({ where: { provider: "shiprocket" }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.result)).toEqual(["PROCESSED", "DUPLICATE"]);
  });

  it("Admin marks Shipped, then Shiprocket sends Shipped: the customer gets ONE shipped email", async () => {
    const order = await shipped();
    await prisma.shipment.create({ data: { orderId: order.id, provider: "MANUAL", trackingNumber: "141123221084922", awb: "141123221084922", status: "CREATED" } });
    await adminSet(order.id, "SHIPPED");
    await post(payloadFor(order, 6, "SHIPPED"));
    await post(payloadFor(order, 42, "PICKED UP"));
    expect(subjects().filter((s) => s === "Your Tushaqsa order has shipped")).toHaveLength(1);
    const shippedLogs = await prisma.notificationEvent.findMany({ where: { orderId: order.id, event: "ORDER_SHIPPED" } });
    expect(shippedLogs).toHaveLength(1);
  });

  it("Shiprocket sends Shipped, then Admin tries Shipped again: rejected, still one email", async () => {
    const order = await shipped();
    await post(payloadFor(order, 6, "SHIPPED"));
    expect((await adminSet(order.id, "SHIPPED")).status).toBe(409);
    expect(subjects().filter((s) => s.includes("shipped"))).toHaveLength(1);
  });

  it("Out for delivery and Delivered events send one email each, in order, and nothing for in-transit scans", async () => {
    const order = await shipped();
    await post(payloadFor(order, 6, "SHIPPED"));
    await post(payloadFor(order, 18, "IN TRANSIT", { current_timestamp: "24 10 2026 12:00:00" }));
    await post(payloadFor(order, 38, "REACHED DESTINATION HUB", { current_timestamp: "24 10 2026 13:00:00" }));
    await post(payloadFor(order, 17, "OUT FOR DELIVERY"));
    await post(payloadFor(order, 7, "DELIVERED"));
    expect(subjects()).toEqual(["Your Tushaqsa order has shipped", "Your Tushaqsa order is out for delivery", "Your Tushaqsa order has been delivered"]);
    const row = await prisma.order.findUnique({ where: { id: order.id }, include: { shipment: true } });
    expect(row.status).toBe("DELIVERED");
    expect(row.shipment.status).toBe("DELIVERED");
    const sources = (await prisma.orderStatusHistory.findMany({ where: { orderId: order.id, toStatus: { in: ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] } } })).map((h) => h.source);
    expect(sources).toEqual(["SHIPROCKET", "SHIPROCKET", "SHIPROCKET"]);
  });

  it("a late/out-of-order event never moves a delivered order backwards or emails again", async () => {
    const order = await shipped();
    await post(payloadFor(order, 7, "DELIVERED"));
    sendMailMock.mockClear();
    await post(payloadFor(order, 17, "OUT FOR DELIVERY", { current_timestamp: "23 10 2026 09:00:00" }));
    await post(payloadFor(order, 6, "SHIPPED", { current_timestamp: "22 10 2026 09:00:00" }));
    expect((await prisma.order.findUnique({ where: { id: order.id } })).status).toBe("DELIVERED");
    expect(sent()).toHaveLength(0);
  });

  it("an Out-for-delivery event on an order that never got 'shipped' sends shipped first, then out for delivery", async () => {
    const order = await shipped();
    await post(payloadFor(order, 17, "OUT FOR DELIVERY"));
    expect(subjects()).toEqual(["Your Tushaqsa order has shipped", "Your Tushaqsa order is out for delivery"]);
  });

  it("Undelivered sends the delivery-attempt email once; Delayed/unknown/return events change nothing", async () => {
    const order = await shipped();
    await post(payloadFor(order, 6, "SHIPPED"));
    sendMailMock.mockClear();
    await post(payloadFor(order, 21, "UNDELIVERED"));
    await post(payloadFor(order, 21, "UNDELIVERED", { current_timestamp: "25 10 2026 10:00:00" }));
    expect(subjects()).toEqual(["Delivery attempt for your Tushaqsa order"]);
    await post(payloadFor(order, 22, "DELAYED"));
    await post(payloadFor(order, 999, "SOMETHING NEW"));
    await post(payloadFor(order, 7, "DELIVERED", { is_return: 1, current_timestamp: "26 10 2026 10:00:00" }));
    expect(sent()).toHaveLength(1);
    expect((await prisma.order.findUnique({ where: { id: order.id } })).status).toBe("SHIPPED");
  });

  it("acknowledges (200) an event for an unknown order without error", async () => {
    await codOrder();
    token = (await generateShiprocketWebhookToken(adminId)).webhookToken;
    const res = await post({ awb: "999", current_status: "SHIPPED", current_status_id: 6, order_id: "TUS-2026-424242", sr_order_id: 1, current_timestamp: "x" });
    expect(res.status).toBe(200);
  });

  it("a webhook for an unpaid online order is ignored (never marks an unpaid order shipped)", async () => {
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });
    const placed = await request(app).post("/api/orders").send({ customer: VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items: [{ slug: product.slug, quantity: 1 }] });
    token = (await generateShiprocketWebhookToken(adminId)).webhookToken;
    await post(payloadFor({ number: placed.body.data.orderNumber }, 6, "SHIPPED"));
    expect((await prisma.order.findUnique({ where: { id: placed.body.data.orderId } })).status).toBe("PENDING");
    expect(sent()).toHaveLength(0);
  });
});

describe("failures never roll back state; retries are bounded and never duplicate", () => {
  it("SMTP down: the order still becomes Delivered, the failure is logged, and a later retry sends exactly once", async () => {
    const order = await codOrder();
    await toProcessing(order.id);
    await adminSet(order.id, "SHIPPED");
    await adminSet(order.id, "OUT_FOR_DELIVERY");
    sendMailMock.mockClear();
    sendMailMock.mockRejectedValue(new Error("535 5.7.8 authentication failed"));
    const res = await adminSet(order.id, "DELIVERED");
    expect(res.status).toBe(200);
    expect((await prisma.order.findUnique({ where: { id: order.id } })).status).toBe("DELIVERED");
    const n = await prisma.notificationEvent.findFirst({ where: { orderId: order.id, event: "ORDER_DELIVERED" } });
    expect(n.status).toBe("FAILED");
    expect(n.nextRetryAt).toBeTruthy();
    expect(n.attempts).toBe(1);
    const failedLog = await prisma.emailLog.findFirst({ where: { orderId: order.id, event: "ORDER_DELIVERED", status: "FAILED" } });
    expect(failedLog.failureMessage).toContain("authentication failed");

    // Not due yet: nothing happens.
    sendMailMock.mockImplementation(async () => ({ messageId: "ok" }));
    expect((await retryDueNotifications()).attempted).toBe(0);
    await prisma.notificationEvent.update({ where: { id: n.id }, data: { nextRetryAt: new Date(Date.now() - 1000) } });
    expect((await retryDueNotifications()).sent).toBe(1);
    expect((await retryDueNotifications()).attempted).toBe(0);
    expect(subjects().filter((s) => s.includes("delivered"))).toHaveLength(2); // the failed attempt + the successful retry
    expect((await prisma.notificationEvent.findUnique({ where: { id: n.id } })).status).toBe("SENT");
  });

  it("stops retrying automatically after 3 attempts; an Admin can retry by hand, and a sent email is never re-sent", async () => {
    const order = await codOrder();
    await toProcessing(order.id);
    sendMailMock.mockClear();
    sendMailMock.mockRejectedValue(new Error("connection timeout"));
    await adminSet(order.id, "SHIPPED");
    const n = await prisma.notificationEvent.findFirst({ where: { orderId: order.id, event: "ORDER_SHIPPED" } });
    for (let i = 0; i < 4; i++) {
      await prisma.notificationEvent.update({ where: { id: n.id }, data: { nextRetryAt: new Date(Date.now() - 1000) } });
      await retryDueNotifications();
    }
    const after = await prisma.notificationEvent.findUnique({ where: { id: n.id } });
    expect(after.attempts).toBe(3); // 1 original + 2 automatic retries, then it stops
    expect(after.status).toBe("FAILED");
    expect((await retryDueNotifications()).attempted).toBe(0);

    sendMailMock.mockImplementation(async () => ({ messageId: "ok" }));
    const retry = await request(app).post(`/api/admin/email/notifications/${n.id}/retry`).set("Authorization", `Bearer ${adminToken}`);
    expect(retry.body.data.sent).toBe(true);
    const again = await request(app).post(`/api/admin/email/notifications/${n.id}/retry`).set("Authorization", `Bearer ${adminToken}`);
    expect(again.body.data).toMatchObject({ sent: false, reason: "already_sent" });
  });

  it("SMTP not configured: statuses still work and the skip is recorded", async () => {
    delete process.env.SMTP_HOST;
    try {
      const order = await codOrder();
      await toProcessing(order.id);
      expect((await adminSet(order.id, "SHIPPED")).status).toBe(200);
      expect(sent()).toHaveLength(0);
      expect((await prisma.emailLog.findFirst({ where: { orderId: order.id, event: "ORDER_SHIPPED" } })).status).toBe("SKIPPED");
    } finally {
      process.env.SMTP_HOST = "smtp.test.local";
    }
  });

  it("the ledger itself dedupes: the same event requested twice sends once", async () => {
    const order = await codOrder();
    sendMailMock.mockClear();
    await notifyOrderEvent(order.id, "ORDER_SHIPPED", { source: "ADMIN" });
    const second = await notifyOrderEvent(order.id, "ORDER_SHIPPED", { source: "SHIPROCKET" });
    expect(second).toMatchObject({ sent: false, reason: "duplicate" });
    expect(subjects().filter((s) => s === "Your Tushaqsa order has shipped")).toHaveLength(1);
  });
});

describe("Admin email templates", () => {
  const api = (method, path, body) => request(app)[method](`/api/admin/email${path}`).set("Authorization", `Bearer ${adminToken}`).send(body);

  it("lists templates with defaults, and edited wording is used in the real email", async () => {
    const list = await api("get", "/templates");
    expect(list.status).toBe(200);
    const keys = list.body.data.templates.map((t) => t.key);
    expect(keys).toEqual(expect.arrayContaining(["ACCOUNT_CREATED", "LOGIN_CODE", "PASSWORD_RESET", "ORDER_PLACED", "ORDER_SHIPPED", "ORDER_OUT_FOR_DELIVERY", "ORDER_DELIVERED", "ORDER_CANCELLED"]));
    const put = await api("put", "/templates/ORDER_SHIPPED", { subject: "Good news: {{orderNumber}} shipped", heading: "On its way, {{firstName}}", body: "Your parcel from {{brandName}} is moving. AWB {{trackingNumber}}.", enabled: true });
    expect(put.status).toBe(200);
    const order = await codOrder();
    await toProcessing(order.id);
    await adminSet(order.id, "SHIPPED");
    expect(sent()[0].subject).toBe(`Good news: ${order.number} shipped`);
    expect(sent()[0].html).toContain("On its way, Test");
    expect(sent()[0].html).toContain("from Tushaqsa is moving");
  });

  it("rejects unknown placeholders and scripts; escapes values instead of executing anything", async () => {
    const bad = await api("put", "/templates/ORDER_SHIPPED", { subject: "Hi {{process.env.SECRET}}", heading: "x{{constructor}}", body: "text {{customerPasswordHash}}" });
    expect(bad.status).toBe(400);
    expect((await api("put", "/templates/ORDER_SHIPPED", { subject: "Hello there", heading: "Heading", body: "<script>alert(1)</script> text" })).status).toBe(400);
    await api("put", "/templates/ORDER_SHIPPED", { subject: "Shipped {{orderNumber}}", heading: "Hello {{customerName}}", body: "Your order {{orderNumber}} shipped." });
    const order = await codOrder({ customer: { name: "<img src=x onerror=alert(1)>", email: "xss@test.local", phone: "9876543210" } });
    await toProcessing(order.id);
    await adminSet(order.id, "SHIPPED");
    const mail = to("xss@test.local")[0];
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;img src=x");
  });

  it("disabled templates send nothing; security templates cannot be disabled; reset restores defaults", async () => {
    expect((await api("patch", "/templates/ORDER_DELIVERED/enabled", { enabled: false })).status).toBe(200);
    const order = await codOrder();
    await toProcessing(order.id);
    await adminSet(order.id, "SHIPPED");
    await adminSet(order.id, "OUT_FOR_DELIVERY");
    sendMailMock.mockClear();
    await adminSet(order.id, "DELIVERED");
    expect(sent()).toHaveLength(0);

    expect((await api("patch", "/templates/LOGIN_CODE/enabled", { enabled: false })).status).toBe(400);
    expect((await api("patch", "/templates/PASSWORD_RESET/enabled", { enabled: false })).status).toBe(400);

    await api("put", "/templates/ORDER_CANCELLED", { subject: "Custom subject", heading: "Custom", body: "Custom body text" });
    const reset = await api("post", "/templates/ORDER_CANCELLED/reset");
    expect(reset.body.data.subject).toBe("Update on your Tushaqsa order");
    expect(reset.body.data.customized).toBe(false);
  });

  it("preview returns brand-correct responsive HTML and plain text; the login-code template always shows a code box", async () => {
    const preview = await api("post", "/templates/ORDER_PLACED/preview");
    expect(preview.status).toBe(200);
    const { html, text, subject } = preview.body.data;
    expect(subject).toMatch(/^Order confirmed — /);
    expect(html).toContain('name="viewport"');
    expect(html).toContain("max-width:600px");
    expect(html).toContain("Team Tushaqsa");
    expect(html).toContain("Home Decor and Lifestyle Products");
    expect(/aadya/i.test(html + text)).toBe(false);
    expect(text).toContain("Team Tushaqsa");
    // Even if Admin deletes the code from the wording, the code still appears (it lives in the layout).
    await api("put", "/templates/LOGIN_CODE", { subject: "Code for {{brandName}}", heading: "Sign in", body: "Welcome back." });
    const reg = await registerCustomer(app, { email: "tpl.otp@test.local" });
    sendMailMock.mockClear();
    await request(app).post("/api/auth/otp/request").send({ email: reg.credentials.email });
    expect(to("tpl.otp@test.local")[0].html).toMatch(/>\d{6}</);
  });

  it("requires a super admin", async () => {
    expect((await request(app).get("/api/admin/email/templates")).status).toBe(401);
  });
});

describe("Shiprocket admin settings", () => {
  const api = (method, path, body) => request(app)[method](`/api/admin/integrations/shiprocket${path}`).set("Authorization", `Bearer ${adminToken}`).send(body);

  it("generates the webhook token once, never returns it again, stores it encrypted, and shows the neutral URL", async () => {
    const gen = await api("post", "/webhook-token/generate");
    const token = gen.body.data.webhookToken;
    expect(token.length).toBeGreaterThanOrEqual(32);
    const summary = await api("get", "/summary");
    expect(JSON.stringify(summary.body)).not.toContain(token);
    expect(summary.body.data.webhook).toMatchObject({ tokenConfigured: true, header: "x-api-key" });
    expect(summary.body.data.webhook.url).toMatch(/\/api\/webhooks\/shipment-status$/);
    expect(summary.body.data.webhook.url).not.toMatch(/shiprocket|\/sr|\/kr|kartrocket/i);
    const row = await prisma.integrationCredential.findFirst({ where: { provider: "SHIPROCKET_WEBHOOK" } });
    expect(row.encryptedData).not.toContain(token);
    const audit = JSON.stringify(await prisma.adminAuditLog.findMany({ where: { provider: "SHIPROCKET" } }));
    expect(audit).not.toContain(token);
    expect(summary.body.data.mapping.some((m) => m.id === 17 && m.becomes === "OUT_FOR_DELIVERY")).toBe(true);
    const removed = await api("delete", "/webhook-token");
    expect(removed.body.data.removed).toBe(true);
    expect((await api("get", "/summary")).body.data.webhook.tokenConfigured).toBe(false);
  });
});
