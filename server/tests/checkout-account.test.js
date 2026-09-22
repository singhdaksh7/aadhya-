import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { resetDb, registerCustomer, seedTestProduct, VALID_ADDRESS, VALID_ACCOUNT_ADDRESS } from "./helpers.js";

const app = createApp();

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("saved-address checkout", () => {
  it("succeeds with the caller's own savedAddressId and snapshots it correctly onto the order", async () => {
    const { accessToken, customer } = await registerCustomer(app, { email: "a@test.local" });
    const address = await request(app)
      .post("/api/account/addresses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...VALID_ACCOUNT_ADDRESS, city: "Pune" });
    const product = await seedTestProduct({ slug: "saved-addr-product", stockQuantity: 10 });

    const order = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        items: [{ slug: product.slug, quantity: 1 }],
        customer: { name: customer.name, email: customer.email, phone: "9876543210" },
        shippingAddress: VALID_ADDRESS, // deliberately different — savedAddressId must win
        savedAddressId: address.body.data.id,
      });
    expect(order.status).toBe(201);

    const detail = await request(app)
      .get(`/api/account/orders/${order.body.data.orderNumber}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(detail.body.data.address.city).toBe("Pune");
  });

  it("rejects an unknown savedAddressId", async () => {
    const { accessToken, customer } = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "unknown-addr-product", stockQuantity: 10 });
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        items: [{ slug: product.slug, quantity: 1 }],
        customer: { name: customer.name, email: customer.email, phone: "9876543210" },
        shippingAddress: VALID_ADDRESS,
        savedAddressId: "00000000-0000-0000-0000-000000000000",
      });
    expect(res.status).toBe(404);
  });

  it("rejects a guest checkout attempt that supplies a savedAddressId", async () => {
    const { accessToken } = await registerCustomer(app, { email: "owner@test.local" });
    const address = await request(app)
      .post("/api/account/addresses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(VALID_ACCOUNT_ADDRESS);
    const product = await seedTestProduct({ slug: "guest-saved-addr-product", stockQuantity: 10 });

    const res = await request(app)
      .post("/api/orders")
      // no Authorization header — guest
      .send({
        items: [{ slug: product.slug, quantity: 1 }],
        customer: { name: "Guest", email: "guest@test.local", phone: "9876543210" },
        shippingAddress: VALID_ADDRESS,
        savedAddressId: address.body.data.id,
      });
    expect(res.status).toBe(403);
  });
});

describe("save-new-address at checkout (client-orchestrated: create address, then reference it by id)", () => {
  it("saving a new address during checkout creates it under the customer's account and the order links to it", async () => {
    const { accessToken, customer } = await registerCustomer(app, { email: "a@test.local" });
    const created = await request(app)
      .post("/api/account/addresses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...VALID_ACCOUNT_ADDRESS, label: "Checkout", isDefault: false });
    expect(created.status).toBe(201);

    const product = await seedTestProduct({ slug: "save-new-product", stockQuantity: 10 });
    const order = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        items: [{ slug: product.slug, quantity: 1 }],
        customer: { name: customer.name, email: customer.email, phone: "9876543210" },
        shippingAddress: VALID_ADDRESS,
        savedAddressId: created.body.data.id,
      });
    expect(order.status).toBe(201);

    const addresses = await request(app).get("/api/account/addresses").set("Authorization", `Bearer ${accessToken}`);
    expect(addresses.body.data.map((a) => a.id)).toContain(created.body.data.id);
  });

  it("submitting the exact same address again is not blocked server-side (dedup is client-orchestrated only) — documents current behavior", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const first = await request(app).post("/api/account/addresses").set("Authorization", `Bearer ${accessToken}`).send(VALID_ACCOUNT_ADDRESS);
    const second = await request(app).post("/api/account/addresses").set("Authorization", `Bearer ${accessToken}`).send(VALID_ACCOUNT_ADDRESS);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.id).not.toBe(first.body.data.id);
    const list = await request(app).get("/api/account/addresses").set("Authorization", `Bearer ${accessToken}`);
    expect(list.body.data).toHaveLength(2); // no server-side exact-duplicate protection exists today
  });

  it("checking out without saving an address (no savedAddressId) creates no new Address row", async () => {
    const { accessToken, customer } = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "no-save-product", stockQuantity: 10 });
    await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ items: [{ slug: product.slug, quantity: 1 }], customer: { name: customer.name, email: customer.email, phone: "9876543210" }, shippingAddress: VALID_ADDRESS });
    const addresses = await request(app).get("/api/account/addresses").set("Authorization", `Bearer ${accessToken}`);
    expect(addresses.body.data).toEqual([]);
  });

  it("a guest checkout never creates a Customer Address row", async () => {
    const product = await seedTestProduct({ slug: "guest-no-save-product", stockQuantity: 10 });
    await request(app)
      .post("/api/orders")
      .send({ items: [{ slug: product.slug, quantity: 1 }], customer: { name: "Guest", email: "guest4@test.local", phone: "9876543210" }, shippingAddress: VALID_ADDRESS });
    const count = await prisma.address.count();
    expect(count).toBe(0);
  });
});
