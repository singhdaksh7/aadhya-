import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { resetDb, seedTestProduct, registerCustomer, VALID_CUSTOMER, VALID_ADDRESS } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";
import { cf, resetCashfree, cfPay, cfAttempt, cfExpire, signWebhook, webhookBody } from "./fakes/cashfree.js";

// Only the network boundary to Cashfree is faked (see fakes/cashfree.js). Order creation, server-side
// verification, webhook signature checks, idempotency, stock and invoices all run for real against the
// test database.
vi.mock("../src/modules/payments/cashfree.client.js", async () => (await import("./fakes/cashfree.js")).cashfreeClientMock());

const { createApp } = await import("../src/app.js");
const app = createApp();

beforeEach(async () => {
  await resetDb();
  resetCashfree();
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
      customer: overrides.customer || VALID_CUSTOMER,
      shippingAddress: VALID_ADDRESS,
      items: [{ slug: product.slug, quantity: overrides.quantity ?? 2 }],
      ...(overrides.paymentMethod ? { paymentMethod: overrides.paymentMethod } : {}),
    });
  return { res, orderId: res.body.data?.orderId, orderNumber: res.body.data?.orderNumber, product };
}

async function startPayment(orderId) {
  const res = await request(app).post(`/api/orders/${orderId}/payment`);
  return res;
}

async function postWebhook(type, orderId, { status = "SUCCESS", amount, secret } = {}) {
  const body = webhookBody(type, { orderId, status, amount: amount ?? cf.orders.get(orderId)?.order_amount ?? 1 });
  const { timestamp, signature } = signWebhook(body, undefined, secret);
  return request(app)
    .post("/api/webhooks/cashfree")
    .set("Content-Type", "application/json")
    .set("x-webhook-timestamp", timestamp)
    .set("x-webhook-signature", signature)
    .send(body);
}

describe("Cashfree order creation (server-side, server-priced)", () => {
  it("creates a Cashfree order from the stored order total and returns a payment session", async () => {
    const { orderId, orderNumber } = await placeOrder({ quantity: 2 });
    const res = await startPayment(orderId);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ provider: "cashfree", mode: "sandbox", cashfreeOrderId: orderNumber, currency: "INR" });
    expect(res.body.data.paymentSessionId).toBeTruthy();

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    const sent = cf.orders.get(orderNumber);
    expect(sent.order_amount).toBe(Number(order.totalAmount)); // from the server calculation
    expect(sent.order_currency).toBe("INR");
    // Real checkout data, not placeholders.
    expect(sent.customer_details).toMatchObject({ customer_phone: "9876543210", customer_email: VALID_CUSTOMER.email, customer_name: VALID_CUSTOMER.name });
    expect(sent.customer_details.customer_id).toMatch(/^[a-zA-Z0-9]{3,50}$/);
    expect(sent.order_meta.return_url).toContain("/payment/return?order_id={order_id}");

    const payment = await prisma.payment.findFirst({ where: { orderId } });
    expect(payment.provider).toBe("cashfree");
    expect(payment.providerOrderId).toBe(orderNumber);
  });

  it("ignores any amount/currency a browser tries to send", async () => {
    const { orderId } = await placeOrder();
    const res = await request(app).post(`/api/orders/${orderId}/payment`).send({ amount: 1, currency: "USD", order_amount: 1 });
    expect(res.status).toBe(200);
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(cf.orders.get(res.body.data.cashfreeOrderId).order_amount).toBe(Number(order.totalAmount));
    expect(cf.orders.get(res.body.data.cashfreeOrderId).order_currency).toBe("INR");
  });

  it("reuses the live Cashfree order instead of creating a second one", async () => {
    const { orderId } = await placeOrder();
    const first = await startPayment(orderId);
    const second = await startPayment(orderId);
    expect(second.body.data.cashfreeOrderId).toBe(first.body.data.cashfreeOrderId);
    expect(second.body.data.paymentSessionId).toBe(first.body.data.paymentSessionId);
    expect(cf.calls.createOrder).toBe(1);
  });

  it("mints a fresh Cashfree order when the previous one expired", async () => {
    const { orderId } = await placeOrder();
    const first = await startPayment(orderId);
    cfExpire(first.body.data.cashfreeOrderId);
    const second = await startPayment(orderId);
    expect(second.status).toBe(200);
    expect(second.body.data.cashfreeOrderId).not.toBe(first.body.data.cashfreeOrderId);
    expect(second.body.data.cashfreeOrderId.length).toBeLessThanOrEqual(45);
  });

  it("refuses an order for a different customer's account-linked order (IDOR guard)", async () => {
    const owner = await registerCustomer(app, { email: "owner@test.local" });
    const attacker = await registerCustomer(app, { email: "attacker@test.local" });
    const product = await seedTestProduct({ slug: "idor-payment-product", price: 500, stockQuantity: 10 });
    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ items: [{ slug: product.slug, quantity: 1 }], customer: { name: owner.customer.name, email: owner.customer.email, phone: "9876543210" }, shippingAddress: VALID_ADDRESS });
    const orderId = orderRes.body.data.orderId;
    expect((await request(app).post(`/api/orders/${orderId}/payment`)).status).toBe(404);
    expect((await request(app).post(`/api/orders/${orderId}/payment`).set("Authorization", `Bearer ${attacker.accessToken}`)).status).toBe(404);
    expect((await request(app).post(`/api/orders/${orderId}/payment/retry`).set("Authorization", `Bearer ${attacker.accessToken}`)).status).toBe(404);
    expect((await request(app).post(`/api/orders/${orderId}/payment`).set("Authorization", `Bearer ${owner.accessToken}`)).status).toBe(200);
  });

  it("refuses to create a payment for an already-paid order", async () => {
    const { orderId } = await placeOrder();
    await startPayment(orderId);
    const payment = await prisma.payment.findFirst({ where: { orderId } });
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "PAID" } });
    await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID" } });
    expect((await startPayment(orderId)).status).toBe(409);
  });

  it("asks for a valid 10-digit mobile number instead of inventing one", async () => {
    const { orderId } = await placeOrder({ customer: { ...VALID_CUSTOMER, phone: "12345" } });
    if (!orderId) return; // order validation already rejects short numbers at checkout - nothing to send to Cashfree
    const res = await startPayment(orderId);
    expect(res.status).toBe(400);
    expect(cf.calls.createOrder).toBe(0);
  });

  it("shows a safe message (no provider detail) when Cashfree rejects the credentials", async () => {
    const { orderId } = await placeOrder();
    cf.failCreate = { status: 401, message: "authentication Failed: bad secret abc" };
    const res = await startPayment(orderId);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/bad secret|abc/);
  });
});

