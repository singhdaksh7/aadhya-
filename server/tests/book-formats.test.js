import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";
import {
  resetDb,
  registerCustomer,
  seedTestAdmin,
  seedTestProduct,
  seedTestBookWithFormats,
} from "./helpers.js";

const app = createApp();

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function adminToken() {
  await seedTestAdmin();
  const res = await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password });
  return res.body.data.accessToken;
}

describe("admin book format CRUD", () => {
  it("creates a PHYSICAL and a PDF format option for a BOOK product", async () => {
    const token = await adminToken();
    const book = await seedTestProduct({ productType: "BOOK", slug: "book-1" });

    const physical = await request(app)
      .put(`/api/admin/products/${book.id}/book-formats/PHYSICAL`)
      .set(auth(token))
      .send({ price: 500, stockQuantity: 20, trackInventory: true });
    expect(physical.status).toBe(201);
    expect(physical.body.data.format).toBe("PHYSICAL");

    const pdf = await request(app)
      .put(`/api/admin/products/${book.id}/book-formats/PDF`)
      .set(auth(token))
      .send({ price: 300 });
    expect(pdf.status).toBe(201);
    expect(pdf.body.data.format).toBe("PDF");

    const list = await request(app).get(`/api/admin/products/${book.id}/book-formats`).set(auth(token));
    expect(list.body.data).toHaveLength(2);
  });

  it("rejects book formats on a PHYSICAL (non-book) product", async () => {
    const token = await adminToken();
    const product = await seedTestProduct({ productType: "PHYSICAL", slug: "p1" });
    const res = await request(app)
      .put(`/api/admin/products/${product.id}/book-formats/PHYSICAL`)
      .set(auth(token))
      .send({ price: 500 });
    expect(res.status).toBe(400);
  });

  it("updates an existing format option instead of duplicating it", async () => {
    const token = await adminToken();
    const book = await seedTestProduct({ productType: "BOOK", slug: "book-1" });
    await request(app).put(`/api/admin/products/${book.id}/book-formats/PHYSICAL`).set(auth(token)).send({ price: 500 });
    const res = await request(app).put(`/api/admin/products/${book.id}/book-formats/PHYSICAL`).set(auth(token)).send({ price: 600 });
    expect(res.body.data.price).toBe(600);
    const count = await prisma.bookFormatOption.count({ where: { productId: book.id, format: "PHYSICAL" } });
    expect(count).toBe(1);
  });

  it("deletes a format option", async () => {
    const token = await adminToken();
    const book = await seedTestBookWithFormats({ slug: "book-1" });
    const res = await request(app).delete(`/api/admin/products/${book.id}/book-formats/PDF`).set(auth(token));
    expect(res.status).toBe(204);
    const remaining = await prisma.bookFormatOption.findMany({ where: { productId: book.id } });
    expect(remaining.map((r) => r.format)).toEqual(["PHYSICAL"]);
  });
});

describe("admin PDF upload validation", () => {
  it("rejects a non-PDF file", async () => {
    const token = await adminToken();
    const book = await seedTestProduct({ productType: "BOOK", slug: "book-1" });
    await request(app).put(`/api/admin/products/${book.id}/book-formats/PDF`).set(auth(token)).send({ price: 300 });

    const res = await request(app)
      .post(`/api/admin/products/${book.id}/book-formats/pdf`)
      .set(auth(token))
      .attach("pdf", Buffer.from("not a pdf"), { filename: "book.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
  });

  it("rejects an oversized PDF", async () => {
    const token = await adminToken();
    const book = await seedTestProduct({ productType: "BOOK", slug: "book-1" });
    await request(app).put(`/api/admin/products/${book.id}/book-formats/PDF`).set(auth(token)).send({ price: 300 });

    const oversized = Buffer.alloc(51 * 1024 * 1024, 1);
    const res = await request(app)
      .post(`/api/admin/products/${book.id}/book-formats/pdf`)
      .set(auth(token))
      .attach("pdf", oversized, { filename: "book.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(400);
  }, 20000);

  it("accepts a valid small PDF and records the original filename", async () => {
    const token = await adminToken();
    const book = await seedTestProduct({ productType: "BOOK", slug: "book-1" });
    await request(app).put(`/api/admin/products/${book.id}/book-formats/PDF`).set(auth(token)).send({ price: 300 });

    const res = await request(app)
      .post(`/api/admin/products/${book.id}/book-formats/pdf`)
      .set(auth(token))
      .attach("pdf", Buffer.from("%PDF-1.4 fake"), { filename: "my-book.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(200);
    expect(res.body.data.pdfOriginalName).toBe("my-book.pdf");
    expect(res.body.data.hasPdfFile).toBe(true);
    // The private storage key must never be exposed to the client.
    expect(res.body.data.pdfFileKey).toBeUndefined();
  });
});

describe("cart with book formats", () => {
  it("keeps PHYSICAL and PDF as separate cart lines for the same book", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const book = await seedTestBookWithFormats({ slug: "book-1" });

    await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: book.slug, bookFormat: "PHYSICAL", quantity: 2 });
    await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: book.slug, bookFormat: "PDF", quantity: 1 });

    const res = await request(app).get("/api/cart").set(auth(accessToken));
    expect(res.body.data).toHaveLength(2);
    const byFormat = Object.fromEntries(res.body.data.map((i) => [i.bookFormat, i.quantity]));
    expect(byFormat.PHYSICAL).toBe(2);
    expect(byFormat.PDF).toBe(1);
  });

  it("never lets PDF quantity exceed 1, even via repeated add", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const book = await seedTestBookWithFormats({ slug: "book-1" });

    await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: book.slug, bookFormat: "PDF", quantity: 1 });
    const res = await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: book.slug, bookFormat: "PDF", quantity: 1 });
    expect(res.body.data.find((i) => i.bookFormat === "PDF").quantity).toBe(1);
  });

  it("requires a format to be selected for a book that has format options", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const book = await seedTestBookWithFormats({ slug: "book-1" });
    const res = await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: book.slug, quantity: 1 });
    expect(res.status).toBe(400);
  });
});

