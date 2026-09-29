import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { resetDb, seedTestProduct, seedTestAdmin } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";

process.env.SMTP_HOST = "smtp.test.local";
const sendMailMock = vi.fn(async () => ({ messageId: "mock-message-id" }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: (...args) => sendMailMock(...args) }) },
}));

const { createApp } = await import("../src/app.js");
const app = createApp();

beforeEach(async () => {
  await resetDb();
  sendMailMock.mockReset();
  sendMailMock.mockImplementation(async () => ({ messageId: "mock-message-id" }));
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

async function getAdminToken(role = "SUPER_ADMIN") {
  const admin = await seedTestAdmin({ role, email: `admin-${role}-${Math.random().toString(36).slice(2, 7)}@test.local` });
  const res = await request(app).post("/api/admin/auth/login").send({ email: admin.email, password: env.admin.password });
  return { token: res.body.data.accessToken, admin };
}

const basePayload = (overrides = {}) => ({
  customer: { name: "Walk-in Customer", email: "walkin@example.com", phone: "9999999999", state: "Karnataka", stateCode: "29" },
  invoice: { paymentMethod: "cash", notes: "offline sale" },
  items: [{ itemName: "Handmade Diary", hsnCode: "48201000", unit: "PCS", quantity: 2, unitPrice: 500, gstRate: 12 }],
  ...overrides,
});

describe("manual invoice: draft creation and editing", () => {
  it("creates a draft with no invoice number, not counted toward the sequence", async () => {
    const { token } = await getAdminToken();
    const res = await request(app).post("/api/admin/invoices/manual").set("Authorization", `Bearer ${token}`).send(basePayload());
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("DRAFT");
    expect(res.body.data.source).toBe("MANUAL");
    expect(res.body.data.invoiceNumber).toBeNull();

    const sequence = await prisma.invoiceSequence.findUnique({ where: { id: "default" } });
    expect(sequence).toBeNull(); // untouched by draft creation
  });

  it("allows editing a draft and recomputes totals", async () => {
    const { token } = await getAdminToken();
    const created = await request(app).post("/api/admin/invoices/manual").set("Authorization", `Bearer ${token}`).send(basePayload());
    const id = created.body.data.id;

    const edited = await request(app)
      .patch(`/api/admin/invoices/manual/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send(basePayload({ items: [{ itemName: "Handmade Diary", hsnCode: "48201000", unit: "PCS", quantity: 5, unitPrice: 500, gstRate: 12 }] }));
    expect(edited.status).toBe(200);
    expect(Number(edited.body.data.subtotal)).toBeCloseTo(2500, 2);
  });
});

describe("manual invoice: issuing", () => {
  it("issues a draft, assigning a number from the shared InvoiceSequence, with sequential non-colliding numbers across multiple manual invoices", async () => {
    const { token } = await getAdminToken();

    const draft1 = await request(app).post("/api/admin/invoices/manual").set("Authorization", `Bearer ${token}`).send(basePayload());
    const draft2 = await request(app).post("/api/admin/invoices/manual").set("Authorization", `Bearer ${token}`).send(basePayload({ customer: { ...basePayload().customer, email: "other@example.com" } }));

    const issued1 = await request(app).post(`/api/admin/invoices/manual/${draft1.body.data.id}/issue`).set("Authorization", `Bearer ${token}`).send({ sendEmail: false });
    const issued2 = await request(app).post(`/api/admin/invoices/manual/${draft2.body.data.id}/issue`).set("Authorization", `Bearer ${token}`).send({ sendEmail: false });

    expect(issued1.status).toBe(200);
    expect(issued2.status).toBe(200);
    expect(issued1.body.data.status).toBe("ISSUED");
    expect(issued1.body.data.invoiceNumber).toBeTruthy();
    expect(issued1.body.data.pdfStorageKey).toBeTruthy();
    expect(issued2.body.data.invoiceNumber).not.toBe(issued1.body.data.invoiceNumber);

    const sequence = await prisma.invoiceSequence.findUnique({ where: { id: "default" } });
    expect(sequence.nextNumber).toBe(3); // two manual invoices issued, sequence advanced exactly twice
  });

  it("autofills name/SKU/HSN/GST/unit/price from an existing product, honoring admin overrides", async () => {
    const { token } = await getAdminToken();
    const product = await seedTestProduct({ price: 800, stockQuantity: 20 });
    await prisma.product.update({ where: { id: product.id }, data: { hsnCode: "12345678", gstRate: 18, unit: "PCS" } });

    const draft = await request(app)
      .post("/api/admin/invoices/manual")
      .set("Authorization", `Bearer ${token}`)
      .send(basePayload({ items: [{ productId: product.id, quantity: 3, salePrice: 750 }] }));
    expect(draft.status).toBe(200);
    const item = draft.body.data.itemsSnapshot[0];
    expect(item.gstRate).toBe(18);
    expect(item.hsnCode).toBe("12345678");
    expect(item.unitPrice).toBe(750); // admin override honored
    expect(item.quantity).toBe(3);
  });

  it("supports a fully custom item with no linked product", async () => {
    const { token } = await getAdminToken();
    const draft = await request(app).post("/api/admin/invoices/manual").set("Authorization", `Bearer ${token}`).send(basePayload());
    expect(draft.status).toBe(200);
    expect(draft.body.data.itemsSnapshot[0].productName).toBe("Handmade Diary");
  });

  it("rejects editing or re-issuing an already-ISSUED manual invoice", async () => {
    const { token } = await getAdminToken();
    const draft = await request(app).post("/api/admin/invoices/manual").set("Authorization", `Bearer ${token}`).send(basePayload());
    const id = draft.body.data.id;
    await request(app).post(`/api/admin/invoices/manual/${id}/issue`).set("Authorization", `Bearer ${token}`).send({ sendEmail: false });

    const editAttempt = await request(app).patch(`/api/admin/invoices/manual/${id}`).set("Authorization", `Bearer ${token}`).send(basePayload());
    expect(editAttempt.status).toBe(403);

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    const originalNumber = invoice.invoiceNumber;
    // Re-issuing must not renumber (idempotent).
    const reissue = await request(app).post(`/api/admin/invoices/manual/${id}/issue`).set("Authorization", `Bearer ${token}`).send({ sendEmail: false });
    expect(reissue.status).toBe(200);
    expect(reissue.body.data.invoiceNumber).toBe(originalNumber);
  });

  it("writes AdminAuditLog entries for create/issue/email", async () => {
    const { token, admin } = await getAdminToken();
    const draft = await request(app).post("/api/admin/invoices/manual").set("Authorization", `Bearer ${token}`).send(basePayload());
    const id = draft.body.data.id;
    await request(app).post(`/api/admin/invoices/manual/${id}/issue`).set("Authorization", `Bearer ${token}`).send({ sendEmail: true });

    const logs = await prisma.adminAuditLog.findMany({ where: { adminId: admin.id } });
    const actions = logs.map((l) => l.action);
    expect(actions).toContain("MANUAL_INVOICE_CREATED");
    expect(actions).toContain("MANUAL_INVOICE_ISSUED");
    expect(actions).toContain("MANUAL_INVOICE_EMAILED");
  });

  it("email failure on Issue & Send does not undo issuance", async () => {
    const { token } = await getAdminToken();
    sendMailMock.mockRejectedValueOnce(new Error("smtp down"));
    const draft = await request(app).post("/api/admin/invoices/manual").set("Authorization", `Bearer ${token}`).send(basePayload());
    const id = draft.body.data.id;
    const issued = await request(app).post(`/api/admin/invoices/manual/${id}/issue`).set("Authorization", `Bearer ${token}`).send({ sendEmail: true });
    expect(issued.status).toBe(200);
    expect(issued.body.data.status).toBe("ISSUED");
    expect(issued.body.data.invoiceNumber).toBeTruthy();
  });
});

describe("manual invoice: authorization", () => {
  it("non-admin (no token) cannot create or issue", async () => {
    const createRes = await request(app).post("/api/admin/invoices/manual").send(basePayload());
    expect(createRes.status).toBe(401);
    const issueRes = await request(app).post("/api/admin/invoices/manual/fake-id/issue").send({});
    expect(issueRes.status).toBe(401);
  });
});

describe("external PDF upload", () => {
  it("requires admin auth to upload an external PDF", async () => {
    const { token } = await getAdminToken();
    const draft = await request(app).post("/api/admin/invoices/manual").set("Authorization", `Bearer ${token}`).send(basePayload());
    const id = draft.body.data.id;

    const pdfBuffer = Buffer.from("%PDF-1.4\n%%EOF");
    const unauth = await request(app).post(`/api/admin/invoices/${id}/external-pdf`).attach("file", pdfBuffer, "external.pdf");
    expect(unauth.status).toBe(401);

    const authed = await request(app)
      .post(`/api/admin/invoices/${id}/external-pdf`)
      .set("Authorization", `Bearer ${token}`)
      .field("externalInvoiceNumber", "EXT-001")
      .attach("file", pdfBuffer, "external.pdf");
    expect(authed.status).toBe(200);
    expect(authed.body.data.externalPdfStorageKey).toBeTruthy();
    expect(authed.body.data.externalPdfIsCanonical).toBe(false);
    // Structured pdfStorageKey (if any) must remain untouched.
    expect(authed.body.data.pdfStorageKey).toBeFalsy();
  });
});
