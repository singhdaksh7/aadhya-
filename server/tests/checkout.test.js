import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb, seedTestProduct, VALID_CUSTOMER, VALID_ADDRESS } from "./helpers.js";
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

describe("checkout preview", () => {
  it("prices items from the database, never from the client", async () => {
    const product = await seedTestProduct({ price: 500 });

    const res = await request(app)
      .post("/api/checkout/preview")
      .send({ items: [{ slug: product.slug, quantity: 2, price: 1 }] });

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].unitPrice).toBe(500);
    expect(res.body.data.items[0].lineTotal).toBe(1000);
    expect(res.body.data.subtotal).toBe(1000);
  });

  it("applies free shipping at/above the configured threshold", async () => {
    const product = await seedTestProduct({ price: env.shipping.freeThreshold });

    const res = await request(app)
      .post("/api/checkout/preview")
      .send({ items: [{ slug: product.slug, quantity: 1 }] });

    expect(res.body.data.shipping).toBe(0);
    expect(res.body.data.total).toBe(env.shipping.freeThreshold);
  });

  it("charges standard shipping below the threshold", async () => {
    const product = await seedTestProduct({ price: env.shipping.freeThreshold - 100 });

    const res = await request(app)
      .post("/api/checkout/preview")
      .send({ items: [{ slug: product.slug, quantity: 1 }] });

    expect(res.body.data.shipping).toBe(env.shipping.standardAmount);
  });

  it("flags an inactive product instead of pricing it", async () => {
    const product = await seedTestProduct({ isActive: false });

    const res = await request(app)
      .post("/api/checkout/preview")
      .send({ items: [{ slug: product.slug, quantity: 1 }] });

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].ok).toBe(false);
    expect(res.body.data.items[0].issue).toBe("unavailable");
    expect(res.body.data.hasBlockingIssues).toBe(true);
  });

  it("flags an out-of-stock product", async () => {
    const product = await seedTestProduct({ stockQuantity: 0 });

    const res = await request(app)
      .post("/api/checkout/preview")
      .send({ items: [{ slug: product.slug, quantity: 1 }] });

    expect(res.body.data.items[0].ok).toBe(false);
    expect(res.body.data.items[0].issue).toBe("out_of_stock");
  });

  it("clamps quantity to available stock and flags it", async () => {
    const product = await seedTestProduct({ stockQuantity: 2 });

    const res = await request(app)
      .post("/api/checkout/preview")
      .send({ items: [{ slug: product.slug, quantity: 5 }] });

    expect(res.body.data.items[0].ok).toBe(true);
    expect(res.body.data.items[0].quantity).toBe(2);
    expect(res.body.data.items[0].issue).toBe("stock_limited");
  });

  it("rejects an empty cart", async () => {
    const res = await request(app).post("/api/checkout/preview").send({ items: [] });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/orders — order creation validation", () => {
  it("refuses to create an order containing an inactive product", async () => {
    const product = await seedTestProduct({ isActive: false });

    const res = await request(app)
      .post("/api/orders")
      .send({
        customer: VALID_CUSTOMER,
        shippingAddress: VALID_ADDRESS,
        items: [{ slug: product.slug, quantity: 1 }],
      });

    expect(res.status).toBe(400);
  });

  it("refuses to create an order for an out-of-stock product", async () => {
    const product = await seedTestProduct({ stockQuantity: 0 });

    const res = await request(app)
      .post("/api/orders")
      .send({
        customer: VALID_CUSTOMER,
        shippingAddress: VALID_ADDRESS,
        items: [{ slug: product.slug, quantity: 1 }],
      });

    expect(res.status).toBe(400);
  });

  it("rejects an invalid Indian phone number", async () => {
    const product = await seedTestProduct();
    const res = await request(app)
      .post("/api/orders")
      .send({
        customer: { ...VALID_CUSTOMER, phone: "12345" },
        shippingAddress: VALID_ADDRESS,
        items: [{ slug: product.slug, quantity: 1 }],
      });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid PIN code", async () => {
    const product = await seedTestProduct();
    const res = await request(app)
      .post("/api/orders")
      .send({
        customer: VALID_CUSTOMER,
        shippingAddress: { ...VALID_ADDRESS, postalCode: "12" },
        items: [{ slug: product.slug, quantity: 1 }],
      });
    expect(res.status).toBe(400);
  });
});
