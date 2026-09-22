import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb, seedTestProduct, seedTestAdmin, VALID_CUSTOMER, VALID_ADDRESS } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
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
      shippingAddress: overrides.address || VALID_ADDRESS,
      items: overrides.items || [{ slug: product.slug, quantity: 2 }],
    });
  return { res, product };
}

describe("order creation", () => {
  it("creates an order with a human-friendly, year-prefixed order number", async () => {
    const { res } = await placeOrder();
    expect(res.status).toBe(201);
    expect(res.body.data.orderNumber).toMatch(/^AAD-\d{4}-\d{6}$/);
    expect(res.body.data.accessToken).toHaveLength(48);
  });

  it("snapshots product name/slug/sku/price/type onto OrderItem, independent of later product edits", async () => {
    const { res, product } = await placeOrder();
    const order = await prisma.order.findUnique({ where: { id: res.body.data.orderId }, include: { items: true } });
    const item = order.items[0];
    expect(item.productNameSnapshot).toBe(product.name);
    expect(item.productSlugSnapshot).toBe(product.slug);
    expect(Number(item.unitPrice)).toBe(500);
    expect(item.productTypeSnapshot).toBe("PHYSICAL");

    // Now change the live product — the historical order must not move.
    await prisma.product.update({ where: { id: product.id }, data: { name: "Renamed Later", price: 999 } });
    const reloaded = await prisma.orderItem.findUnique({ where: { id: item.id } });
    expect(reloaded.productNameSnapshot).toBe(product.name);
    expect(Number(reloaded.unitPrice)).toBe(500);
  });

  it("computes totals authoritatively (subtotal + shipping), ignoring any client total", async () => {
    const { res } = await placeOrder();
    expect(Number(res.body.data.totalAmount)).toBe(1000 + env.shipping.standardAmount);
  });

  it("generates unique order numbers under concurrent creation (no count()+1 collisions)", async () => {
    const product = await seedTestProduct({ price: 100, stockQuantity: 100 });
    const requests = Array.from({ length: 8 }, () =>
      request(app)
        .post("/api/orders")
        .send({ customer: VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items: [{ slug: product.slug, quantity: 1 }] })
    );
    const results = await Promise.all(requests);
    const orderNumbers = results.map((r) => r.body.data.orderNumber);
    expect(new Set(orderNumbers).size).toBe(orderNumbers.length);
    orderNumbers.forEach((n) => expect(n).toMatch(/^AAD-\d{4}-\d{6}$/));
  });

  it("does NOT decrement stock at order-creation time — only after payment", async () => {
    const product = await seedTestProduct({ price: 100, stockQuantity: 5 });
    await placeOrder({ product, items: [{ slug: product.slug, quantity: 3 }] });
    const reloaded = await prisma.product.findUnique({ where: { id: product.id } });
    expect(reloaded.stockQuantity).toBe(5);
  });
});

describe("order confirmation access token", () => {
  it("returns order details for the correct token", async () => {
    const { res } = await placeOrder();
    const confirm = await request(app).get(
      `/api/orders/${res.body.data.orderNumber}/confirmation?token=${res.body.data.accessToken}`
    );
    expect(confirm.status).toBe(200);
    expect(confirm.body.data.orderNumber).toBe(res.body.data.orderNumber);
    expect(confirm.body.data.accessTokenHash).toBeUndefined();
  });

  it("rejects a well-formed but wrong token with the same response as not-found", async () => {
    const { res } = await placeOrder();
    const wrongToken = "0".repeat(48);
    const confirm = await request(app).get(`/api/orders/${res.body.data.orderNumber}/confirmation?token=${wrongToken}`);
    expect(confirm.status).toBe(404);
  });

  it("rejects a malformed token", async () => {
    const { res } = await placeOrder();
    const confirm = await request(app).get(`/api/orders/${res.body.data.orderNumber}/confirmation?token=short`);
    expect(confirm.status).toBe(400);
  });

  it("does not leak one customer's order to a guessed order number without the token", async () => {
    const { res } = await placeOrder();
    const confirm = await request(app).get(`/api/orders/${res.body.data.orderNumber}/confirmation`);
    expect(confirm.status).toBe(400); // token query param itself is required
  });
});

describe("guest order tracking", () => {
  it("returns the order for a matching order number + email", async () => {
    const { res } = await placeOrder();
    const track = await request(app)
      .post("/api/orders/track")
      .send({ orderNumber: res.body.data.orderNumber, email: VALID_CUSTOMER.email });
    expect(track.status).toBe(200);
    expect(track.body.data.orderNumber).toBe(res.body.data.orderNumber);
  });

  it("rejects a mismatched email with a generic not-found message", async () => {
    const { res } = await placeOrder();
    const track = await request(app)
      .post("/api/orders/track")
      .send({ orderNumber: res.body.data.orderNumber, email: "someoneelse@example.com" });
    expect(track.status).toBe(404);
  });

  it("rejects an unknown order number with the same generic message", async () => {
    const track = await request(app)
      .post("/api/orders/track")
      .send({ orderNumber: "AAD-2026-999999", email: VALID_CUSTOMER.email });
    expect(track.status).toBe(404);
  });
});

describe("admin orders", () => {
  async function getAdminToken() {
    await seedTestAdmin();
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({ email: env.admin.email, password: env.admin.password });
    return res.body.data.accessToken;
  }

  it("lists orders for admin", async () => {
    await placeOrder();
    const token = await getAdminToken();
    const res = await request(app).get("/api/admin/orders").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("rejects the admin order list without auth", async () => {
    const res = await request(app).get("/api/admin/orders");
    expect(res.status).toBe(401);
  });

  it("allows admin to move an order through operational statuses", async () => {
    const { res } = await placeOrder();
    const token = await getAdminToken();
    const update = await request(app)
      .patch(`/api/admin/orders/${res.body.data.orderId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "PROCESSING" });
    expect(update.status).toBe(200);
    expect(update.body.data.status).toBe("PROCESSING");
    expect(update.body.data.paymentStatus).toBe("PENDING"); // untouched
  });

  it("cannot manually mark an order's payment as PAID via the status endpoint", async () => {
    const { res } = await placeOrder();
    const token = await getAdminToken();
    const update = await request(app)
      .patch(`/api/admin/orders/${res.body.data.orderId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "PROCESSING", paymentStatus: "PAID" });

    expect(update.status).toBe(200);
    const order = await prisma.order.findUnique({ where: { id: res.body.data.orderId } });
    expect(order.paymentStatus).toBe("PENDING"); // the extra field is simply ignored
  });

  it("rejects PENDING as a manual status transition (not a valid target)", async () => {
    const { res } = await placeOrder();
    const token = await getAdminToken();
    const update = await request(app)
      .patch(`/api/admin/orders/${res.body.data.orderId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "PENDING" });
    expect(update.status).toBe(400);
  });
});
