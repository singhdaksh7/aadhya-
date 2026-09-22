import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { resetDb, registerCustomer, seedTestProduct, VALID_ADDRESS } from "./helpers.js";

const app = createApp();

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

async function createGuestOrder(email = "guest@test.local") {
  const product = await seedTestProduct({ slug: "claim-product", stockQuantity: 10 });
  const res = await request(app)
    .post("/api/orders")
    .send({
      items: [{ slug: product.slug, quantity: 1 }],
      customer: { name: "Guest Buyer", email, phone: "9876543210" },
      shippingAddress: VALID_ADDRESS,
    });
  expect(res.status).toBe(201);
  return { orderNumber: res.body.data.orderNumber, accessToken: res.body.data.accessToken };
}

describe("guest order claiming", () => {
  it("claims a guest order with a matching email and valid token, and it appears in account orders", async () => {
    const { orderNumber, accessToken: orderToken } = await createGuestOrder("shared@test.local");
    const { accessToken } = await registerCustomer(app, { email: "shared@test.local" });
    const claim = await request(app)
      .post("/api/account/claim-order")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderNumber, accessToken: orderToken });
    expect(claim.status).toBe(200);
    expect(claim.body.data.claimed).toBe(true);

    const list = await request(app).get("/api/account/orders").set("Authorization", `Bearer ${accessToken}`);
    expect(list.body.data.map((o) => o.orderNumber)).toContain(orderNumber);
  });

  it("rejects a wrong token with a generic not-found", async () => {
    const { orderNumber } = await createGuestOrder("shared@test.local");
    const { accessToken } = await registerCustomer(app, { email: "shared@test.local" });
    const claim = await request(app)
      .post("/api/account/claim-order")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderNumber, accessToken: "0".repeat(48) });
    expect(claim.status).toBe(404);
  });

  it("rejects claiming when the logged-in account's email does not match the order", async () => {
    const { orderNumber, accessToken: orderToken } = await createGuestOrder("original@test.local");
    const { accessToken } = await registerCustomer(app, { email: "different@test.local" });
    const claim = await request(app)
      .post("/api/account/claim-order")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderNumber, accessToken: orderToken });
    expect(claim.status).toBe(403);
  });

  it("rejects an unknown order number", async () => {
    const { accessToken } = await registerCustomer(app, { email: "shared@test.local" });
    const claim = await request(app)
      .post("/api/account/claim-order")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderNumber: "AAD-2099-999999", accessToken: "0".repeat(48) });
    expect(claim.status).toBe(404);
  });

  it("rejects a second, different customer trying to claim an order already linked to someone else, without revealing who owns it", async () => {
    const { orderNumber, accessToken: orderToken } = await createGuestOrder("shared@test.local");
    const first = await registerCustomer(app, { email: "shared@test.local" });
    await request(app)
      .post("/api/account/claim-order")
      .set("Authorization", `Bearer ${first.accessToken}`)
      .send({ orderNumber, accessToken: orderToken });

    const second = await registerCustomer(app, { email: "someone-else@test.local" });
    const claim = await request(app)
      .post("/api/account/claim-order")
      .set("Authorization", `Bearer ${second.accessToken}`)
      .send({ orderNumber, accessToken: orderToken });
    expect(claim.status).toBe(409);
    const body = JSON.stringify(claim.body);
    expect(body).not.toContain("shared@test.local");
    expect(body).not.toContain(first.customer.id);
  });

  it("is idempotent when the same customer claims their own already-claimed order again", async () => {
    const { orderNumber, accessToken: orderToken } = await createGuestOrder("shared@test.local");
    const { accessToken } = await registerCustomer(app, { email: "shared@test.local" });
    const firstClaim = await request(app)
      .post("/api/account/claim-order")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderNumber, accessToken: orderToken });
    expect(firstClaim.status).toBe(200);
    const secondClaim = await request(app)
      .post("/api/account/claim-order")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderNumber, accessToken: orderToken });
    expect(secondClaim.status).toBe(200);
  });

  it("requires authentication to claim", async () => {
    const { orderNumber, accessToken: orderToken } = await createGuestOrder();
    const res = await request(app).post("/api/account/claim-order").send({ orderNumber, accessToken: orderToken });
    expect(res.status).toBe(401);
  });
});