describe("Cashfree not configured / disabled (COD must keep working)", () => {
  it("refuses to start an online payment when Cashfree is not configured, with a clear message", async () => {
    cf.configured = false;
    const { orderId } = await placeOrder();
    const res = await startPayment(orderId);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not available right now/i);
    expect(cf.calls.createOrder).toBe(0);
  });

  it("the public settings tell the storefront whether online payment can actually be completed", async () => {
    cf.configured = false;
    expect((await request(app).get("/api/settings")).body.data.payments.cashfreeAvailable).toBe(false);
    cf.configured = true;
    expect((await request(app).get("/api/settings")).body.data.payments.cashfreeAvailable).toBe(true);
    await prisma.siteSetting.upsert({ where: { key: "payments" }, create: { key: "payments", value: { cashfreeEnabled: false } }, update: { value: { cashfreeEnabled: false } } });
    expect((await request(app).get("/api/settings")).body.data.payments.cashfreeAvailable).toBe(false);
  });

  it("COD checkout works with Cashfree unconfigured", async () => {
    cf.configured = false;
    await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [], codSupported: true } }).catch(() => {});

    const { res, product } = await placeOrder({ paymentMethod: "cod", quantity: 1 });
    expect(res.status).toBe(201);
    const order = await prisma.order.findUnique({ where: { id: res.body.data.orderId } });
    expect(order.status).toBe("CONFIRMED");
    expect(cf.calls.createOrder).toBe(0);
    const reloaded = await prisma.product.findUnique({ where: { id: product.id } });
    expect(reloaded.stockQuantity).toBe(9);
  });

  it("COD checkout works when online payment is switched off", async () => {
    await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [], codSupported: true } }).catch(() => {});
    await prisma.siteSetting.upsert({ where: { key: "payments" }, create: { key: "payments", value: { cashfreeEnabled: false, codEnabled: true } }, update: { value: { cashfreeEnabled: false, codEnabled: true } } });
    const { res } = await placeOrder({ paymentMethod: "cod", quantity: 1 });
    expect(res.status).toBe(201);
    const online = await placeOrder({ quantity: 1 });
    expect(online.res.status).toBe(400); // online checkout is switched off
  });

  it("still accepts the legacy paymentMethod value from an older cached storefront", async () => {
    const { res } = await placeOrder({ paymentMethod: "razorpay", quantity: 1 });
    expect(res.status).toBe(201);
    const payment = await prisma.payment.findFirst({ where: { orderId: res.body.data.orderId } });
    expect(payment.provider).toBe("cashfree");
  });
});

