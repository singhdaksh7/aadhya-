import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { seedTestAdmin } from "./helpers.js";

const app = createApp();

describe("Phase G — Reviews, Wishlist & Account Expansion Backend", () => {
  let customerAToken = "";
  let customerAId = "";
  let customerBToken = "";
  let customerBId = "";
  let adminToken = "";
  let adminUserId = "";

  let categoryId = "";
  let productId = "";

  beforeAll(async () => {
    // Seed admin user first
    const adminObj = await seedTestAdmin();
    adminUserId = adminObj.id;

    // Register customer A
    const resA = await request(app).post("/api/auth/register").send({
      name: "Customer Alpha",
      email: "phaseg_alpha@example.com",
      password: "Password123!",
    });
    expect(resA.status).toBe(201);
    customerAToken = resA.body.data.accessToken;
    customerAId = resA.body.data.customer.id;

    // Register customer B
    const resB = await request(app).post("/api/auth/register").send({
      name: "Customer Beta",
      email: "phaseg_beta@example.com",
      password: "Password123!",
    });
    expect(resB.status).toBe(201);
    customerBToken = resB.body.data.accessToken;
    customerBId = resB.body.data.customer.id;

    // Login super admin
    const adminRes = await request(app).post("/api/admin/auth/login").send({
      email: process.env.ADMIN_EMAIL || "admin@aadyasociety.example",
      password: process.env.ADMIN_PASSWORD || "ChangeThisPassword123!",
    });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.accessToken;

    // Create Category
    const cat = await prisma.category.create({
      data: {
        name: "Phase G Test Category",
        slug: "phase-g-test-category",
      },
    });
    categoryId = cat.id;

    // Create Product
    const prod = await prisma.product.create({
      data: {
        name: "Phase G Test Product",
        slug: "phase-g-test-product",
        productType: "PHYSICAL",
        categoryId,
        price: 999.0,
        stockQuantity: 50,
      },
    });
    productId = prod.id;
  });

  describe("PART 1 & 3 — Review Submission & Validation Rules", () => {
    it("requires customer authentication to submit a review", async () => {
      const res = await request(app)
        .post("/api/account/reviews")
        .send({ productId, rating: 5, comment: "Awesome product!" });
      expect(res.status).toBe(401);
    });

    it("rejects invalid rating values (not 1-5)", async () => {
      const res = await request(app)
        .post("/api/account/reviews")
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({ productId, rating: 6, comment: "Over the top!" });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("Rating must be an integer between 1 and 5");
    });

    it("rejects review comments that are too short", async () => {
      const res = await request(app)
        .post("/api/account/reviews")
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({ productId, rating: 4, comment: "Hi" });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("at least 3 characters");
    });

    it("creates a new review with default PENDING status and isVerifiedPurchase = false (no order)", async () => {
      const res = await request(app)
        .post("/api/account/reviews")
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({
          productId,
          rating: 5,
          title: "Great craftsmanship",
          comment: "I love the quality of this handcrafted item.",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe("PENDING");
      expect(res.body.data.isVerifiedPurchase).toBe(false);
      expect(res.body.data.rating).toBe(5);
    });

    it("prevents duplicate reviews for the same customer and product", async () => {
      const res = await request(app)
        .post("/api/account/reviews")
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({
          productId,
          rating: 4,
          comment: "Second attempt review comment",
        });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("already reviewed");
    });
  });

  describe("PART 2 — Server-Side Verified Purchase Calculation", () => {
    it("computes isVerifiedPurchase = true if customer has a DELIVERED order containing product", async () => {
      // Create a delivered order for Customer B
      const order = await prisma.order.create({
        data: {
          orderNumber: "AAD-DELIVERED-TEST-001",
          customerName: "Customer Beta",
          customerEmail: "phaseg_beta@example.com",
          customerPhone: "9876543210",
          customerId: customerBId,
          status: "DELIVERED",
          paymentStatus: "PAID",
          subtotal: 999.0,
          totalAmount: 999.0,
          accessTokenHash: "hash-delivered-001",
          items: {
            create: [
              {
                productId,
                productNameSnapshot: "Phase G Test Product",
                productSlugSnapshot: "phase-g-test-product",
                productTypeSnapshot: "PHYSICAL",
                unitPrice: 999.0,
                quantity: 1,
                lineTotal: 999.0,
              },
            ],
          },
        },
      });

      const res = await request(app)
        .post("/api/account/reviews")
        .set("Authorization", `Bearer ${customerBToken}`)
        .send({
          productId,
          rating: 4,
          title: "Verified buyer feedback",
          comment: "Delivered fast and as described!",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.isVerifiedPurchase).toBe(true);
    });
  });

  describe("PART 4 & 5 — PDP Review Public Visibility & Average Rating", () => {
    it("keeps PENDING reviews hidden from public PDP endpoint", async () => {
      const res = await request(app).get(`/api/products/${productId}/reviews`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0); // Both Alpha & Beta's reviews are PENDING
      expect(res.body.meta.summary.reviewCount).toBe(0);
      expect(res.body.meta.summary.averageRating).toBe(0);
    });

    it("public product listing also reports 0 rating / 0 count when no approved reviews exist", async () => {
      const res = await request(app).get(`/api/products/${productId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.reviewCount).toBe(0);
      expect(res.body.data.averageRating).toBe(0);
    });
  });

  describe("PART 6 & 7 — Admin Review Moderation & Notifications", () => {
    let alphaReviewId = "";
    let betaReviewId = "";

    it("lists reviews for admin with pagination and status filters", async () => {
      const res = await request(app)
        .get("/api/admin/reviews?status=PENDING")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      const alphaRev = res.body.data.find((r) => r.customerId === customerAId);
      const betaRev = res.body.data.find((r) => r.customerId === customerBId);

      expect(alphaRev).toBeDefined();
      expect(betaRev).toBeDefined();

      alphaReviewId = alphaRev.id;
      betaReviewId = betaRev.id;
    });

    it("allows admin to approve a review and sets moderatedAt and moderatedByAdminId", async () => {
      const res = await request(app)
        .patch(`/api/admin/reviews/${alphaReviewId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "APPROVED" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("APPROVED");
      expect(res.body.data.moderatedAt).not.toBeNull();
      expect(res.body.data.moderatedByAdminId).toBe(adminUserId);
    });

    it("creates a customer notification on review approval", async () => {
      const res = await request(app)
        .get("/api/account/notifications")
        .set("Authorization", `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const notif = res.body.data.find((n) => n.type === "REVIEW_APPROVED");
      expect(notif).toBeDefined();
      expect(notif.title).toContain("Approved");
    });

    it("now displays the approved review on public PDP endpoint with correct summary & average rating", async () => {
      const res = await request(app).get(`/api/products/${productId}/reviews`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].rating).toBe(5);
      expect(res.body.data[0].customerName).toBe("Customer Alpha");
      expect(res.body.meta.summary.reviewCount).toBe(1);
      expect(res.body.meta.summary.averageRating).toBe(5.0);
    });

    it("allows admin to reject a review and creates a rejection notification", async () => {
      const res = await request(app)
        .patch(`/api/admin/reviews/${betaReviewId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "REJECTED" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("REJECTED");

      const notifRes = await request(app)
        .get("/api/account/notifications")
        .set("Authorization", `Bearer ${customerBToken}`);

      expect(notifRes.status).toBe(200);
      const notif = notifRes.body.data.find((n) => n.type === "REVIEW_REJECTED");
      expect(notif).toBeDefined();
    });
  });

  describe("PART 16 & 17 — Customer Account Reviews & Editing", () => {
    it("allows customer to view their submitted reviews with status badges", async () => {
      const res = await request(app)
        .get("/api/account/reviews")
        .set("Authorization", `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe("APPROVED");
    });

    it("editing an approved review reverts its status to PENDING and clears moderation info", async () => {
      const reviews = await request(app)
        .get("/api/account/reviews")
        .set("Authorization", `Bearer ${customerAToken}`);
      const reviewId = reviews.body.data[0].id;

      const editRes = await request(app)
        .put(`/api/account/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({
          rating: 4,
          comment: "Updated comment after trying it for a week!",
        });

      expect(editRes.status).toBe(200);
      expect(editRes.body.data.status).toBe("PENDING");
      expect(editRes.body.data.moderatedAt).toBeNull();
      expect(editRes.body.data.moderatedByAdminId).toBeNull();

      // PDP should no longer display it publicly while PENDING
      const pdpRes = await request(app).get(`/api/products/${productId}/reviews`);
      expect(pdpRes.body.data).toHaveLength(0);
    });

    it("prevents customer A from editing customer B's review", async () => {
      const reviewsB = await request(app)
        .get("/api/account/reviews")
        .set("Authorization", `Bearer ${customerBToken}`);
      const reviewBId = reviewsB.body.data[0].id;

      const editRes = await request(app)
        .put(`/api/account/reviews/${reviewBId}`)
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({ rating: 1, comment: "Malicious edit attempt" });

      expect(editRes.status).toBe(403);
    });
  });

  describe("PART 8 to 13 — Wishlist API & Ownership", () => {
    let wishlistItemId = "";

    it("requires customer authentication to manage wishlist", async () => {
      const res = await request(app).get("/api/account/wishlist");
      expect(res.status).toBe(401);
    });

    it("allows customer to add a product to their wishlist", async () => {
      const res = await request(app)
        .post("/api/account/wishlist")
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({ productId });

      expect([200, 201]).toContain(res.status);
      expect(res.body.data.productId).toBe(productId);
      wishlistItemId = res.body.data.id;
    });

    it("returns duplicate wishlist item gracefully when re-adding", async () => {
      const res = await request(app)
        .post("/api/account/wishlist")
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({ productId });

      expect(res.status).toBe(200);
      expect(res.body.data.productId).toBe(productId);
    });

    it("lists items in customer wishlist with full product details", async () => {
      const res = await request(app)
        .get("/api/account/wishlist")
        .set("Authorization", `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].productId).toBe(productId);
      expect(res.body.data[0].productName).toBe("Phase G Test Product");
    });

    it("prevents customer B from removing customer A's wishlist item (IDOR protection)", async () => {
      const res = await request(app)
        .delete(`/api/account/wishlist/${wishlistItemId}`)
        .set("Authorization", `Bearer ${customerBToken}`);

      expect(res.status).toBe(404);
    });

    it("allows customer A to remove an item from their wishlist", async () => {
      const res = await request(app)
        .delete(`/api/account/wishlist/${wishlistItemId}`)
        .set("Authorization", `Bearer ${customerAToken}`);

      expect(res.status).toBe(200);

      const checkRes = await request(app)
        .get("/api/account/wishlist")
        .set("Authorization", `Bearer ${customerAToken}`);

      expect(checkRes.body.data).toHaveLength(0);
    });

    it("rejects adding an inactive product to wishlist", async () => {
      const inactiveProd = await prisma.product.create({
        data: {
          name: "Inactive Product",
          slug: "inactive-product-phase-g",
          productType: "PHYSICAL",
          categoryId,
          price: 500,
          isActive: false,
        },
      });

      const res = await request(app)
        .post("/api/account/wishlist")
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({ productId: inactiveProd.id });

      expect(res.status).toBe(400);
    });
  });
});
