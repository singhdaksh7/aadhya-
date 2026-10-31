import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { resetDb, seedTestProduct, seedTestAdmin, VALID_CUSTOMER, VALID_ADDRESS } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";
import { extractPdfText } from "./pdf-text.js";

const { createApp } = await import("../src/app.js");
const app = createApp();
const { ensureInvoiceForOrder, getInvoiceSettings, updateInvoiceSettings, getInvoiceFile } = await import("../src/modules/invoices/invoice.service.js");

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

const GSTIN = "29ABCDE1234F1Z5";

async function configure(overrides = {}) {
  return updateInvoiceSettings({ ...(await getInvoiceSettings()), legalName: "Tushaqsa", gstEnabled: true, defaultTaxRate: 0, gstin: GSTIN, pan: "ABCDE1234F", state: "Karnataka", stateCode: "29", ...overrides });
}

async function place({ product, quantity = 2, state = "Karnataka", paymentMethod } = {}) {
  const p = product || (await seedTestProduct({ price: 500, stockQuantity: 10 }));
  const res = await request(app)
    .post("/api/orders")
    .send({ customer: VALID_CUSTOMER, shippingAddress: { ...VALID_ADDRESS, state }, items: [{ slug: p.slug, quantity }], paymentMethod });
  expect(res.status).toBeLessThan(300);
  return { orderId: res.body.data.orderId, product: p };
}

async function markPaid(orderId) {
  await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID", status: "CONFIRMED", paidAt: new Date() } });
}

async function invoiceFor(orderId, opts) {
  await markPaid(orderId);
  return ensureInvoiceForOrder(orderId, opts);
}

async function pdfText(invoiceId) {
  const file = await getInvoiceFile(invoiceId);
  const chunks = [];
  for await (const c of file.stream) chunks.push(c);
  return (await extractPdfText(Buffer.concat(chunks))).text;
}

async function adminToken() {
  await seedTestAdmin({ role: "SUPER_ADMIN" });
  const res = await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password });
  return res.body.data.accessToken;
}

