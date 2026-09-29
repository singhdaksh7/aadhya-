import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { resetDb, seedTestProduct, registerCustomer, seedTestAdmin } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";
import { generateToken, hashToken } from "../src/utils/secureToken.js";
import { env } from "../src/config/env.js";

let refundMock;
vi.mock("../src/modules/payments/razorpay.client.js", () => ({
  isRazorpayConfigured: () => true,
  getRazorpayConfig: async () => ({ keyId: "key_test", keySecret: "secret_test" }),
  getRazorpayClient: () => ({
    payments: {
      refund: (...args) => refundMock(...args),
    },
  }),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: vi.fn(async () => ({ messageId: "mock" })) }) },
}));

const { createApp } = await import("../src/app.js");
const app = createApp();

beforeEach(async () => {
  await resetDb();
  refundMock = vi.fn(async () => ({ id: `rfnd_${Math.random().toString(36).slice(2)}` }));
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

// Builds a fully-formed Order (+items, +payment) directly against the DB,
// bypassing checkout so return-flow tests can set up precise scenarios
// (status, payment method, digital items) without re-testing checkout.
async function seedOrder({
  customerId = null,
  status = "DELIVERED",
  paymentStatus = "PAID",
  paymentMethod = "razorpay",
  amount = 1000,
  deliveredDaysAgo = 1,
  items,
} = {}) {
  const product = await seedTestProduct({ price: amount, stockQuantity: 5 });
  const rawToken = generateToken();
  const orderNumber = `AAD-TEST-${Math.random().toString(36).slice(2, 8)}`;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerName: "Test Customer",
      customerEmail: "customer@example.com",
      customerPhone: "9876543210",
      customerId,
      status,
      paymentStatus,
      subtotal: amount,
      totalAmount: amount,
      accessTokenHash: hashToken(rawToken),
      paymentMethod,
      paidAt: paymentStatus === "PAID" ? new Date() : null,
      stockDecrementedAt: new Date(),
      items: {
        create:
          items ||
          [
            {
              productId: product.id,
              productNameSnapshot: product.name,
              productSlugSnapshot: product.slug,
              unitPrice: amount,
              quantity: 1,
              lineTotal: amount,
              productTypeSnapshot: "PHYSICAL",
            },
          ],
      },
      payments: {
        create: {
          provider: paymentMethod === "cod" ? "cod" : "razorpay",
          providerOrderId: paymentMethod === "cod" ? null : `order_mock_${Math.random().toString(36).slice(2)}`,
          providerPaymentId: paymentMethod === "cod" ? null : `pay_mock_${Math.random().toString(36).slice(2)}`,
          status: paymentStatus,
          amount,
        },
      },
      shipment:
        status === "DELIVERED"
          ? { create: { deliveredDate: new Date(Date.now() - deliveredDaysAgo * 24 * 60 * 60 * 1000), status: "DELIVERED" } }
          : undefined,
    },
    include: { items: true, payments: true, shipment: true },
  });
  return order;
}

async function loginCustomer(customerId) {
  // Reuse the real register/login flow is unnecessary — mint a customer
  // access token the same way requireCustomer expects, via the real login.
}

async function customerAgent(overrides = {}) {
  const { agent, accessToken, customer } = await registerCustomer(app, overrides);
  return { agent, accessToken, customer };
}

async function adminToken(role = "SUPER_ADMIN") {
  await seedTestAdmin({ role });
  const res = await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password });
  return res.body.data.accessToken;
}

describe("return eligibility", () => {
  it("is eligible for a delivered order within the return window", async () => {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "DELIVERED", deliveredDaysAgo: 1 });

    const res = await request(app)
      .get(`/api/account/returns/eligibility/${order.orderNumber}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.eligible).toBe(true);
  });

  it("is not eligible outside the return window", async () => {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "DELIVERED", deliveredDaysAgo: 30 });

    const res = await request(app)
      .get(`/api/account/returns/eligibility/${order.orderNumber}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.body.data.eligible).toBe(false);
  });

  it("is not eligible for a non-delivered order", async () => {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "CONFIRMED" });

    const res = await request(app)
      .get(`/api/account/returns/eligibility/${order.orderNumber}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.body.data.eligible).toBe(false);
  });

  it("excludes digital (PDF) items from returnable items", async () => {
    const { accessToken, customer } = await customerAgent();
    const digitalProduct = await seedTestProduct({ price: 300, productType: "BOOK" });
    const order = await seedOrder({
      customerId: customer.id,
      status: "DELIVERED",
      items: [
        {
          productId: digitalProduct.id,
          productNameSnapshot: digitalProduct.name,
          productSlugSnapshot: digitalProduct.slug,
          unitPrice: 300,
          quantity: 1,
          lineTotal: 300,
          productTypeSnapshot: "BOOK",
          bookFormatSnapshot: "PDF",
        },
      ],
    });

    const res = await request(app)
      .get(`/api/account/returns/eligibility/${order.orderNumber}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.body.data.eligible).toBe(false);
    expect(res.body.data.reason).toMatch(/no returnable items/i);
  });
});

