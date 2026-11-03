import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { resetDb, seedTestAdmin } from "./helpers.js";
import { env } from "../src/config/env.js";

const app = createApp();

describe("Bulk Gifting Inquiry API", () => {
  beforeEach(async () => {
    await resetDb();
  });

  const validPayload = {
    name: "Rohan Verma",
    email: "rohan@example.com",
    phone: "+91 98765 43210",
    company: "Acme Corp",
    quantity: 50,
    budget: "₹50,000 - ₹1,00,000",
    occasion: "Diwali Corporate Gifts",
    preferredDate: "2026-11-15",
    location: "New Delhi",
    message: "We need 50 curated brass gift sets with custom packaging.",
  };

  it("submits a valid bulk inquiry and creates database record", async () => {
    const res = await request(app)
      .post("/api/gifting/bulk-inquiry")
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe("Rohan Verma");
    expect(res.body.data.status).toBe("NEW");

    const saved = await prisma.bulkGiftingInquiry.findUnique({
      where: { id: res.body.data.id },
    });
    expect(saved).not.toBeNull();
    expect(saved.email).toBe("rohan@example.com");
    expect(saved.quantity).toBe(50);
  });

  it("validates required fields: email, phone, quantity, occasion, message", async () => {
    // Missing email
    const res1 = await request(app)
      .post("/api/gifting/bulk-inquiry")
      .send({ ...validPayload, email: "invalid-email" });
    expect(res1.status).toBe(400);
    expect(res1.body.success).toBe(false);

    // Invalid phone
    const res2 = await request(app)
      .post("/api/gifting/bulk-inquiry")
      .send({ ...validPayload, phone: "12" });
    expect(res2.status).toBe(400);

    // Negative/Zero quantity
    const res3 = await request(app)
      .post("/api/gifting/bulk-inquiry")
      .send({ ...validPayload, quantity: 0 });
    expect(res3.status).toBe(400);
  });

  it("ignores spam submission when honeypot field is filled", async () => {
    const res = await request(app)
      .post("/api/gifting/bulk-inquiry")
      .send({ ...validPayload, honeypot: "spam bot field" });

    expect(res.status).toBe(201);
    const count = await prisma.bulkGiftingInquiry.count();
    expect(count).toBe(0);
  });

  it("admin can list, search, filter and update inquiry status", async () => {
    // Create an inquiry first
    const inquiry = await prisma.bulkGiftingInquiry.create({
      data: {
        name: "Aarav Sharma",
        email: "aarav@tushaqsa.test",
        phone: "+91 99999 88888",
        quantity: 100,
        occasion: "Wedding Welcome Gifts",
        message: "Need 100 terracotta items.",
        status: "NEW",
      },
    });

    // Mock admin authentication
    await seedTestAdmin();
    const adminToken = (await request(app)
      .post("/api/admin/auth/login")
      .send({ email: env.admin.email, password: env.admin.password })).body.data.accessToken;

    // List
    const listRes = await request(app)
      .get("/api/admin/gifting/bulk-inquiries")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items.length).toBeGreaterThan(0);

    // Filter by status
    const filterRes = await request(app)
      .get("/api/admin/gifting/bulk-inquiries?status=NEW")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(filterRes.status).toBe(200);
    expect(filterRes.body.items[0].status).toBe("NEW");

    // Search
    const searchRes = await request(app)
      .get("/api/admin/gifting/bulk-inquiries?search=Aarav")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.items[0].name).toBe("Aarav Sharma");

    // Update status & notes
    const patchRes = await request(app)
      .patch(`/api/admin/gifting/bulk-inquiries/${inquiry.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "CONTACTED", internalNotes: "Called client on 3 Nov, sent catalogue PDF." });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.status).toBe("CONTACTED");
    expect(patchRes.body.data.internalNotes).toContain("Called client");
  });
});

