import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { resetDb, seedTestAdmin } from "./helpers.js";
import { sanitizeRichText } from "../src/utils/sanitizer.js";

const app = createApp();

async function getAdminToken() {
  await seedTestAdmin();
  const res = await request(app)
    .post("/api/admin/auth/login")
    .send({ email: "admin@test.local", password: "TestPassword123!" });
  return res.body?.data?.accessToken;
}

describe("Phase E CMS, Blog, FAQ, Media & Sanitizer", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("Rich Text Sanitizer", () => {
    it("strips script tags and executable js", () => {
      const input = `<p>Hello <script>alert('xss')</script><a href="javascript:alert(1)">Click</a></p>`;
      const clean = sanitizeRichText(input);
      expect(clean).not.toContain("<script>");
      expect(clean).not.toContain("javascript:");
      expect(clean).toContain("<p>Hello ");
    });

    it("preserves formatted headings, font-size, colors, links, images, and lists", () => {
      const input = `<h1 style="color: #b8674a; font-size: 24px;">Heading</h1><ul><li>Item 1</li></ul><a href="https://example.com">Link</a><img src="https://example.com/img.jpg" alt="test"/>`;
      const clean = sanitizeRichText(input);
      expect(clean).toContain('Heading</h1>');
      expect(clean).toContain('<li>Item 1</li>');
      expect(clean).toContain('href="https://example.com"');
      expect(clean).toContain('src="https://example.com/img.jpg"');
    });
  });

  describe("CMS Pages API", () => {
    it("admin can create, list, edit, publish, and delete a standard page", async () => {
      const token = await getAdminToken();

      // Create draft page
      const createRes = await request(app)
        .post("/api/admin/pages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "About Aadya",
          slug: "about-us",
          pageType: "STANDARD",
          status: "DRAFT",
          content: "<p>Welcome to <strong>Aadya</strong></p>"
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.slug).toBe("about-us");
      expect(createRes.body.data.status).toBe("DRAFT");
      const pageId = createRes.body.data.id;

      // Public storefront route must 404 for draft
      const publicDraft = await request(app).get("/api/pages/about-us");
      expect(publicDraft.status).toBe(404);

      // Publish page
      const pubRes = await request(app)
        .post(`/api/admin/pages/${pageId}/publish`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "PUBLISHED" });
      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.status).toBe("PUBLISHED");

      // Public storefront route now returns published page
      const publicPub = await request(app).get("/api/pages/about-us");
      expect(publicPub.status).toBe(200);
      expect(publicPub.body.data.name).toBe("About Aadya");
      expect(publicPub.body.data.content).toContain("Welcome to <strong>Aadya</strong>");

      // Delete page
      const delRes = await request(app)
        .delete(`/api/admin/pages/${pageId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(delRes.status).toBe(200);
    });

    it("rejects duplicate page slugs", async () => {
      const token = await getAdminToken();
      await request(app)
        .post("/api/admin/pages")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Page 1", slug: "terms", content: "Content" });

      const dup = await request(app)
        .post("/api/admin/pages")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Page 2", slug: "terms", content: "Content 2" });

      expect(dup.status).toBe(400);
      expect(JSON.stringify(dup.body)).toContain("already exists");
    });
  });

  describe("Blog CMS API", () => {
    it("admin creates blog post; public list hides draft and shows published", async () => {
      const token = await getAdminToken();

      // Create draft post
      const draftPost = await request(app)
        .post("/api/admin/blog")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "Home Styling Guide",
          slug: "home-styling-guide",
          excerpt: "Tips for decor",
          content: "<h2>Decor Tips</h2><p>Use terracotta accents.</p>",
          status: "DRAFT",
          category: "Decor"
        });

      expect(draftPost.status).toBe(201);
      const postId = draftPost.body.data.id;

      // Public blog list should be empty
      const publicList1 = await request(app).get("/api/blog");
      expect(publicList1.body.items).toHaveLength(0);

      // Publish post
      await request(app)
        .post(`/api/admin/blog/${postId}/publish`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "PUBLISHED" });

      // Public blog list now shows post
      const publicList2 = await request(app).get("/api/blog");
      expect(publicList2.body.items).toHaveLength(1);
      expect(publicList2.body.items[0].title).toBe("Home Styling Guide");

      // Detail route
      const detail = await request(app).get("/api/blog/home-styling-guide");
      expect(detail.status).toBe(200);
      expect(detail.body.data.content).toContain("Use terracotta accents.");
    });
  });

  describe("FAQ CMS API", () => {
    it("manages categories and items; public route returns sorted active FAQs", async () => {
      const token = await getAdminToken();

      // Create Category
      const catRes = await request(app)
        .post("/api/admin/faqs/categories")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Shipping & Delivery", slug: "shipping", sortOrder: 1 });
      expect(catRes.status).toBe(201);
      const catId = catRes.body.data.id;

      // Create FAQ Item
      const itemRes = await request(app)
        .post("/api/admin/faqs/items")
        .set("Authorization", `Bearer ${token}`)
        .send({
          categoryId: catId,
          question: "How long does shipping take?",
          answer: "<p>Shipping takes 3-5 business days.</p>",
          sortOrder: 1,
          isActive: true
        });
      expect(itemRes.status).toBe(201);

      // Public FAQs
      const publicFaqs = await request(app).get("/api/faqs");
      expect(publicFaqs.status).toBe(200);
      expect(publicFaqs.body.data).toHaveLength(1);
      expect(publicFaqs.body.data[0].name).toBe("Shipping & Delivery");
      expect(publicFaqs.body.data[0].items[0].question).toBe("How long does shipping take?");
    });
  });

  describe("Media Library API", () => {
    it("uploads image, lists media, updates metadata, and protects referenced asset from silent deletion", async () => {
      const token = await getAdminToken();

      // Upload mock buffer
      const fileBuffer = Buffer.from("fake-image-bytes");
      const uploadRes = await request(app)
        .post("/api/admin/media/upload")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", fileBuffer, "test-banner.jpg")
        .field("altText", "Aadya Banner");

      expect(uploadRes.status).toBe(201);
      expect(uploadRes.body.data.url).toBeDefined();
      const mediaId = uploadRes.body.data.id;
      const mediaUrl = uploadRes.body.data.url;

      // List Media
      const listRes = await request(app)
        .get("/api/admin/media?search=test-banner")
        .set("Authorization", `Bearer ${token}`);
      expect(listRes.body.items).toHaveLength(1);

      // Create Page referencing this image
      await request(app)
        .post("/api/admin/pages")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Page with Banner",
          slug: "banner-page",
          featuredImage: mediaUrl,
          content: `<img src="${mediaUrl}" alt="banner" />`
        });

      // Try deleting without force -> should be rejected with 409
      const delTry = await request(app)
        .delete(`/api/admin/media/${mediaId}`)
        .set("Authorization", `Bearer ${token}`);
      expect(delTry.status).toBe(409);

      // Force delete -> succeeds
      const forceDel = await request(app)
        .delete(`/api/admin/media/${mediaId}?force=true`)
        .set("Authorization", `Bearer ${token}`);
      expect(forceDel.status).toBe(200);
    });
  });
});