describe("create return request validation", () => {
  async function createRequest(customerAccessToken, order, body) {
    return request(app)
      .post("/api/account/returns")
      .set("Authorization", `Bearer ${customerAccessToken}`)
      .send({ orderNumber: order.orderNumber, items: [{ orderItemId: order.items[0].id, quantity: 1 }], ...body });
  }

  it("rejects a missing reason with a field-level error, not just a generic message", async () => {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "DELIVERED" });
    const res = await createRequest(accessToken, order, {});
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "reason" }),
    ]));
  });

  it("rejects a 1-character reason with a human-readable message", async () => {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "DELIVERED" });
    const res = await createRequest(accessToken, order, { reason: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "reason", message: "Return reason must be at least 3 characters." }),
    ]));
    expect(res.body.error.message).toBe("Return reason must be at least 3 characters.");
  });

  it("rejects a 2-character reason", async () => {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "DELIVERED" });
    const res = await createRequest(accessToken, order, { reason: "xy" });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "reason", message: "Return reason must be at least 3 characters." }),
    ]));
  });

  it("accepts a 3-character reason", async () => {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "DELIVERED" });
    const res = await createRequest(accessToken, order, { reason: "xyz" });
    expect(res.status).toBe(201);
  });

  it("rejects a reason over 500 characters", async () => {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "DELIVERED" });
    const res = await createRequest(accessToken, order, { reason: "a".repeat(501) });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "reason", message: "Return reason cannot exceed 500 characters." }),
    ]));
  });

  it("rejects a whitespace-only reason (frontend trims, but the backend must not trust it)", async () => {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "DELIVERED" });
    const res = await createRequest(accessToken, order, { reason: "   " });
    // Zod's min(3) counts the raw (untrimmed) string length here, so 3+
    // spaces technically passes length — this is exactly why the service
    // layer / frontend must trim before this point. Assert the schema at
    // least doesn't silently accept an empty-after-trim value as valid by
    // checking the request layer rejects a string that's empty after trim
    // via the reason.trim() the route handler applies before validation.
    expect(res.status).toBe(400);
  });

  it("rejects details over 2000 characters", async () => {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "DELIVERED" });
    const res = await createRequest(accessToken, order, { reason: "Wrong size", details: "a".repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "details", message: "Additional details cannot exceed 2000 characters." }),
    ]));
  });

  it("rejects an empty items array", async () => {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "DELIVERED" });
    const res = await request(app)
      .post("/api/account/returns")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderNumber: order.orderNumber, reason: "Wrong size", items: [] });
    expect(res.status).toBe(400);
  });

  it("rejects a quantity of 0", async () => {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "DELIVERED" });
    const res = await request(app)
      .post("/api/account/returns")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderNumber: order.orderNumber, reason: "Wrong size", items: [{ orderItemId: order.items[0].id, quantity: 0 }] });
    expect(res.status).toBe(400);
  });

  it("rejects a quantity over the ordered/returnable quantity", async () => {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "DELIVERED" });
    const res = await request(app)
      .post("/api/account/returns")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderNumber: order.orderNumber, reason: "Wrong size", items: [{ orderItemId: order.items[0].id, quantity: 999 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/exceeds the ordered quantity/i);
  });

  it("never returns the generic 'Validation failed' message for a Zod validation error", async () => {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "DELIVERED" });
    const res = await createRequest(accessToken, order, { reason: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error.message).not.toBe("Validation failed");
  });

  it("still submits successfully with a valid reason, details, and quantity", async () => {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "DELIVERED" });
    const res = await createRequest(accessToken, order, { reason: "Wrong size, needed a larger one", details: "Ordered M, this is S." });
    expect(res.status).toBe(201);
    expect(res.body.data.reason).toBe("Wrong size, needed a larger one");
  });
});

