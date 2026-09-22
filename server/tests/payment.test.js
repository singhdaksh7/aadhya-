import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import crypto from "node:crypto";
import request from "supertest";
import { resetDb, seedTestProduct, VALID_CUSTOMER, VALID_ADDRESS } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";

// The real Razorpay SDK would make a network call here — this test suite
// runs without live Razorpay TEST credentials (none were available in this
// environment), so the provider client is mocked at this one boundary.
// Everything downstream (signature verification, webhook handling,
// idempotency, inventory) runs for real against the test database.
let orderCounter = 0;
vi.mock("../src/modules/payments/razorpay.client.js", () => ({
  isRazorpayConfigured: () => true,
  getRazorpayClient: () => ({
    orders: {
      create: vi.fn(async () => ({ id: `order_mock_${++orderCounter}` })),
    },
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

async function placeOrder(overrides = {}) {
  const product = overrides.product || (await seedTestProduct({ price: 500, stockQuantity: 10 }));
  const res = await request(app)
    .post("/api/orders")
    .send({
      customer: VALID_CUSTOMER,
      shippingAddress: VALID_ADDRESS,
      items: [{ slug: product.slug, quantity: overrides.quantity ?? 2 }],
    });
  return { orderId: res.body.data.orderId, orderNumber: res.body.data.orderNumber, product };
}

function signPayment(razorpayOrderId, razorpayPaymentId) {
  return crypto
    .createHmac("sha256", env.razorpay.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
}

function signWebhookBody(body) {
  return crypto.createHmac("sha256", env.razorpay.webhookSecret).update(body).digest("hex");
}

describe("Razorpay order creation", () => {
  it("creates a provider order and stores it on the Payment row", async () => {
    const { orderId } = await placeOrder();
    const res = await request(app).post(`/api/orders/${orderId}/payment`);
    expect(res.status).toBe(200);
    expect(res.body.data.razorpayOrderId).toMatch(/^order_mock_/);
    expect(res.body.data.keyId).toBeTruthy();

    const payment = await prisma.payment.findFirst({ where: { orderId } });
    expect(payment.providerOrderId).toBe(res.body.data.razorpayOrderId);
  });

  it("reuses the existing provider order instead of creating a second one", async () => {
    const { orderId } = await placeOrder();
    const first = await request(app).post(`/api/orders/${orderId}/payment`);
    const second = await request(app).post(`/api/orders/${orderId}/payment`);
    expect(second.body.data.razorpayOrderId).toBe(first.body.data.razorpayOrderId);
  });

  it("refuses to create a payment order for an order that's already paid", async () => {
    const { orderId } = await placeOrder();
    await request(app).post(`/api/orders/${orderId}/payment`);
    const payment = await prisma.payment.findFirst({ where: { orderId } });
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "PAID" } });
    await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID" } });

    const res = await request(app).post(`/api/orders/${orderId}/payment`);
    expect(res.status).toBe(409);
  });
});

describe("POST /api/payments/razorpay/verify", () => {
  it("accepts a validly signed payment and confirms the order", async () => {
    const { orderId, orderNumber, product } = await placeOrder({ quantity: 2 });
    const created = await request(app).post(`/api/orders/${orderId}/payment`);
    const razorpayOrderId = created.body.data.razorpayOrderId;
    const paymentId = "pay_test_ok";
    const signature = signPayment(razorpayOrderId, paymentId);

    const res = await request(app).post("/api/payments/razorpay/verify").send({
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.orderNumber).toBe(orderNumber);
    expect(res.body.data.paymentStatus).toBe("PAID");
    expect(res.body.data.status).toBe("CONFIRMED");

    const reloadedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(reloadedProduct.stockQuantity).toBe(8); // 10 - 2, decremented exactly once
  });

  it("rejects an invalid signature and leaves the order pending", async () => {
    const { orderId } = await placeOrder();
    const created = await request(app).post(`/api/orders/${orderId}/payment`);

    const res = await request(app).post("/api/payments/razorpay/verify").send({
      razorpay_order_id: created.body.data.razorpayOrderId,
      razorpay_payment_id: "pay_fake",
      razorpay_signature: "0".repeat(64),
    });

    expect(res.status).toBe(400);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order.paymentStatus).toBe("PENDING");
  });

  it("refuses a payment whose order id doesn't match any known payment (IDOR guard)", async () => {
    const res = await request(app).post("/api/payments/razorpay/verify").send({
      razorpay_order_id: "order_never_issued",
      razorpay_payment_id: "pay_x",
      razorpay_signature: "0".repeat(64),
    });
    expect(res.status).toBe(400);
  });

  it("is idempotent: verifying twice does not decrement stock twice", async () => {
    const { orderId, product } = await placeOrder({ quantity: 1 });
    const created = await request(app).post(`/api/orders/${orderId}/payment`);
    const razorpayOrderId = created.body.data.razorpayOrderId;
    const paymentId = "pay_twice";
    const signature = signPayment(razorpayOrderId, paymentId);
    const body = { razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature };

    await request(app).post("/api/payments/razorpay/verify").send(body);
    await request(app).post("/api/payments/razorpay/verify").send(body);

    const reloadedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(reloadedProduct.stockQuantity).toBe(9); // 10 - 1, only once
  });

  it("failed payment does not decrement stock", async () => {
    const { orderId, product } = await placeOrder({ quantity: 1 });
    const created = await request(app).post(`/api/orders/${orderId}/payment`);

    await request(app).post("/api/payments/razorpay/verify").send({
      razorpay_order_id: created.body.data.razorpayOrderId,
      razorpay_payment_id: "pay_bad",
      razorpay_signature: "0".repeat(64),
    });

    const reloadedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(reloadedProduct.stockQuantity).toBe(10);
  });
});

describe("POST /api/webhooks/razorpay", () => {
  it("rejects a webhook with an invalid signature", async () => {
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1" } } } });
    const res = await request(app)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", "wrong")
      .send(body);
    expect(res.status).toBe(400);
  });

  it("finalizes payment on a valid payment.captured event", async () => {
    const { orderId, product } = await placeOrder({ quantity: 1 });
    const created = await request(app).post(`/api/orders/${orderId}/payment`);
    const razorpayOrderId = created.body.data.razorpayOrderId;

    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_webhook_1", order_id: razorpayOrderId, method: "upi" } } },
    });
    const signature = signWebhookBody(body);

    const res = await request(app)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(body);

    expect(res.status).toBe(200);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order.paymentStatus).toBe("PAID");
    const reloadedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(reloadedProduct.stockQuantity).toBe(9);
  });

  it("is idempotent under duplicate webhook delivery (no double stock decrement)", async () => {
    const { orderId, product } = await placeOrder({ quantity: 1 });
    const created = await request(app).post(`/api/orders/${orderId}/payment`);
    const razorpayOrderId = created.body.data.razorpayOrderId;

    const body = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_dup", order_id: razorpayOrderId, method: "upi" } } },
    });
    const signature = signWebhookBody(body);

    const first = await request(app)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(body);
    const second = await request(app)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(body);

    expect(first.body.duplicate).toBeUndefined();
    expect(second.body.duplicate).toBe(true);

    const reloadedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(reloadedProduct.stockQuantity).toBe(9); // still only decremented once
  });

  it("payment.failed marks the payment FAILED without touching stock", async () => {
    const { orderId, product } = await placeOrder({ quantity: 1 });
    const created = await request(app).post(`/api/orders/${orderId}/payment`);
    const razorpayOrderId = created.body.data.razorpayOrderId;

    const body = JSON.stringify({
      event: "payment.failed",
      payload: { payment: { entity: { id: "pay_failed_1", order_id: razorpayOrderId } } },
    });
    const signature = signWebhookBody(body);

    await request(app)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(body);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order.paymentStatus).toBe("FAILED");
    const reloadedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(reloadedProduct.stockQuantity).toBe(10);
  });

  it("verify-then-webhook race still only decrements stock once", async () => {
    const { orderId, product } = await placeOrder({ quantity: 1 });
    const created = await request(app).post(`/api/orders/${orderId}/payment`);
    const razorpayOrderId = created.body.data.razorpayOrderId;
    const paymentId = "pay_race";

    const verifyBody = {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signPayment(razorpayOrderId, paymentId),
    };
    const webhookBody = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: paymentId, order_id: razorpayOrderId, method: "card" } } },
    });
    const webhookSignature = signWebhookBody(webhookBody);

    await Promise.all([
      request(app).post("/api/payments/razorpay/verify").send(verifyBody),
      request(app)
        .post("/api/webhooks/razorpay")
        .set("Content-Type", "application/json")
        .set("x-razorpay-signature", webhookSignature)
        .send(webhookBody),
    ]);

    const reloadedProduct = await prisma.product.findUnique({ where: { id: product.id } });
    expect(reloadedProduct.stockQuantity).toBe(9);
  });
});
