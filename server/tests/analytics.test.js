import { describe, it, expect, beforeEach, afterAll } from "vitest";
import crypto from "node:crypto";
import request from "supertest";
import { resetDb, seedTestProduct, seedTestAdmin, VALID_CUSTOMER, VALID_ADDRESS } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";

let orderCounter = 0;
import { vi } from "vitest";
vi.mock("../src/modules/payments/razorpay.client.js", () => ({
  isRazorpayConfigured: () => true,
  getRazorpayClient: () => ({
    orders: { create: vi.fn(async () => ({ id: `order_mock_${++orderCounter}` })) },
  }),
}));

const { createApp } = await import("../src/app.js");
const app = createApp();

beforeEach(async () => {
  await resetDb();
  orderCounter = 0;
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

function signPayment(razorpayOrderId, razorpayPaymentId) {
  return crypto.createHmac("sha256", env.razorpay.keySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
}

async function placeAndPayOrder(overrides = {}) {
  const product = overrides.product || (await seedTestProduct({ price: 500, stockQuantity: 10 }));
  const created = await request(app)
    .post("/api/orders")
    .send({
      customer: VALID_CUSTOMER,
      shippingAddress: VALID_ADDRESS,
      items: [{ slug: product.slug, quantity: 1 }],
      ...(overrides.utm || {}),
    });
  const { orderId, orderNumber } = created.body.data;
  const pay = await request(app).post(`/api/orders/${orderId}/payment`);
  const razorpayOrderId = pay.body.data.razorpayOrderId;
  const paymentId = `pay_${orderId}`;
  const signature = signPayment(razorpayOrderId, paymentId);
  await request(app).post("/api/payments/razorpay/verify").send({
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  });
  return { orderId, orderNumber, product };
}

describe("POST /api/analytics/events", () => {
  it("records an allowlisted client event", async () => {
    const res = await request(app)
      .post("/api/analytics/events")
      .send({ events: [{ type: "product_view", sessionId: "sess_1", productId: "prod_1" }] });
    expect(res.status).toBe(201);
    expect(res.body.data.recorded).toBe(1);

    const rows = await prisma.analyticsEvent.findMany({ where: { type: "product_view" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].sessionId).toBe("sess_1");
  });

  it("rejects an event type outside the allowlist", async () => {
    const res = await request(app)
      .post("/api/analytics/events")
      .send({ events: [{ type: "not_a_real_type", sessionId: "sess_1" }] });
    expect(res.status).toBe(400);
  });

  it("rejects a client-submitted `purchase` event — it is server-authoritative only", async () => {
    const res = await request(app)
      .post("/api/analytics/events")
      .send({ events: [{ type: "purchase", sessionId: "sess_1", metadata: { totalAmount: 99999 } }] });
    expect(res.status).toBe(400);

    const rows = await prisma.analyticsEvent.findMany({ where: { type: "purchase" } });
    expect(rows).toHaveLength(0);
  });
});

describe("Purchase events are server-authoritative", () => {
  it("records exactly one `purchase` event when a payment is finalized, never from the client", async () => {
    const { orderId, orderNumber } = await placeAndPayOrder();

    const purchaseEvents = await prisma.analyticsEvent.findMany({ where: { type: "purchase", orderId } });
    expect(purchaseEvents).toHaveLength(1);
    expect(purchaseEvents[0].metadata.orderNumber).toBe(orderNumber);
  });

  it("never double-records a purchase event on a duplicate/idempotent payment confirmation", async () => {
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });
    const created = await request(app)
      .post("/api/orders")
      .send({ customer: VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items: [{ slug: product.slug, quantity: 1 }] });
    const { orderId } = created.body.data;
    const pay = await request(app).post(`/api/orders/${orderId}/payment`);
    const razorpayOrderId = pay.body.data.razorpayOrderId;
    const paymentId = "pay_dup";
    const signature = signPayment(razorpayOrderId, paymentId);
    const body = { razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature };

    await request(app).post("/api/payments/razorpay/verify").send(body);
    await request(app).post("/api/payments/razorpay/verify").send(body); // second call is a no-op

    const purchaseEvents = await prisma.analyticsEvent.findMany({ where: { type: "purchase", orderId } });
    expect(purchaseEvents).toHaveLength(1);
  });
});

describe("UTM attribution snapshot on order", () => {
  it("stores UTM fields on the order at creation and mirrors them onto the purchase event", async () => {
    const { orderId } = await placeAndPayOrder({
      utm: { utmSource: "newsletter", utmMedium: "email", utmCampaign: "diwali-2026" },
    });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order.utmSource).toBe("newsletter");
    expect(order.utmMedium).toBe("email");
    expect(order.utmCampaign).toBe("diwali-2026");

    const purchaseEvent = await prisma.analyticsEvent.findFirst({ where: { type: "purchase", orderId } });
    expect(purchaseEvent.utmSource).toBe("newsletter");
    expect(purchaseEvent.utmCampaign).toBe("diwali-2026");
  });

  it("leaves UTM fields null when none were provided", async () => {
    const { orderId } = await placeAndPayOrder();
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order.utmSource).toBeNull();
  });
});