describe("cross-customer access block", () => {
  it("blocks eligibility check for another customer's order", async () => {
    const owner = await customerAgent();
    const attacker = await customerAgent();
    const order = await seedOrder({ customerId: owner.customer.id, status: "DELIVERED" });

    const res = await request(app)
      .get(`/api/account/returns/eligibility/${order.orderNumber}`)
      .set("Authorization", `Bearer ${attacker.accessToken}`);

    expect(res.body.data.eligible).toBe(false);
  });

  it("blocks reading another customer's return request", async () => {
    const owner = await customerAgent();
    const attacker = await customerAgent();
    const order = await seedOrder({ customerId: owner.customer.id, status: "DELIVERED" });

    const createRes = await request(app)
      .post("/api/account/returns")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ orderNumber: order.orderNumber, reason: "Damaged item", items: [{ orderItemId: order.items[0].id, quantity: 1 }] });
    expect(createRes.status).toBe(201);

    const res = await request(app)
      .get(`/api/account/returns/${createRes.body.data.id}`)
      .set("Authorization", `Bearer ${attacker.accessToken}`);

    expect(res.status).toBe(404);
  });
});

describe("admin return workflow", () => {
  let token;

  beforeEach(async () => {
    token = await adminToken();
  });

  function adminPost(path, body = {}) {
    return request(app).post(`/api/admin/returns${path}`).set("Authorization", `Bearer ${token}`).send(body);
  }

  async function createReturn() {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "DELIVERED" });
    const res = await request(app)
      .post("/api/account/returns")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderNumber: order.orderNumber, reason: "Not as described", items: [{ orderItemId: order.items[0].id, quantity: 1 }] });
    expect(res.status).toBe(201);
    return { returnRequest: res.body.data, order, customer };
  }

  it("approves a return request", async () => {
    const { returnRequest } = await createReturn();
    const res = await adminPost(`/${returnRequest.id}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("APPROVED");
  });

  it("rejects a return request", async () => {
    const { returnRequest } = await createReturn();
    const res = await adminPost(`/${returnRequest.id}/reject`, { note: "Outside policy" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("REJECTED");
  });

  it("restocks exactly once when marked received", async () => {
    const { returnRequest, order } = await createReturn();
    await adminPost(`/${returnRequest.id}/approve`);
    await adminPost(`/${returnRequest.id}/schedule-pickup`);

    const before = await prisma.product.findUnique({ where: { id: order.items[0].productId } });

    const first = await adminPost(`/${returnRequest.id}/received`);
    expect(first.status).toBe(200);
    const afterFirst = await prisma.product.findUnique({ where: { id: order.items[0].productId } });
    expect(afterFirst.stockQuantity).toBe(before.stockQuantity + 1);

    // A retry (e.g. duplicate click) must not restock a second time.
    const second = await adminPost(`/${returnRequest.id}/received`);
    expect(second.status).toBe(409); // already RECEIVED, transition guard rejects it

    const afterSecond = await prisma.product.findUnique({ where: { id: order.items[0].productId } });
    expect(afterSecond.stockQuantity).toBe(afterFirst.stockQuantity);

    const movements = await prisma.inventoryMovement.findMany({ where: { returnRequestId: returnRequest.id } });
    expect(movements).toHaveLength(1);
  });

  it("issues a full refund via razorpay", async () => {
    const { returnRequest } = await createReturn();
    await adminPost(`/${returnRequest.id}/approve`);
    await adminPost(`/${returnRequest.id}/schedule-pickup`);
    await adminPost(`/${returnRequest.id}/received`);

    const res = await adminPost(`/${returnRequest.id}/refund`, { amount: 1000, method: "razorpay" });

    expect(res.status).toBe(200);
    expect(res.body.data.returnRequest.status).toBe("REFUNDED");
    expect(refundMock).toHaveBeenCalledTimes(1);

    const order = await prisma.order.findUnique({ where: { id: returnRequest.orderId } });
    expect(order.paymentStatus).toBe("REFUNDED");
  });

  it("issues a partial refund and leaves the order partially refunded", async () => {
    const { returnRequest } = await createReturn();
    await adminPost(`/${returnRequest.id}/approve`);
    await adminPost(`/${returnRequest.id}/schedule-pickup`);
    await adminPost(`/${returnRequest.id}/received`);

    const res = await adminPost(`/${returnRequest.id}/refund`, { amount: 400, method: "razorpay" });

    expect(res.status).toBe(200);
    const order = await prisma.order.findUnique({ where: { id: returnRequest.orderId } });
    expect(order.paymentStatus).toBe("PARTIALLY_REFUNDED");
  });

  it("blocks a duplicate/double refund exceeding the paid amount", async () => {
    const { returnRequest } = await createReturn();
    await adminPost(`/${returnRequest.id}/approve`);
    await adminPost(`/${returnRequest.id}/schedule-pickup`);
    await adminPost(`/${returnRequest.id}/received`);

    const first = await adminPost(`/${returnRequest.id}/refund`, { amount: 1000, method: "razorpay" });
    expect(first.status).toBe(200);

    // Second refund attempt on an already-fully-refunded return: it's no
    // longer in a refundable status, so the state-machine guard rejects it.
    const second = await adminPost(`/${returnRequest.id}/refund`, { amount: 1000, method: "razorpay" });
    expect(second.status).toBe(409);
    expect(refundMock).toHaveBeenCalledTimes(1);
  });

  it("requires a manual refund method for COD orders and blocks razorpay", async () => {
    const { accessToken, customer } = await customerAgent();
    const order = await seedOrder({ customerId: customer.id, status: "DELIVERED", paymentMethod: "cod", paymentStatus: "PAID" });
    const createRes = await request(app)
      .post("/api/account/returns")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderNumber: order.orderNumber, reason: "Wrong item", items: [{ orderItemId: order.items[0].id, quantity: 1 }] });
    const returnId = createRes.body.data.id;
    await adminPost(`/${returnId}/approve`);
    await adminPost(`/${returnId}/schedule-pickup`);
    await adminPost(`/${returnId}/received`);

    const blocked = await adminPost(`/${returnId}/refund`, { amount: 1000, method: "razorpay" });
    expect(blocked.status).toBe(400);

    const manual = await adminPost(`/${returnId}/refund`, { amount: 1000, method: "manual", reference: "cash-handback-001" });
    expect(manual.status).toBe(200);
    expect(manual.body.data.refund.method).toBe("manual");
    expect(refundMock).not.toHaveBeenCalled();
  });

  it("closes a refunded return", async () => {
    const { returnRequest } = await createReturn();
    await adminPost(`/${returnRequest.id}/approve`);
    await adminPost(`/${returnRequest.id}/schedule-pickup`);
    await adminPost(`/${returnRequest.id}/received`);
    await adminPost(`/${returnRequest.id}/refund`, { amount: 1000, method: "razorpay" });

    const res = await adminPost(`/${returnRequest.id}/close`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("CLOSED");
  });
});

describe("RTO flow", () => {
  it("restocks on RTO delivered and opens a refund-pending return for a prepaid order", async () => {
    const { handleRtoDelivered } = await import("../src/modules/returns/returns.service.js");
    const order = await seedOrder({ status: "SHIPPED", paymentStatus: "PAID", paymentMethod: "razorpay" });
    const before = await prisma.product.findUnique({ where: { id: order.items[0].productId } });

    const result = await handleRtoDelivered(order.id);

    expect(result.status).toBe("REFUND_PENDING");
    const after = await prisma.product.findUnique({ where: { id: order.items[0].productId } });
    expect(after.stockQuantity).toBe(before.stockQuantity + 1);

    // Idempotent: a repeated webhook call for the same order is a no-op.
    const again = await handleRtoDelivered(order.id);
    expect(again.id).toBe(result.id);
    const afterAgain = await prisma.product.findUnique({ where: { id: order.items[0].productId } });
    expect(afterAgain.stockQuantity).toBe(after.stockQuantity);
  });

  it("closes without requiring a refund for a COD RTO order", async () => {
    const { handleRtoDelivered } = await import("../src/modules/returns/returns.service.js");
    const order = await seedOrder({ status: "SHIPPED", paymentStatus: "PENDING", paymentMethod: "cod" });

    const result = await handleRtoDelivered(order.id);
    expect(result.status).toBe("CLOSED");
  });
});