describe("POST /api/payments/cashfree/verify (server-side confirmation)", () => {
  it("confirms the order only after Cashfree reports it PAID", async () => {
    const { orderId, orderNumber, product } = await placeOrder({ quantity: 2 });
    const session = (await startPayment(orderId)).body.data;
    cfPay(session.cashfreeOrderId);

    const res = await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId: session.cashfreeOrderId });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: "PAID", orderNumber });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order.paymentStatus).toBe("PAID");
    expect(order.status).toBe("CONFIRMED");
    const payment = await prisma.payment.findFirst({ where: { orderId } });
    expect(payment.providerPaymentId).toBeTruthy();
    expect(payment.method).toBe("upi");
    expect((await prisma.product.findUnique({ where: { id: product.id } })).stockQuantity).toBe(8);
  });

  it("does NOT mark the order paid when Cashfree says it is unpaid, whatever the browser claims", async () => {
    const { orderId } = await placeOrder();
    const session = (await startPayment(orderId)).body.data;
    const res = await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId: session.cashfreeOrderId, status: "PAID", order_status: "PAID", payment_status: "SUCCESS" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PENDING");
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).toBe("PENDING");
  });

  it("reports a pending attempt as PENDING and a failed attempt as FAILED", async () => {
    const { orderId } = await placeOrder();
    const { cashfreeOrderId } = (await startPayment(orderId)).body.data;
    cfAttempt(cashfreeOrderId, "PENDING");
    expect((await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId })).body.data.status).toBe("PENDING");
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).toBe("PENDING");

    cf.payments.set(cashfreeOrderId, []);
    cfAttempt(cashfreeOrderId, "FAILED");
    expect((await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId })).body.data.status).toBe("FAILED");
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).toBe("FAILED");
  });

  it("reports a cancelled/dropped checkout as FAILED and an expired order as EXPIRED, never as paid", async () => {
    const { orderId } = await placeOrder();
    const { cashfreeOrderId } = (await startPayment(orderId)).body.data;
    cfAttempt(cashfreeOrderId, "USER_DROPPED");
    expect((await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId })).body.data.status).toBe("FAILED");
    cfExpire(cashfreeOrderId);
    expect((await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId })).body.data.status).toBe("EXPIRED");
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).not.toBe("PAID");
  });

  it("a later successful retry flips a failed payment to PAID", async () => {
    const { orderId } = await placeOrder();
    const { cashfreeOrderId } = (await startPayment(orderId)).body.data;
    cfAttempt(cashfreeOrderId, "FAILED");
    await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId });
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).toBe("FAILED");
    cfPay(cashfreeOrderId);
    expect((await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId })).body.data.status).toBe("PAID");
  });

  it("rejects a payment whose amount does not match the order total", async () => {
    const { orderId } = await placeOrder();
    const { cashfreeOrderId } = (await startPayment(orderId)).body.data;
    cfPay(cashfreeOrderId);
    cf.orders.get(cashfreeOrderId).order_amount = 1; // Cashfree reports less than the order costs
    const res = await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId });
    expect(res.status).toBe(400);
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).toBe("PENDING");
  });

  it("refuses an order id that was never issued, and malformed ids", async () => {
    expect((await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId: "TUS-2026-999999" })).status).toBe(404);
    expect((await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId: "bad id; drop" })).status).toBe(400);
    expect((await request(app).post("/api/payments/cashfree/verify").send({})).status).toBe(400);
  });

  it("is idempotent: verifying repeatedly does not decrement stock twice or duplicate invoices", async () => {
    const { orderId, product } = await placeOrder({ quantity: 1 });
    const { cashfreeOrderId } = (await startPayment(orderId)).body.data;
    cfPay(cashfreeOrderId);
    for (let i = 0; i < 3; i++) await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId });
    expect((await prisma.product.findUnique({ where: { id: product.id } })).stockQuantity).toBe(9);
    expect(await prisma.invoice.count({ where: { orderId } })).toBeLessThanOrEqual(1);
    expect(await prisma.order.count()).toBe(1);
  });

  it("failed or unpaid payments never decrement stock", async () => {
    const { orderId, product } = await placeOrder({ quantity: 1 });
    const { cashfreeOrderId } = (await startPayment(orderId)).body.data;
    cfAttempt(cashfreeOrderId, "FAILED");
    await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId });
    expect((await prisma.product.findUnique({ where: { id: product.id } })).stockQuantity).toBe(10);
  });

  it("cannot reach Cashfree: answers with an error and leaves the order pending", async () => {
    const { orderId } = await placeOrder();
    const { cashfreeOrderId } = (await startPayment(orderId)).body.data;
    cf.unreachable = true;
    const res = await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId });
    expect(res.status).toBe(400);
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).toBe("PENDING");
  });
});