describe("GET /api/admin/analytics/overview", () => {
  it("computes revenue, order count and AOV correctly for a date range, and excludes orders outside it", async () => {
    await seedTestAdmin();
    const admin = await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password });
    const token = admin.body.data.accessToken;

    await placeAndPayOrder(); // 500
    const { orderId: secondOrderId } = await placeAndPayOrder(); // another 500

    // Push one paid order outside the range so range filtering is exercised.
    await prisma.order.update({ where: { id: secondOrderId }, data: { paidAt: new Date("2020-01-01") } });

    const res = await request(app)
      .get("/api/admin/analytics/overview?range=30d")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.revenue.orderCount).toBe(1);
    expect(res.body.data.revenue.revenue).toBe(599);
    expect(res.body.data.revenue.aov).toBe(599);
  });

  it("requires admin auth", async () => {
    const res = await request(app).get("/api/admin/analytics/overview?range=30d");
    expect(res.status).toBe(401);
  });
});

describe("Abandoned cart detection", () => {
  it("lists a cart with items that has been idle past the threshold and no completed order since", async () => {
    const product = await seedTestProduct({ price: 300, stockQuantity: 10 });
    const customer = await prisma.customer.create({
      data: {
        name: "Idle Customer",
        email: "idle@example.com",
        phone: "9876543210",
        passwordHash: "x",
      },
    });
    const cart = await prisma.cart.create({ data: { customerId: customer.id } });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: 2 } });
    // Simulate the cart having sat idle for 2 hours (past the 1-hour threshold).
    await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });

    await seedTestAdmin();
    const admin = await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password });
    const token = admin.body.data.accessToken;

    const res = await request(app).get("/api/admin/analytics/abandoned-carts").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.find((c) => c.cartId === cart.id)).toBeTruthy();
  });

  it("sends a recovery email exactly once and marks it sent (never spams a second trigger)", async () => {
    const product = await seedTestProduct({ price: 300, stockQuantity: 10 });
    const customer = await prisma.customer.create({
      data: { name: "Idle Customer 2", email: "idle2@example.com", phone: "9876543211", passwordHash: "x" },
    });
    const cart = await prisma.cart.create({ data: { customerId: customer.id } });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: 1 } });
    await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });

    await seedTestAdmin();
    const admin = await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password });
    const token = admin.body.data.accessToken;

    const first = await request(app)
      .post(`/api/admin/analytics/abandoned-carts/${cart.id}/recovery-email`)
      .set("Authorization", `Bearer ${token}`);
    expect(first.body.data.sent).toBe(true);

    const second = await request(app)
      .post(`/api/admin/analytics/abandoned-carts/${cart.id}/recovery-email`)
      .set("Authorization", `Bearer ${token}`);
    expect(second.body.data.sent).toBe(false);
    expect(second.body.data.reason).toBe("already_sent");

    const reloaded = await prisma.cart.findUnique({ where: { id: cart.id } });
    expect(reloaded.recoveryEmailSentAt).toBeTruthy();
  });
});
