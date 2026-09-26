import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { resetDb, seedTestAdmin, seedTestProduct } from "./helpers.js";

const app = createApp();
const request = supertest(app);

describe("Phase F — Dynamic Storefront & Store Settings Integration", () => {
  let adminToken;

  beforeEach(async () => {
    await resetDb();
    await seedTestAdmin({ email: "admin@test.local", password: "TestPassword123!" });
    const loginRes = await request.post("/api/admin/auth/login").send({
      email: "admin@test.local",
      password: "TestPassword123!",
    });
    adminToken = loginRes.body.data.accessToken;
  });

  describe("Public & Admin Settings APIs", () => {
    it("GET /api/settings returns merged site settings with defaults", async () => {
      const res = await request.get("/api/settings");
      expect(res.status).toBe(200);
      expect(res.body.data.general).toBeDefined();
      expect(res.body.data.general.storeName).toBe("Aadya");
      expect(res.body.data.shipping.freeShippingThreshold).toBe(2499);
      expect(res.body.data.payments.razorpayEnabled).toBe(true);
      expect(res.body.data.appearance.colors.primary).toBe("#B8674A");
    });

    it("PUT /api/admin/settings requires admin auth", async () => {
      const res = await request.put("/api/admin/settings").send({
        general: { storeName: "Unauthenticated Test" },
      });
      expect(res.status).toBe(401);
    });

    it("PUT /api/admin/settings validates color hex formats and updates settings", async () => {
      // Invalid hex code should fail validation
      const failRes = await request
        .put("/api/admin/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          appearance: {
            colors: { primary: "not-a-color" },
          },
        });
      expect(failRes.status).toBe(400);

      // Valid update
      const updateRes = await request
        .put("/api/admin/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          general: { storeName: "Aadya Living Edit" },
          shipping: { freeShippingThreshold: 5000, standardShippingAmount: 200 },
          appearance: {
            colors: { primary: "#CC5533" },
          },
        });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.general.storeName).toBe("Aadya Living Edit");
      expect(updateRes.body.data.shipping.freeShippingThreshold).toBe(5000);
      expect(updateRes.body.data.appearance.colors.primary).toBe("#CC5533");
    });

    it("POST /api/admin/settings/reset-appearance restores appearance to Aadya defaults", async () => {
      // Custom color
      await request
        .put("/api/admin/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          appearance: { colors: { primary: "#000000" } },
        });

      // Reset appearance
      const resetRes = await request
        .post("/api/admin/settings/reset-appearance")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resetRes.status).toBe(200);
      expect(resetRes.body.data.appearance.colors.primary).toBe("#B8674A");
    });
  });

  describe("Dynamic Shipping Threshold Enforcement", () => {
    it("uses updated free shipping threshold in checkout preview calculations", async () => {
      const p = await seedTestProduct({ price: 3000 });

      // Update free shipping threshold to ₹5,000 (so ₹3,000 order gets charged standard shipping ₹150)
      await request
        .put("/api/admin/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          shipping: { freeShippingThreshold: 5000, standardShippingAmount: 150 },
        });

      const previewRes = await request
        .post("/api/checkout/preview")
        .send({ items: [{ slug: p.slug, quantity: 1 }] });

      expect(previewRes.status).toBe(200);
      expect(previewRes.body.data.subtotal).toBe(3000);
      expect(previewRes.body.data.shipping).toBe(150);
      expect(previewRes.body.data.total).toBe(3150);
    });
  });

  describe("Payment Gateway Server-Side Enforcement", () => {
    it("rejects COD orders when Cash on Delivery is disabled in settings", async () => {
      const p = await seedTestProduct({ price: 1000 });

      // Disable COD
      await request
        .put("/api/admin/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          payments: { codEnabled: false, razorpayEnabled: true },
        });

      const orderRes = await request
        .post("/api/orders")
        .send({
          customer: { name: "Test User", email: "test@example.com", phone: "9876543210" },
          shippingAddress: {
            fullName: "Test User",
            phone: "9876543210",
            addressLine1: "123 Main St",
            city: "Bengaluru",
            state: "Karnataka",
            postalCode: "560001",
          },
          items: [{ slug: p.slug, quantity: 1 }],
          paymentMethod: "cod",
        });

      expect(orderRes.status).toBe(400);
      expect(orderRes.body.error.message).toContain("Cash on Delivery is currently disabled");
    });

    it("rejects Razorpay payment order creation when Razorpay is disabled in settings", async () => {
      const p = await seedTestProduct({ price: 1000 });

      // First create order when Razorpay enabled
      const orderRes = await request
        .post("/api/orders")
        .send({
          customer: { name: "Test User", email: "test@example.com", phone: "9876543210" },
          shippingAddress: {
            fullName: "Test User",
            phone: "9876543210",
            addressLine1: "123 Main St",
            city: "Bengaluru",
            state: "Karnataka",
            postalCode: "560001",
          },
          items: [{ slug: p.slug, quantity: 1 }],
          paymentMethod: "razorpay",
        });
      expect(orderRes.status).toBe(201);
      const orderId = orderRes.body.data.orderId;

      // Disable Razorpay
      await request
        .put("/api/admin/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          payments: { razorpayEnabled: false, codEnabled: true },
        });

      // Attempting to create Razorpay payment order should fail
      const payRes = await request.post(`/api/orders/${orderId}/payment`);
      expect(payRes.status).toBe(400);
      expect(payRes.body.error.message).toContain("Online payment via Razorpay is currently disabled");
    });
  });
});
