import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { resetDb, seedTestAdmin, seedTestCategory, seedTestProduct } from "./helpers.js";
import { env } from "../src/config/env.js";

const app = createApp();

describe("Product Duplication API", () => {
  let adminToken;
  let category;
  let product;

  beforeEach(async () => {
    await resetDb();
    await seedTestAdmin();
    adminToken = (
      await request(app)
        .post("/api/admin/auth/login")
        .send({ email: env.admin.email, password: env.admin.password })
    ).body.data.accessToken;

    category = await seedTestCategory({ name: "Handcrafted Brass" });
    product = await seedTestProduct({
      categoryId: category.id,
      name: "Brass Urli Bowl",
      slug: "brass-urli-bowl",
      sku: "BOWL-001",
      price: 1800,
      stockQuantity: 25,
      specifications: [{ label: "Material", value: "Pure Brass" }],
    });

    // Add an image and variant
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: "https://example.com/brass-urli.jpg",
        altText: "Brass Urli Bowl",
        isPrimary: true,
        sortOrder: 0,
      },
    });

    await prisma.productVariant.create({
      data: {
        productId: product.id,
        name: "Large - 10 inch",
        sku: "BOWL-001-LG",
        priceOverride: 2400,
        stockQuantity: 10,
        isActive: true,
      },
    });
  });

  it("duplicates product with all attributes, images, variants, sets DRAFT and 0 stock", async () => {
    const res = await request(app)
      .post(`/api/admin/products/${product.id}/duplicate`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const dup = res.body.data;
    expect(dup.id).not.toBe(product.id);
    expect(dup.name).toBe("Brass Urli Bowl (Copy)");
    expect(dup.slug).toBe("brass-urli-bowl-copy");
    expect(dup.sku).toBe("BOWL-001-COPY");
    expect(dup.stockQuantity).toBe(0);
    expect(dup.isActive).toBe(false); // DRAFT

    // Images preserved
    expect(dup.images.length).toBe(1);
    expect(dup.images[0].url).toBe("https://example.com/brass-urli.jpg");

    // Variants duplicated with 0 stock and new SKU
    expect(dup.variants.length).toBe(1);
    expect(dup.variants[0].name).toBe("Large - 10 inch");
    expect(dup.variants[0].sku).toBe("BOWL-001-LG-COPY");
    expect(dup.variants[0].stockQuantity).toBe(0);
    expect(dup.variants[0].isActive).toBe(false);

    // Audit log created
    const log = await prisma.adminAuditLog.findFirst({
      where: { action: "product.duplicate" },
    });
    expect(log).not.toBeNull();
    expect(log.metadata.originalProductId).toBe(product.id);
    expect(log.metadata.duplicatedProductId).toBe(dup.id);
  });

  it("handles multiple duplications with incremented slugs and SKUs", async () => {
    const res1 = await request(app)
      .post(`/api/admin/products/${product.id}/duplicate`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res1.status).toBe(201);
    expect(res1.body.data.slug).toBe("brass-urli-bowl-copy");
    expect(res1.body.data.sku).toBe("BOWL-001-COPY");

    const res2 = await request(app)
      .post(`/api/admin/products/${product.id}/duplicate`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res2.status).toBe(201);
    expect(res2.body.data.slug).toBe("brass-urli-bowl-copy-2");
    expect(res2.body.data.sku).toBe("BOWL-001-COPY-2");
  });
});

