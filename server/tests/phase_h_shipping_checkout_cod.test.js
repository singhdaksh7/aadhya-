import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb, seedTestProduct, seedTestAdmin, VALID_CUSTOMER, VALID_ADDRESS } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";
import { canTransition, assertTransition } from "../src/modules/orders/orderStatus.js";
import { checkCodEligibility, computeShippingAmount, findZoneForAddress } from "../src/modules/shipping/shipping.service.js";
import { verifyRazorpaySignature } from "../src/modules/payments/payment.service.js";
import crypto from "node:crypto";

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

async function getAdminToken() {
  await seedTestAdmin();
  const res = await request(app)
    .post("/api/admin/auth/login")
    .send({ email: env.admin.email, password: env.admin.password });
  return res.body.data.accessToken;
}

describe("order status transitions (orderStatus.js)", () => {
  it("allows the happy-path chain", () => {
    expect(canTransition("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "SHIPPED")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED")).toBe(true);
  });

  it("allows CANCELLED from any non-terminal status", () => {
    expect(canTransition("PENDING", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("PROCESSING", "CANCELLED")).toBe(true);
  });

  it("rejects skipping a step", () => {
    expect(canTransition("PENDING", "SHIPPED")).toBe(false);
    expect(canTransition("CONFIRMED", "DELIVERED")).toBe(false);
  });

  it("rejects any transition out of a terminal status", () => {
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
  });

  it("rejects a no-op transition", () => {
    expect(canTransition("PENDING", "PENDING")).toBe(false);
  });

  it("assertTransition throws a 409 ApiError-shaped error on an illegal move", () => {
    expect(() => assertTransition("SHIPPED", "PROCESSING")).toThrowError();
    try {
      assertTransition("SHIPPED", "PROCESSING");
    } catch (err) {
      expect(err.statusCode).toBe(409);
    }
  });
});

describe("shipping zone/rate calculation", () => {
  it("resolves the most specific zone (postal code beats state)", async () => {
    const stateZone = await prisma.shippingZone.create({
      data: { name: "Karnataka", states: ["Karnataka"], postalCodes: [] },
    });
    const pinZone = await prisma.shippingZone.create({
      data: { name: "Bengaluru Metro", states: [], postalCodes: ["560001"] },
    });

    const resolved = await findZoneForAddress({ state: "Karnataka", postalCode: "560001" });
    expect(resolved.id).toBe(pinZone.id);
    void stateZone;
  });

  it("applies a zone's flat rate when subtotal is below its freeAbove threshold", async () => {
    const zone = await prisma.shippingZone.create({
      data: { name: "North Zone", states: ["Delhi"], postalCodes: [] },
    });
    await prisma.shippingRate.create({
      data: { zoneId: zone.id, rate: 120, freeAbove: 3000, deliveryEstimate: "4-6 days" },
    });

    const settings = { shippingEnabled: true, freeShippingThreshold: 2000, standardShippingAmount: 99, deliveryEstimate: "default" };
    const fullZone = await prisma.shippingZone.findUnique({ where: { id: zone.id }, include: { rates: true } });

    const below = computeShippingAmount(1000, settings, fullZone);
    expect(below.amount).toBe(120);
    expect(below.deliveryEstimate).toBe("4-6 days");

    const above = computeShippingAmount(3500, settings, fullZone);
    expect(above.amount).toBe(0);
  });

  it("falls back to the flat settings-driven fee when no zone matches", () => {
    const settings = { shippingEnabled: true, freeShippingThreshold: 2000, standardShippingAmount: 99, deliveryEstimate: "default" };
    const result = computeShippingAmount(500, settings, null);
    expect(result.amount).toBe(99);
  });

  it("charges nothing when shipping is disabled in settings", () => {
    const settings = { shippingEnabled: false, freeShippingThreshold: 2000, standardShippingAmount: 99 };
    expect(computeShippingAmount(500, settings, null).amount).toBe(0);
  });
});

describe("COD eligibility rules (server-authoritative)", () => {
  it("rejects COD when disabled in settings", async () => {
    await prisma.siteSetting.upsert({
      where: { key: "payments" },
      create: { key: "payments", value: { codEnabled: false } },
      update: { value: { codEnabled: false } },
    });
    const result = await checkCodEligibility({ items: [], totalAmount: 500, state: "Karnataka", postalCode: "560001" });
    expect(result.eligible).toBe(false);
  });

  it("rejects COD when the cart has a digital item", async () => {
    await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [] } });
    const result = await checkCodEligibility({
      items: [{ isDigital: true }],
      totalAmount: 500,
      state: "Karnataka",
      postalCode: "560001",
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/digital/i);
  });

  it("rejects COD outside the configured min/max order value", async () => {
    await prisma.siteSetting.upsert({
      where: { key: "payments" },
      create: { key: "payments", value: { codEnabled: true, codMinOrderValue: 100, codMaxOrderValue: 1000 } },
      update: { value: { codEnabled: true, codMinOrderValue: 100, codMaxOrderValue: 1000 } },
    });
    await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [] } });

    const tooLow = await checkCodEligibility({ items: [], totalAmount: 50, state: "Karnataka", postalCode: "560001" });
    expect(tooLow.eligible).toBe(false);

    const tooHigh = await checkCodEligibility({ items: [], totalAmount: 5000, state: "Karnataka", postalCode: "560001" });
    expect(tooHigh.eligible).toBe(false);
  });

  it("rejects COD when the shipping zone is unsupported or doesn't support COD", async () => {
    const noZone = await checkCodEligibility({ items: [], totalAmount: 500, state: "Ladakh", postalCode: "194101" });
    expect(noZone.eligible).toBe(false);

    await prisma.shippingZone.create({ data: { name: "Remote", states: ["Ladakh"], postalCodes: [], codSupported: false } });
    const unsupportedZone = await checkCodEligibility({ items: [], totalAmount: 500, state: "Ladakh", postalCode: "194101" });
    expect(unsupportedZone.eligible).toBe(false);
  });

  it("is eligible when all conditions are satisfied", async () => {
    await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [], codSupported: true } });
    const result = await checkCodEligibility({ items: [{ isDigital: false }], totalAmount: 500, state: "Karnataka", postalCode: "560001" });
    expect(result.eligible).toBe(true);
  });
});