describe("invoice GST: computed and rendered", () => {
  it("intra-state: CGST+SGST from the product rate, extracted from the paid price, shown on the PDF", async () => {
    await configure();
    const product = await seedTestProduct({ price: 500 });
    await prisma.product.update({ where: { id: product.id }, data: { gstRate: 12, hsnCode: "6304" } });
    const { orderId } = await place({ product, quantity: 2 });
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    const inv = await invoiceFor(orderId);

    // 1000 paid (+shipping) is tax-inclusive: taxable 892.86, GST 107.14 => 53.57 each.
    expect(Number(inv.taxSnapshot.cgstAmount) + Number(inv.taxSnapshot.sgstAmount)).toBeCloseTo(107.14, 1);
    expect(Number(inv.taxSnapshot.igstAmount)).toBe(0);
    expect(Number(inv.totalAmount)).toBe(Number(order.totalAmount)); // never differs from what was charged
    expect(inv.itemsSnapshot[0].hsnCode).toBe("6304");
    const text = await pdfText(inv.id);
    for (const needle of ["TAX INVOICE", "CGST", "SGST", "HSN 6304", "12%", "Intra-state supply", "Grand total"]) expect(text).toContain(needle);
    expect(text).not.toContain("IGST");
    const oi = await prisma.orderItem.findFirst({ where: { orderId } });
    expect(Number(oi.gstRateSnapshot)).toBe(12);
    expect(oi.hsnCodeSnapshot).toBe("6304");
    expect(Number(oi.cgstAmount)).toBeCloseTo(53.57, 1);
  });

  it("inter-state: IGST only, shown on the PDF", async () => {
    await configure();
    const product = await seedTestProduct({ price: 500 });
    await prisma.product.update({ where: { id: product.id }, data: { gstRate: 18, hsnCode: "6304" } });
    const { orderId } = await place({ product, quantity: 2, state: "Maharashtra" });
    const inv = await invoiceFor(orderId);
    expect(Number(inv.taxSnapshot.cgstAmount)).toBe(0);
    expect(Number(inv.taxSnapshot.igstAmount)).toBeCloseTo(152.54, 1);
    const text = await pdfText(inv.id);
    expect(text).toContain("IGST");
    expect(text).toContain("Inter-state supply");
    expect(text).not.toContain("SGST");
  });

  it("tax-exclusive: when the order carries tax on top, tax is added to the base", async () => {
    await configure();
    const product = await seedTestProduct({ price: 500 });
    await prisma.product.update({ where: { id: product.id }, data: { gstRate: 18, taxPricingMode: "TAX_EXCLUSIVE" } });
    const { orderId } = await place({ product, quantity: 2 });
    const o = await prisma.order.findUnique({ where: { id: orderId } });
    await prisma.order.update({ where: { id: orderId }, data: { taxAmount: 180, totalAmount: Number(o.totalAmount) + 180 } });
    const inv = await invoiceFor(orderId);
    expect(Number(inv.taxAmount)).toBeCloseTo(180, 1);
    expect(Number(inv.taxSnapshot.cgstAmount)).toBeCloseTo(90, 1);
    expect(Number(inv.totalAmount)).toBeCloseTo(Number(o.totalAmount) + 180, 2);
  });

  it("falls back to the store default rate only when configured and the product has none", async () => {
    await configure({ defaultTaxRate: 5 });
    const { orderId } = await place({});
    const inv = await invoiceFor(orderId);
    expect(inv.itemsSnapshot[0].gstRate).toBe(5);
    expect(inv.itemsSnapshot[0].rateSource).toBe("default");
    expect(Number(inv.taxAmount)).toBeGreaterThan(0);
  });

  it("missing rate: no invented tax, explicit 'GST not configured' on the PDF", async () => {
    await configure({ defaultTaxRate: 0 });
    const { orderId } = await place({});
    const inv = await invoiceFor(orderId);
    expect(Number(inv.taxAmount)).toBe(0);
    expect(inv.itemsSnapshot[0].gstRate).toBeNull();
    expect(inv.taxSnapshot.gstNotConfigured).toBe(true);
    const text = await pdfText(inv.id);
    expect(text).toContain("GST not configured");
    expect(text).toContain("N/A");
  });

  it("a rate configured on a product is applied even if the master GST toggle was left off", async () => {
    await configure({ gstEnabled: false });
    const product = await seedTestProduct({ price: 500 });
    await prisma.product.update({ where: { id: product.id }, data: { gstRate: 12 } });
    const { orderId } = await place({ product });
    const inv = await invoiceFor(orderId);
    expect(inv.taxSnapshot.enabled).toBe(true);
    expect(inv.taxSnapshot.autoEnabledFromProductRates).toBe(true);
    expect(Number(inv.taxAmount)).toBeGreaterThan(0);
  });

  it("missing company state is flagged instead of silently assuming intra-state", async () => {
    await configure({ state: "", stateCode: "" });
    const product = await seedTestProduct({ price: 500 });
    await prisma.product.update({ where: { id: product.id }, data: { gstRate: 12 } });
    const { orderId } = await place({ product });
    const inv = await invoiceFor(orderId);
    expect(inv.taxSnapshot.placeOfSupplyKnown).toBe(false);
    expect(await pdfText(inv.id)).toContain("Place of supply could not be determined");
  });

  it("COD with a COD fee: total equals the amount charged, fee is shown, no bogus rounding", async () => {
    await configure();
    const product = await seedTestProduct({ price: 500 });
    await prisma.product.update({ where: { id: product.id }, data: { gstRate: 12 } });
    const { orderId } = await place({ product });
    const o = await prisma.order.findUnique({ where: { id: orderId } });
    await prisma.order.update({ where: { id: orderId }, data: { paymentMethod: "cod", paymentStatus: "PENDING", codFeeAmount: 50, totalAmount: Number(o.totalAmount) + 50 } });
    const inv = await ensureInvoiceForOrder(orderId, { forceCod: true });
    expect(Number(inv.totalAmount)).toBeCloseTo(Number(o.totalAmount) + 50, 2);
    expect(Number(inv.taxSnapshot.rounding)).toBe(0);
    const text = await pdfText(inv.id);
    expect(text).toContain("COD fee");
    expect(text).toContain("CGST");
  });
});

