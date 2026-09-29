import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { resetDb, seedTestAdmin } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";

const { createApp } = await import("../src/app.js");
const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

async function getAdminToken(role = "SUPER_ADMIN") {
  await seedTestAdmin({ role });
  const res = await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password });
  return res.body.data.accessToken;
}

const item = (overrides = {}) => ({
  itemName: "Handmade Diary",
  hsnCode: "48201000",
  unit: "PCS",
  quantity: 2,
  unitPrice: 500,
  gstRate: 12,
  ...overrides,
});

describe("manual invoice preview endpoint (task 3/4/5/7): informational, non-persisting", () => {
  it("persists nothing (no Order/Invoice row created) while returning a computed breakdown", async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .post("/api/admin/invoices/manual/preview")
      .set("Authorization", `Bearer ${token}`)
      .send({ customer: { state: "Karnataka" }, items: [item()] });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.totalAmount).toBeGreaterThan(0);

    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.invoice.count()).toBe(0);
    expect(await prisma.invoiceSequence.count()).toBe(0);
  });

  it("reports intra-state supply (CGST+SGST split, IGST zero) when customer state matches the seller state", async () => {
    const token = await getAdminToken();
    await request(app)
      .put("/api/admin/invoices/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ prefix: "AADYA", nextInvoiceNumber: 1, legalName: "Aadya Society", state: "Karnataka", stateCode: "29" });

    const res = await request(app)
      .post("/api/admin/invoices/manual/preview")
      .set("Authorization", `Bearer ${token}`)
      .send({ customer: { state: "Karnataka" }, items: [item()] });

    expect(res.status).toBe(200);
    expect(res.body.data.interState).toBe(false);
    expect(Number(res.body.data.tax.cgstAmount)).toBeGreaterThan(0);
    expect(Number(res.body.data.tax.sgstAmount)).toBeGreaterThan(0);
    expect(Number(res.body.data.tax.igstAmount)).toBe(0);
  });

  it("reports inter-state supply (IGST only, CGST/SGST zero) when customer state differs from the seller state", async () => {
    const token = await getAdminToken();
    await request(app)
      .put("/api/admin/invoices/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ prefix: "AADYA", nextInvoiceNumber: 1, legalName: "Aadya Society", state: "Karnataka", stateCode: "29" });

    const res = await request(app)
      .post("/api/admin/invoices/manual/preview")
      .set("Authorization", `Bearer ${token}`)
      .send({ customer: { state: "Maharashtra" }, items: [item()] });

    expect(res.status).toBe(200);
    expect(res.body.data.interState).toBe(true);
    expect(Number(res.body.data.tax.cgstAmount)).toBe(0);
    expect(Number(res.body.data.tax.sgstAmount)).toBe(0);
    expect(Number(res.body.data.tax.igstAmount)).toBeGreaterThan(0);
  });

  it("reflects TAX_INCLUSIVE vs TAX_EXCLUSIVE pricing mode in the per-item taxableValue", async () => {
    const token = await getAdminToken();

    const exclusive = await request(app)
      .post("/api/admin/invoices/manual/preview")
      .set("Authorization", `Bearer ${token}`)
      .send({ customer: { state: "Karnataka" }, items: [item({ quantity: 1, unitPrice: 118, gstRate: 18, taxPricingMode: "TAX_EXCLUSIVE" })] });
    expect(exclusive.body.data.items[0].taxPricingMode).toBe("TAX_EXCLUSIVE");
    expect(Number(exclusive.body.data.items[0].taxableValue)).toBeCloseTo(118, 2);

    const inclusive = await request(app)
      .post("/api/admin/invoices/manual/preview")
      .set("Authorization", `Bearer ${token}`)
      .send({ customer: { state: "Karnataka" }, items: [item({ quantity: 1, unitPrice: 118, gstRate: 18, taxPricingMode: "TAX_INCLUSIVE" })] });
    expect(inclusive.body.data.items[0].taxPricingMode).toBe("TAX_INCLUSIVE");
    // 118 inclusive of 18% GST -> taxable value = 118 / 1.18 = 100.00
    expect(Number(inclusive.body.data.items[0].taxableValue)).toBeCloseTo(100, 2);
  });

  it("rounding parity: preview totals for a payload are byte-identical to the totals persisted when that same payload is actually issued", async () => {
    const token = await getAdminToken();
    await request(app)
      .put("/api/admin/invoices/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ prefix: "AADYA", nextInvoiceNumber: 1, legalName: "Aadya Society", state: "Karnataka", stateCode: "29", gstEnabled: true, defaultTaxRate: 18 });

    const payload = {
      customer: { name: "Parity Test", email: "parity@example.com", state: "Maharashtra" },
      items: [item({ quantity: 3, unitPrice: 333.33, gstRate: 18 }), item({ itemName: "Notebook", quantity: 1, unitPrice: 99.99, gstRate: 5 })],
    };

    const preview = await request(app)
      .post("/api/admin/invoices/manual/preview")
      .set("Authorization", `Bearer ${token}`)
      .send({ customer: payload.customer, items: payload.items });
    expect(preview.status).toBe(200);

    const draft = await request(app).post("/api/admin/invoices/manual").set("Authorization", `Bearer ${token}`).send(payload);
    expect(draft.status).toBe(200);

    expect(Number(draft.body.data.subtotal)).toBeCloseTo(Number(preview.body.data.subtotal), 2);
    expect(Number(draft.body.data.taxAmount)).toBeCloseTo(Number(preview.body.data.taxAmount), 2);
    expect(Number(draft.body.data.totalAmount)).toBeCloseTo(Number(preview.body.data.totalAmount), 2);

    // Per-item parity too, since the preview and draft both flow through the
    // identical computeItemTaxLine/resolveManualItem path.
    for (let i = 0; i < payload.items.length; i += 1) {
      expect(Number(draft.body.data.itemsSnapshot[i].taxableValue)).toBeCloseTo(Number(preview.body.data.items[i].taxableValue), 2);
      expect(Number(draft.body.data.itemsSnapshot[i].taxAmount)).toBeCloseTo(Number(preview.body.data.items[i].taxAmount), 2);
    }
  });

  it("rejects a preview with no items", async () => {
    const token = await getAdminToken();
    const res = await request(app)
      .post("/api/admin/invoices/manual/preview")
      .set("Authorization", `Bearer ${token}`)
      .send({ customer: { state: "Karnataka" }, items: [] });
    expect(res.status).toBe(400);
  });

  it("requires admin auth", async () => {
    const res = await request(app)
      .post("/api/admin/invoices/manual/preview")
      .send({ customer: { state: "Karnataka" }, items: [item()] });
    expect(res.status).toBe(401);
  });
});