describe("COD order creation end-to-end", () => {
  it("rejects a COD order for a digital-only product even if the client claims otherwise", async () => {
    const product = await seedTestProduct({ price: 500, isDigital: true, stockQuantity: 10 });
    await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [], codSupported: true } });

    const res = await request(app)
      .post("/api/orders")
      .send({
        customer: VALID_CUSTOMER,
        shippingAddress: VALID_ADDRESS,
        items: [{ slug: product.slug, quantity: 1 }],
        paymentMethod: "cod",
      });
    expect(res.status).toBe(400);
  });

  it("creates a COD order, confirms it immediately, and decrements stock exactly once", async () => {
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });
    await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [], codSupported: true } });

    const res = await request(app)
      .post("/api/orders")
      .send({
        customer: VALID_CUSTOMER,
        shippingAddress: VALID_ADDRESS,
        items: [{ slug: product.slug, quantity: 2 }],
        paymentMethod: "cod",
      });
    expect(res.status).toBe(201);

    const order = await prisma.order.findUnique({ where: { id: res.body.data.orderId } });
    expect(order.status).toBe("CONFIRMED");
    expect(order.paymentMethod).toBe("cod");
    expect(order.stockDecrementedAt).not.toBeNull();

    const reloaded = await prisma.product.findUnique({ where: { id: product.id } });
    expect(reloaded.stockQuantity).toBe(8);
  });

  it("rejects a COD order when no shipping zone covers the address (unsupported zone)", async () => {
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });
    // No zone created at all for Karnataka/560001.
    const res = await request(app)
      .post("/api/orders")
      .send({
        customer: VALID_CUSTOMER,
        shippingAddress: VALID_ADDRESS,
        items: [{ slug: product.slug, quantity: 1 }],
        paymentMethod: "cod",
      });
    expect(res.status).toBe(400);
  });
});

describe("billing address handling", () => {
  it("stores a separate billing address when billingSameAsShipping is false", async () => {
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });
    await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [] } });

    const billingAddress = { ...VALID_ADDRESS, addressLine1: "456 Billing Lane", city: "Mumbai", state: "Maharashtra", postalCode: "400001" };
    const res = await request(app)
      .post("/api/orders")
      .send({
        customer: VALID_CUSTOMER,
        shippingAddress: VALID_ADDRESS,
        billingAddress,
        billingSameAsShipping: false,
        items: [{ slug: product.slug, quantity: 1 }],
      });
    expect(res.status).toBe(201);

    const order = await prisma.order.findUnique({ where: { id: res.body.data.orderId }, include: { billingAddress: true } });
    expect(order.billingSameAsShipping).toBe(false);
    expect(order.billingAddress.city).toBe("Mumbai");
  });
});

describe("admin shipment tracking", () => {
  it("lets an admin record carrier/tracking info on an order", async () => {
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });
    const placeRes = await request(app)
      .post("/api/orders")
      .send({ customer: VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items: [{ slug: product.slug, quantity: 1 }] });

    const token = await getAdminToken();
    const shipmentRes = await request(app)
      .put(`/api/admin/orders/${placeRes.body.data.orderId}/shipment`)
      .set("Authorization", `Bearer ${token}`)
      .send({ carrier: "BlueDart", trackingNumber: "BD12345", trackingUrl: "https://track.example/BD12345" });

    expect(shipmentRes.status).toBe(200);
    expect(shipmentRes.body.data.carrier).toBe("BlueDart");

    const shipment = await prisma.shipment.findUnique({ where: { orderId: placeRes.body.data.orderId } });
    expect(shipment.trackingNumber).toBe("BD12345");
  });
});

describe("Razorpay signature verification", () => {
  it("accepts a signature computed with the configured webhook/key secret", () => {
    const orderId = "order_test123";
    const paymentId = "pay_test456";
    const secret = env.razorpay.keySecret || "test-secret-for-signature-check";
    const originalSecret = env.razorpay.keySecret;
    env.razorpay.keySecret = secret;

    const signature = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
    const valid = verifyRazorpaySignature({ razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature });
    expect(valid).toBe(true);

    env.razorpay.keySecret = originalSecret;
  });

  it("rejects a tampered signature", () => {
    const secret = "another-test-secret";
    const originalSecret = env.razorpay.keySecret;
    env.razorpay.keySecret = secret;

    const signature = crypto.createHmac("sha256", secret).update("order_a|pay_a").digest("hex");
    const valid = verifyRazorpaySignature({ razorpayOrderId: "order_a", razorpayPaymentId: "pay_b", razorpaySignature: signature });
    expect(valid).toBe(false);

    env.razorpay.keySecret = originalSecret;
  });
});