describe("recompute tax on an existing invoice", () => {
  it("keeps the invoice number/date, fixes tax, rewrites the PDF, and logs an audit entry", async () => {
    await configure({ gstEnabled: false });
    const product = await seedTestProduct({ price: 500 });
    const { orderId } = await place({ product, quantity: 2 });
    const before = await invoiceFor(orderId);
    expect(Number(before.taxAmount)).toBe(0);
    expect(await pdfText(before.id)).not.toContain("CGST");

    // Owner now configures GST.
    await configure({ gstEnabled: true });
    await prisma.product.update({ where: { id: product.id }, data: { gstRate: 12, hsnCode: "6304" } });

    const token = await adminToken();
    const denied = await request(app).post(`/api/admin/invoices/${before.id}/recompute-tax`);
    expect(denied.status).toBe(401);
    const res = await request(app).post(`/api/admin/invoices/${before.id}/recompute-tax`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const after = await prisma.invoice.findUnique({ where: { id: before.id } });
    expect(after.invoiceNumber).toBe(before.invoiceNumber);
    expect(after.invoiceDate.toISOString()).toBe(before.invoiceDate.toISOString());
    expect(Number(after.totalAmount)).toBe(Number(before.totalAmount));
    expect(Number(after.taxAmount)).toBeCloseTo(107.14, 1);
    const text = await pdfText(after.id);
    expect(text).toContain("CGST");
    expect(text).toContain("SGST");
    const log = await prisma.adminAuditLog.findFirst({ where: { action: "INVOICE_TAX_RECOMPUTED" } });
    expect(log.metadata.invoiceNumber).toBe(before.invoiceNumber);
    expect(log.metadata.before.taxAmount).toBe(0);
    expect(await prisma.invoice.count()).toBe(1);
  });

  it("refuses manual invoices", async () => {
    await configure();
    const { orderId } = await place({});
    const inv = await invoiceFor(orderId);
    await prisma.invoice.update({ where: { id: inv.id }, data: { source: "MANUAL" } });
    const token = await adminToken();
    const res = await request(app).post(`/api/admin/invoices/${inv.id}/recompute-tax`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("tax readiness and product defaults", () => {
  it("reports what is missing", async () => {
    await configure({ gstEnabled: false, gstin: "", state: "", stateCode: "" });
    await seedTestProduct({ price: 100 });
    const token = await adminToken();
    const res = await request(app).get("/api/admin/invoices/tax-readiness").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const codes = res.body.data.issues.map((i) => i.code);
    for (const c of ["GST_DISABLED", "GSTIN_MISSING", "STATE_MISSING", "DEFAULT_RATE_MISSING", "PRODUCTS_MISSING_RATE", "PRODUCTS_MISSING_HSN"]) expect(codes).toContain(c);
    expect(res.body.data.productsMissingGstRate).toBe(1);
    expect(res.body.data.ready).toBe(false);
  });

  it("applies defaults only to products missing them, only when confirmed", async () => {
    const a = await seedTestProduct({ price: 100 });
    const b = await seedTestProduct({ price: 100 });
    await prisma.product.update({ where: { id: b.id }, data: { gstRate: 5, hsnCode: "1111" } });
    const token = await adminToken();
    const post = (body) => request(app).post("/api/admin/invoices/apply-product-defaults").set("Authorization", `Bearer ${token}`).send(body);

    const dry = await post({ gstRate: 12, hsnCode: "6304" });
    expect(dry.body.data).toMatchObject({ dryRun: true, wouldUpdateGstRate: 1, wouldUpdateHsn: 1 });
    expect(Number((await prisma.product.findUnique({ where: { id: a.id } })).gstRate || 0)).toBe(0);

    expect((await post({ gstRate: 13, confirm: true })).status).toBe(400); // not a valid GST slab
    const done = await post({ gstRate: 12, hsnCode: "6304", confirm: true });
    expect(done.body.data).toMatchObject({ dryRun: false, gstRateUpdated: 1, hsnUpdated: 1 });
    const pa = await prisma.product.findUnique({ where: { id: a.id } });
    const pb = await prisma.product.findUnique({ where: { id: b.id } });
    expect(Number(pa.gstRate)).toBe(12);
    expect(pa.hsnCode).toBe("6304");
    expect(Number(pb.gstRate)).toBe(5); // untouched
    expect(pb.hsnCode).toBe("1111");
    expect(await prisma.adminAuditLog.count({ where: { action: "PRODUCT_GST_DEFAULTS_APPLIED" } })).toBe(1);
  });
});