describe("order ownership isolation between customers", () => {
  it("customer A only sees their own orders in the account order list", async () => {
    const a = await registerCustomer(app, { email: "a@test.local" });
    const b = await registerCustomer(app, { email: "b@test.local" });
    const product = await seedTestProduct({ slug: "own-product", stockQuantity: 10 });
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ items: [{ slug: product.slug, quantity: 1 }], customer: { name: "A", email: "a@test.local", phone: "9876543210" }, shippingAddress: VALID_ADDRESS });

    const aList = await request(app).get("/api/account/orders").set("Authorization", `Bearer ${a.accessToken}`);
    const bList = await request(app).get("/api/account/orders").set("Authorization", `Bearer ${b.accessToken}`);
    expect(aList.body.data).toHaveLength(1);
    expect(bList.body.data).toHaveLength(0);
  });

  it("customer B cannot fetch customer A's order detail by order number", async () => {
    const a = await registerCustomer(app, { email: "a@test.local" });
    const b = await registerCustomer(app, { email: "b@test.local" });
    const product = await seedTestProduct({ slug: "own-product-2", stockQuantity: 10 });
    const order = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({ items: [{ slug: product.slug, quantity: 1 }], customer: { name: "A", email: "a@test.local", phone: "9876543210" }, shippingAddress: VALID_ADDRESS });

    const res = await request(app)
      .get(`/api/account/orders/${order.body.data.orderNumber}`)
      .set("Authorization", `Bearer ${b.accessToken}`);
    expect(res.status).toBe(404);
  });

  it("an authenticated checkout attaches the real logged-in customerId regardless of any body content, and ignores an attempted customerId override", async () => {
    const a = await registerCustomer(app, { email: "a@test.local" });
    const b = await registerCustomer(app, { email: "b@test.local" });
    const product = await seedTestProduct({ slug: "ownership-product", stockQuantity: 10 });
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${a.accessToken}`)
      .send({
        items: [{ slug: product.slug, quantity: 1 }],
        customer: { name: "A", email: "a@test.local", phone: "9876543210" },
        shippingAddress: VALID_ADDRESS,
        customerId: b.customer.id, // not part of the schema — must be ignored
      });
    expect(res.status).toBe(201);
    const order = await prisma.order.findUnique({ where: { orderNumber: res.body.data.orderNumber } });
    expect(order.customerId).toBe(a.customer.id);
    expect(order.customerId).not.toBe(b.customer.id);
  });

  it("a guest checkout leaves customerId null", async () => {
    const product = await seedTestProduct({ slug: "guest-product", stockQuantity: 10 });
    const res = await request(app)
      .post("/api/orders")
      .send({ items: [{ slug: product.slug, quantity: 1 }], customer: { name: "Guest", email: "guest2@test.local", phone: "9876543210" }, shippingAddress: VALID_ADDRESS });
    const order = await prisma.order.findUnique({ where: { orderNumber: res.body.data.orderNumber } });
    expect(order.customerId).toBeNull();
  });

  it("a request bearing an expired/garbage Bearer token on the guest checkout endpoint is rejected outright rather than silently falling back to guest", async () => {
    const product = await seedTestProduct({ slug: "bad-token-product", stockQuantity: 10 });
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer not-a-real-token")
      .send({ items: [{ slug: product.slug, quantity: 1 }], customer: { name: "Guest", email: "guest3@test.local", phone: "9876543210" }, shippingAddress: VALID_ADDRESS });
    expect(res.status).toBe(401);
  });
});
