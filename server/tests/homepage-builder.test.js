import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { seedTestAdmin } from "./helpers.js";
import { env } from "../src/config/env.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = createApp();

let adminToken;

beforeAll(async () => {
  await seedTestAdmin();
  const loginRes = await request(app)
    .post("/api/admin/auth/login")
    .send({
      email: env.admin.email,
      password: env.admin.password,
    });

  adminToken = loginRes.body.data.accessToken;
});

describe("Phase C: Homepage Builder & Banners & Promos", () => {
  it("GET /api/pages/home - returns published homepage and enabled sections", async () => {
    const res = await request(app).get("/api/pages/home");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.page).toBeDefined();
    expect(res.body.data.page.slug).toBe("home");
    expect(Array.isArray(res.body.data.sections)).toBe(true);
  });

  it("GET /api/banners - returns active non-expired banners", async () => {
    const res = await request(app).get("/api/banners");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("GET /api/promos - returns active promo messages sorted by order", async () => {
    const res = await request(app).get("/api/promos");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  describe("Admin Homepage API", () => {
    let createdSectionId;

    it("GET /api/admin/pages/home - requires admin auth", async () => {
      const res = await request(app).get("/api/admin/pages/home");
      expect(res.status).toBe(401);
    });

    it("GET /api/admin/pages/home - returns full draft homepage for admin", async () => {
      const res = await request(app)
        .get("/api/admin/pages/home")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe("home");
    });

    it("POST /api/admin/pages/home/sections - creates a new section", async () => {
      const res = await request(app)
        .post("/api/admin/pages/home/sections")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          type: "CTA",
          name: "Test CTA Block",
          settings: { background: "terracotta" },
          content: { title: "Special Offer" },
          isEnabled: true,
          sortOrder: 999,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.type).toBe("CTA");
      createdSectionId = res.body.data.id;
    });

    it("PUT /api/admin/pages/home/sections/:id - updates section details", async () => {
      const res = await request(app)
        .put(`/api/admin/pages/home/sections/${createdSectionId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Updated Test CTA Block",
          isEnabled: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Updated Test CTA Block");
      expect(res.body.data.isEnabled).toBe(false);
    });

    it("POST /api/admin/pages/home/sections/:id/duplicate - duplicates section", async () => {
      const res = await request(app)
        .post(`/api/admin/pages/home/sections/${createdSectionId}/duplicate`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      expect(res.body.data.name).toContain("(Copy)");
    });

    it("DELETE /api/admin/pages/home/sections/:id - deletes section", async () => {
      const res = await request(app)
        .delete(`/api/admin/pages/home/sections/${createdSectionId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it("POST /api/admin/pages/home/publish - publishes draft homepage", async () => {
      const res = await request(app)
        .post("/api/admin/pages/home/publish")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("PUBLISHED");
    });
  });

  describe("Admin Banner CRUD & Scheduling", () => {
    let createdBannerId;

    it("POST /api/admin/banners - creates new banner", async () => {
      const res = await request(app)
        .post("/api/admin/banners")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Test Winter Sale Banner",
          placement: "HOME_HERO",
          desktopImage: "https://example.com/banner.jpg",
          title: "Winter Festival",
          isActive: true,
          sortOrder: 1,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      createdBannerId = res.body.data.id;
    });

    it("GET /api/banners - filters out inactive or expired banners", async () => {
      await prisma.banner.create({
        data: {
          name: "Expired Banner",
          title: "Expired Banner Title",
          placement: "HOME_HERO",
          desktopImage: "https://example.com/expired.jpg",
          endDate: new Date(Date.now() - 3600 * 1000), // 1 hour ago
          isActive: true,
        },
      });

      const res = await request(app).get("/api/banners?placement=HOME_HERO");
      expect(res.status).toBe(200);
      const names = res.body.data.map((b) => b.name);
      expect(names).not.toContain("Expired Banner");
    });

    it("DELETE /api/admin/banners/:id - deletes banner", async () => {
      const res = await request(app)
        .delete(`/api/admin/banners/${createdBannerId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe("Admin Promo Ticker CRUD", () => {
    let createdPromoId;

    it("POST /api/admin/promos - creates promo message", async () => {
      const res = await request(app)
        .post("/api/admin/promos")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          message: "Free Express Shipping on Orders Above ₹2,499",
          couponCode: "FREESHIP",
          isActive: true,
          sortOrder: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      createdPromoId = res.body.data.id;
    });

    it("DELETE /api/admin/promos/:id - deletes promo message", async () => {
      const res = await request(app)
        .delete(`/api/admin/promos/${createdPromoId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });
});