describe("checkout: PDF-only cart skips shipping/address", () => {
  it("does not require a shipping address for an all-digital order", async () => {
    const { accessToken, customer } = await registerCustomer(app, { email: "a@test.local" });
    const book = await seedTestBookWithFormats({ slug: "book-1" });

    const res = await request(app)
      .post("/api/orders")
      .set(auth(accessToken))
      .send({
        customer: { name: customer?.name || "Test Customer", email: "a@test.local", phone: "9876543210" },
        items: [{ slug: book.slug, bookFormat: "PDF", quantity: 1 }],
      });
    expect(res.status).toBe(201);
    const order = await prisma.order.findUnique({ where: { id: res.body.data.orderId }, include: { address: true } });
    expect(order.address).toBeNull();
    expect(Number(order.shippingAmount)).toBe(0);
  });

  it("requires an address for a mixed physical + digital cart", async () => {
    const { accessToken, customer } = await registerCustomer(app, { email: "a@test.local" });
    const book = await seedTestBookWithFormats({ slug: "book-1" });

    const res = await request(app)
      .post("/api/orders")
      .set(auth(accessToken))
      .send({
        customer: { name: customer?.name || "Test Customer", email: "a@test.local", phone: "9876543210" },
        items: [
          { slug: book.slug, bookFormat: "PDF", quantity: 1 },
          { slug: book.slug, bookFormat: "PHYSICAL", quantity: 1 },
        ],
      });
    expect(res.status).toBe(400);
  });

  it("rejects Cash on Delivery for a digital-only (PDF) cart", async () => {
    const { accessToken, customer } = await registerCustomer(app, { email: "a@test.local" });
    const book = await seedTestBookWithFormats({ slug: "book-1" });

    const res = await request(app)
      .post("/api/orders")
      .set(auth(accessToken))
      .send({
        customer: { name: customer?.name || "Test Customer", email: "a@test.local", phone: "9876543210" },
        items: [{ slug: book.slug, bookFormat: "PDF", quantity: 1 }],
        paymentMethod: "cod",
      });
    expect(res.status).toBe(400);
    expect(res.body.error?.message || res.body.message).toMatch(/cash on delivery/i);
  });
});

describe("digital download entitlement + endpoint", () => {
  async function createPaidPdfOrder({ email = "a@test.local" } = {}) {
    const { accessToken, customer } = await registerCustomer(app, { email });
    const book = await seedTestBookWithFormats({ slug: "book-1", formats: { PDF: { price: 100, maxDownloads: 2, pdfFileKey: null } } });
    const orderRes = await request(app)
      .post("/api/orders")
      .set(auth(accessToken))
      .send({
        customer: { name: customer?.name || "Test Customer", email, phone: "9876543210" },
        items: [{ slug: book.slug, bookFormat: "PDF", quantity: 1 }],
      });
    const orderId = orderRes.body.data.orderId;
    const payment = await prisma.payment.findFirst({ where: { orderId } });
    await prisma.payment.update({ where: { id: payment.id }, data: { providerOrderId: `rp_${payment.id}` } });
    const { finalizePaidPayment } = await import("../src/modules/payments/payment.service.js");
    await finalizePaidPayment({ providerOrderId: `rp_${payment.id}`, providerPaymentId: "pay_1", method: "card" });
    return { accessToken, orderId };
  }

  it("creates exactly one DigitalDownload entitlement per PDF order item, even if finalize runs twice", async () => {
    const { orderId } = await createPaidPdfOrder();
    const orderItem = await prisma.orderItem.findFirst({ where: { orderId } });
    const before = await prisma.digitalDownload.count({ where: { orderItemId: orderItem.id } });
    expect(before).toBe(1);

    // Simulate a webhook retry hitting finalize again for the same payment.
    const payment = await prisma.payment.findFirst({ where: { orderId } });
    const { finalizePaidPayment } = await import("../src/modules/payments/payment.service.js");
    await finalizePaidPayment({ providerOrderId: payment.providerOrderId, providerPaymentId: "pay_1_retry", method: "card" });

    const after = await prisma.digitalDownload.count({ where: { orderItemId: orderItem.id } });
    expect(after).toBe(1);
  });

  it("lists the customer's downloads via /account/downloads", async () => {
    const { accessToken } = await createPaidPdfOrder();
    const res = await request(app).get("/api/account/downloads").set(auth(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].maxDownloads).toBe(2);
  });

  it("returns 404 for the download endpoint when the PDF file is missing (never crashes, never leaks the storage key)", async () => {
    const { accessToken, orderId } = await createPaidPdfOrder();
    const orderItem = await prisma.orderItem.findFirst({ where: { orderId } });
    const linkRes = await request(app).post(`/api/account/downloads/${orderItem.id}/link`).set(auth(accessToken));
    expect(linkRes.status).toBe(200);
    const download = await request(app).get(`/api/downloads/${linkRes.body.data.token}`);
    // No pdfFileKey was ever uploaded for this option in the test fixture, so
    // this must 404 rather than serve nothing / throw.
    expect(download.status).toBe(404);
  });

  it("rejects an unknown/garbage download token", async () => {
    const res = await request(app).get("/api/downloads/not-a-real-token");
    expect(res.status).toBe(404);
  });
});