describe("POST /api/webhooks/cashfree", () => {
  it("rejects an unsigned request", async () => {
    const res = await request(app).post("/api/webhooks/cashfree").set("Content-Type", "application/json").send("{}");
    expect(res.status).toBe(400);
  });

  it("rejects a wrong signature, a tampered body and a signature made with another secret", async () => {
    const { orderId } = await placeOrder();
    const { cashfreeOrderId } = (await startPayment(orderId)).body.data;
    cfPay(cashfreeOrderId);
    const body = webhookBody("PAYMENT_SUCCESS_WEBHOOK", { orderId: cashfreeOrderId, amount: cf.orders.get(cashfreeOrderId).order_amount });
    const good = signWebhook(body);
    const send = (b, h) => request(app).post("/api/webhooks/cashfree").set("Content-Type", "application/json").set("x-webhook-timestamp", h.timestamp).set("x-webhook-signature", h.signature).send(b);
    expect((await send(body, { ...good, signature: "wrong" })).status).toBe(400);
    expect((await send(body + " ", good)).status).toBe(400); // tampered body
    expect((await send(body, signWebhook(body, undefined, "someone_elses_secret"))).status).toBe(400);
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).toBe("PENDING");
  });

  it("rejects everything when Cashfree is not configured", async () => {
    cf.configured = false;
    const body = webhookBody("PAYMENT_SUCCESS_WEBHOOK", { orderId: "TUS-2026-000001" });
    const { timestamp, signature } = signWebhook(body);
    const res = await request(app).post("/api/webhooks/cashfree").set("Content-Type", "application/json").set("x-webhook-timestamp", timestamp).set("x-webhook-signature", signature).send(body);
    expect(res.status).toBe(400);
  });

  it("finalizes the order on a validly signed PAYMENT_SUCCESS_WEBHOOK that Cashfree's API confirms", async () => {
    const { orderId, product } = await placeOrder({ quantity: 1 });
    const { cashfreeOrderId } = (await startPayment(orderId)).body.data;
    cfPay(cashfreeOrderId);
    const res = await postWebhook("PAYMENT_SUCCESS_WEBHOOK", cashfreeOrderId);
    expect(res.status).toBe(200);
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).toBe("PAID");
    expect((await prisma.product.findUnique({ where: { id: product.id } })).stockQuantity).toBe(9);
  });

  it("does not trust the payload alone: a signed success event for an order Cashfree still shows unpaid stays unpaid", async () => {
    const { orderId } = await placeOrder();
    const { cashfreeOrderId } = (await startPayment(orderId)).body.data;
    const res = await postWebhook("PAYMENT_SUCCESS_WEBHOOK", cashfreeOrderId);
    expect(res.status).toBe(200);
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).not.toBe("PAID");
  });

  it("is idempotent under duplicate delivery (no double stock decrement)", async () => {
    const { orderId, product } = await placeOrder({ quantity: 1 });
    const { cashfreeOrderId } = (await startPayment(orderId)).body.data;
    cfPay(cashfreeOrderId);
    const body = webhookBody("PAYMENT_SUCCESS_WEBHOOK", { orderId: cashfreeOrderId, amount: cf.orders.get(cashfreeOrderId).order_amount });
    const sig = signWebhook(body);
    const send = () => request(app).post("/api/webhooks/cashfree").set("Content-Type", "application/json").set("x-webhook-timestamp", sig.timestamp).set("x-webhook-signature", sig.signature).send(body);
    const first = await send();
    const second = await send();
    expect(first.body.duplicate).toBeUndefined();
    expect(second.body.duplicate).toBe(true);
    expect((await prisma.product.findUnique({ where: { id: product.id } })).stockQuantity).toBe(9);
  });

  it("PAYMENT_FAILED_WEBHOOK and PAYMENT_USER_DROPPED_WEBHOOK mark the payment FAILED without touching stock", async () => {
    const { orderId, product } = await placeOrder({ quantity: 1 });
    const { cashfreeOrderId } = (await startPayment(orderId)).body.data;
    expect((await postWebhook("PAYMENT_FAILED_WEBHOOK", cashfreeOrderId, { status: "FAILED" })).status).toBe(200);
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).toBe("FAILED");
    expect((await prisma.product.findUnique({ where: { id: product.id } })).stockQuantity).toBe(10);

    const second = await placeOrder({ quantity: 1 });
    const s2 = (await startPayment(second.orderId)).body.data;
    expect((await postWebhook("PAYMENT_USER_DROPPED_WEBHOOK", s2.cashfreeOrderId, { status: "USER_DROPPED" })).status).toBe(200);
    expect((await prisma.order.findUnique({ where: { id: second.orderId } })).paymentStatus).toBe("FAILED");
  });

  it("a failed event never downgrades an order that is already paid", async () => {
    const { orderId } = await placeOrder({ quantity: 1 });
    const { cashfreeOrderId } = (await startPayment(orderId)).body.data;
    cfPay(cashfreeOrderId);
    await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId });
    await postWebhook("PAYMENT_FAILED_WEBHOOK", cashfreeOrderId, { status: "FAILED" });
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).toBe("PAID");
  });

  it("acknowledges an unknown order id without error (nothing to retry)", async () => {
    const res = await postWebhook("PAYMENT_SUCCESS_WEBHOOK", "TUS-2026-424242", { amount: 5 });
    expect(res.status).toBe(200);
  });

  it("asks Cashfree to retry (5xx) when it cannot confirm the payment, and processes the retry", async () => {
    const { orderId } = await placeOrder({ quantity: 1 });
    const { cashfreeOrderId } = (await startPayment(orderId)).body.data;
    cfPay(cashfreeOrderId);
    cf.unreachable = true;
    const body = webhookBody("PAYMENT_SUCCESS_WEBHOOK", { orderId: cashfreeOrderId, amount: cf.orders.get(cashfreeOrderId).order_amount });
    const sig = signWebhook(body);
    const send = () => request(app).post("/api/webhooks/cashfree").set("Content-Type", "application/json").set("x-webhook-timestamp", sig.timestamp).set("x-webhook-signature", sig.signature).send(body);
    expect((await send()).status).toBe(500);
    cf.unreachable = false;
    const retry = await send();
    expect(retry.status).toBe(200);
    expect(retry.body.duplicate).toBeUndefined();
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).toBe("PAID");
  });

  it("verify-then-webhook race still only decrements stock once", async () => {
    const { orderId, product } = await placeOrder({ quantity: 1 });
    const { cashfreeOrderId } = (await startPayment(orderId)).body.data;
    cfPay(cashfreeOrderId);
    await Promise.all([request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId }), postWebhook("PAYMENT_SUCCESS_WEBHOOK", cashfreeOrderId)]);
    expect((await prisma.product.findUnique({ where: { id: product.id } })).stockQuantity).toBe(9);
  });
});

describe("retry after a failed payment", () => {
  it("reuses the same live Cashfree order (no second charge path) and never retries a paid order", async () => {
    const { orderId } = await placeOrder();
    const first = (await startPayment(orderId)).body.data;
    cfAttempt(first.cashfreeOrderId, "FAILED");
    await request(app).post("/api/payments/cashfree/verify").send({ cashfreeOrderId: first.cashfreeOrderId });
    const retry = await request(app).post(`/api/orders/${orderId}/payment/retry`);
    expect(retry.status).toBe(200);
    expect(retry.body.data.cashfreeOrderId).toBe(first.cashfreeOrderId);
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).toBe("PENDING");

    cfPay(first.cashfreeOrderId);
    expect((await request(app).post(`/api/orders/${orderId}/payment/retry`)).status).toBe(409);
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).toBe("PAID");
  });
});
