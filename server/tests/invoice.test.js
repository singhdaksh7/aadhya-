import { describe, it, expect, vi, beforeEach, afterAll, afterEach } from "vitest";
import request from "supertest";
import { resetDb, seedTestProduct, seedTestBookWithFormats, seedTestAdmin, registerCustomer, VALID_CUSTOMER, VALID_ADDRESS } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";

// SMTP is unconfigured by default in the test env (.env.test has SMTP_HOST=""),
// which makes email.service.js short-circuit through its "smtp not configured"
// branch. To exercise the real send/claim/idempotency logic we flip SMTP on
// for this file and mock nodemailer's transport at the network boundary —
// nothing downstream (claim semantics, EmailLog, AdminAuditLog) is faked.
process.env.SMTP_HOST = "smtp.test.local";

const sendMailMock = vi.fn(async () => ({ messageId: "mock-message-id" }));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: (...args) => sendMailMock(...args) }) },
}));

// Lets individual tests force the PDF write to fail exactly once, to prove
// a transient rendering/storage failure is retryable without side effects
// on the Invoice row (no duplicate, no renumbering).
let writeFailuresRemaining = 0;
vi.mock("../src/modules/invoices/invoice.storage.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    writeInvoicePdf: async (...args) => {
      if (writeFailuresRemaining > 0) {
        writeFailuresRemaining -= 1;
        throw new Error("simulated disk failure");
      }
      return actual.writeInvoicePdf(...args);
    },
  };
});

const { createApp } = await import("../src/app.js");
const app = createApp();

const invoiceService = await import("../src/modules/invoices/invoice.service.js");
const { ensureInvoiceForOrder, regenerateInvoicePdf, getInvoiceSettings, updateInvoiceSettings, assertCustomerInvoice, assertGuestInvoice, listCustomerInvoices, getInvoiceFile } = invoiceService;
const { sendInvoiceEmail } = await import("../src/modules/email/email.service.js");
const { finalizePaidPayment } = await import("../src/modules/payments/payment.service.js");
const { readInvoicePdf } = await import("../src/modules/invoices/invoice.storage.js");

beforeEach(async () => {
  await resetDb();
  sendMailMock.mockReset();
  sendMailMock.mockImplementation(async () => ({ messageId: "mock-message-id" }));
  writeFailuresRemaining = 0;
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

async function placeOrder(overrides = {}) {
  const product = overrides.product || (await seedTestProduct({ price: 500, stockQuantity: 10 }));
  const res = await request(app)
    .post("/api/orders")
    .send({
      customer: overrides.customer || VALID_CUSTOMER,
      shippingAddress: overrides.shippingAddress || VALID_ADDRESS,
      items: [{ slug: product.slug, quantity: overrides.quantity ?? 1 }],
      paymentMethod: overrides.paymentMethod,
    });
  return { orderId: res.body.data.orderId, orderNumber: res.body.data.orderNumber, accessToken: res.body.data.accessToken, product, res };
}

// Marks an order PAID directly (bypassing finalizePaidPayment) so we can
// drive ensureInvoiceForOrder ourselves without an invoice already existing.
async function markOrderPaidDirect(orderId) {
  await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID", status: "CONFIRMED", paidAt: new Date() } });
}

async function getAdminToken(role = "SUPER_ADMIN") {
  await seedTestAdmin({ role });
  const res = await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password });
  return res.body.data.accessToken;
}

describe("invoice creation: exactly-once + numbering", () => {
  it("creates exactly one invoice per order under concurrent ensureInvoiceForOrder calls", async () => {
    const { orderId } = await placeOrder();
    await markOrderPaidDirect(orderId);

    const results = await Promise.all(Array.from({ length: 5 }, () => ensureInvoiceForOrder(orderId)));
    const ids = new Set(results.filter(Boolean).map((inv) => inv.id));
    expect(ids.size).toBe(1);

    const invoices = await prisma.invoice.findMany({ where: { orderId } });
    expect(invoices).toHaveLength(1);

    const sequence = await prisma.invoiceSequence.findUnique({ where: { id: "default" } });
    // Only one increment should have happened for this single order.
    expect(sequence.nextNumber).toBe(2);
  });

  it("assigns distinct, non-colliding invoice numbers when different orders are paid concurrently", async () => {
    const orderIds = [];
    for (let i = 0; i < 4; i += 1) {
      const { orderId } = await placeOrder({ product: await seedTestProduct({ price: 500, stockQuantity: 10 }) });
      await markOrderPaidDirect(orderId);
      orderIds.push(orderId);
    }

    const invoices = await Promise.all(orderIds.map((id) => ensureInvoiceForOrder(id)));
    const numbers = invoices.map((inv) => inv.invoiceNumber);
    expect(new Set(numbers).size).toBe(4);

    const sequence = await prisma.invoiceSequence.findUnique({ where: { id: "default" } });
    expect(sequence.nextNumber).toBe(5);
  });

  it("duplicate payment webhook delivery produces exactly one invoice and one invoice email send", async () => {
    const { orderId } = await placeOrder();
    const payment = await prisma.payment.findFirst({ where: { orderId } });
    await prisma.payment.update({ where: { id: payment.id }, data: { providerOrderId: `rp_${payment.id}` } });

    await finalizePaidPayment({ providerOrderId: `rp_${payment.id}`, providerPaymentId: "pay_dup", method: "card" });
    // Duplicate delivery of the same webhook/verify event.
    await finalizePaidPayment({ providerOrderId: `rp_${payment.id}`, providerPaymentId: "pay_dup", method: "card" });

    const invoices = await prisma.invoice.findMany({ where: { orderId } });
    expect(invoices).toHaveLength(1);

    // The auto-invoice email dispatched by finalizePaidPayment is fire-and-forget;
    // await the invoice's emailedAt claim to settle instead of sleeping.
    await vi.waitFor(async () => {
      const inv = await prisma.invoice.findUnique({ where: { orderId } });
      expect(inv.emailedAt).toBeTruthy();
    });
    // finalizePaidPayment also fires a best-effort order-confirmation email
    // through the same mocked transporter, so assert on invoice-specific
    // EmailLog rows rather than the raw sendMail call count.
    const emailLogs = await prisma.emailLog.findMany({ where: { orderId, type: "INVOICE" } });
    expect(emailLogs).toHaveLength(1);
    const invoiceSendCalls = sendMailMock.mock.calls.filter(([args]) => String(args?.subject || "").includes("Invoice"));
    expect(invoiceSendCalls).toHaveLength(1);
  });
});

describe("invoice snapshot immutability", () => {
  it("does not change already-created snapshot fields when order/product/settings change later", async () => {
    const { orderId } = await placeOrder({ quantity: 3 });
    await markOrderPaidDirect(orderId);
    const created = await ensureInvoiceForOrder(orderId);
    const originalSnapshot = {
      items: JSON.parse(JSON.stringify(created.itemsSnapshot)),
      company: JSON.parse(JSON.stringify(created.companySnapshot)),
      tax: JSON.parse(JSON.stringify(created.taxSnapshot)),
      totalAmount: created.totalAmount.toString(),
      customerName: created.customerName,
    };

    // Mutate everything the snapshot could have been derived from.
    await prisma.order.update({ where: { id: orderId }, data: { subtotal: 999999, customerName: "Changed Name" } });
    await updateInvoiceSettings({ ...(await getInvoiceSettings()), legalName: "A Totally Different Company", nextInvoiceNumber: 500 });

    const reloaded = await prisma.invoice.findUnique({ where: { id: created.id } });
    expect(JSON.parse(JSON.stringify(reloaded.itemsSnapshot))).toEqual(originalSnapshot.items);
    expect(JSON.parse(JSON.stringify(reloaded.companySnapshot))).toEqual(originalSnapshot.company);
    expect(JSON.parse(JSON.stringify(reloaded.taxSnapshot))).toEqual(originalSnapshot.tax);
    expect(reloaded.totalAmount.toString()).toBe(originalSnapshot.totalAmount);
    expect(reloaded.customerName).toBe(originalSnapshot.customerName);

    // Calling ensureInvoiceForOrder again must not regenerate/renumber either.
    const again = await ensureInvoiceForOrder(orderId);
    expect(again.id).toBe(created.id);
    expect(again.invoiceNumber).toBe(created.invoiceNumber);
  });
});

describe("invoice PDF generation", () => {
  it("generates a PDF at invoice creation time", async () => {
    const { orderId } = await placeOrder();
    await markOrderPaidDirect(orderId);
    const invoice = await ensureInvoiceForOrder(orderId);
    expect(invoice.pdfStorageKey).toBeTruthy();
    const file = await readInvoicePdf(invoice.pdfStorageKey);
    expect(file).toBeTruthy();
    expect(file.size).toBeGreaterThan(0);
  });

  it("regenerateInvoicePdf rewrites the PDF file for an existing invoice", async () => {
    const { orderId } = await placeOrder();
    await markOrderPaidDirect(orderId);
    const invoice = await ensureInvoiceForOrder(orderId);
    const before = await prisma.invoice.findUnique({ where: { id: invoice.id } });

    await new Promise((r) => setTimeout(r, 5)); // ensure updatedAt can tick forward
    const regenerated = await regenerateInvoicePdf(invoice.id);

    expect(regenerated.pdfStorageKey).toBeTruthy();
    expect(new Date(regenerated.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(before.updatedAt).getTime());
    const file = await readInvoicePdf(regenerated.pdfStorageKey);
    expect(file).toBeTruthy();
  });

  it("a PDF write failure is retryable and does not create a second invoice or change the invoice number", async () => {
    const { orderId } = await placeOrder();
    await markOrderPaidDirect(orderId);

    writeFailuresRemaining = 1;
    await expect(ensureInvoiceForOrder(orderId)).rejects.toThrow();

    const invoices = await prisma.invoice.findMany({ where: { orderId } });
    expect(invoices).toHaveLength(1);
    const invoiceNumber = invoices[0].invoiceNumber;
    expect(invoices[0].pdfStorageKey).toBeNull();

    // Retry: PDF write succeeds this time via the explicit regenerate path.
    const regenerated = await regenerateInvoicePdf(invoices[0].id);
    expect(regenerated.pdfStorageKey).toBeTruthy();

    // Calling ensureInvoiceForOrder again must not create a second invoice
    // or renumber the existing one.
    const again = await ensureInvoiceForOrder(orderId);
    expect(again.id).toBe(invoices[0].id);
    expect(again.invoiceNumber).toBe(invoiceNumber);
    const allInvoices = await prisma.invoice.findMany({ where: { orderId } });
    expect(allInvoices).toHaveLength(1);
  });
});

describe("invoice email idempotency and resend", () => {
  it("auto-sends the invoice email only once; duplicate calls are safe no-ops", async () => {
    const { orderId } = await placeOrder();
    await markOrderPaidDirect(orderId);
    const invoice = await ensureInvoiceForOrder(orderId);

    const first = await sendInvoiceEmail(invoice.id);
    expect(first.sent).toBe(true);
    const second = await sendInvoiceEmail(invoice.id);
    expect(second.sent).toBe(false);
    expect(second.reason).toBe("already_emailed");

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const logs = await prisma.emailLog.findMany({ where: { invoiceId: invoice.id, type: "INVOICE" } });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("SENT");

    const reloaded = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(reloaded.emailedAt).toBeTruthy();
  });

  it("is safe under concurrent auto-send attempts (only one send wins the claim)", async () => {
    const { orderId } = await placeOrder();
    await markOrderPaidDirect(orderId);
    const invoice = await ensureInvoiceForOrder(orderId);

    const results = await Promise.all(Array.from({ length: 5 }, () => sendInvoiceEmail(invoice.id)));
    expect(results.filter((r) => r.sent).length).toBe(1);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it("admin manual resend bypasses the auto-send claim and can be repeated", async () => {
    const { orderId } = await placeOrder();
    await markOrderPaidDirect(orderId);
    const invoice = await ensureInvoiceForOrder(orderId);
    await sendInvoiceEmail(invoice.id); // auto-send consumes the claim

    const admin = await seedTestAdmin();
    const resend1 = await sendInvoiceEmail(invoice.id, { resend: true, adminId: admin.id });
    const resend2 = await sendInvoiceEmail(invoice.id, { resend: true, adminId: admin.id });
    expect(resend1.sent).toBe(true);
    expect(resend2.sent).toBe(true);

    expect(sendMailMock).toHaveBeenCalledTimes(3); // 1 auto + 2 resends

    const resendLogs = await prisma.emailLog.findMany({ where: { invoiceId: invoice.id, type: "INVOICE_RESEND" } });
    expect(resendLogs).toHaveLength(2);
    const auditLogs = await prisma.adminAuditLog.findMany({ where: { adminId: admin.id, action: "INVOICE_RESEND" } });
    expect(auditLogs).toHaveLength(2);
  });

  it("admin resend via HTTP route records EmailLog and AdminAuditLog", async () => {
    const { orderId } = await placeOrder();
    await markOrderPaidDirect(orderId);
    const invoice = await ensureInvoiceForOrder(orderId);
    const token = await getAdminToken();

    const res = await request(app).post(`/api/admin/invoices/${invoice.id}/resend`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.sent).toBe(true);

    const resendLogs = await prisma.emailLog.findMany({ where: { invoiceId: invoice.id, type: "INVOICE_RESEND" } });
    expect(resendLogs).toHaveLength(1);
  });

  it("an email send failure records EmailLog FAILED, resets emailedAt so auto-send can retry, and admin resend still works", async () => {
    const { orderId } = await placeOrder();
    await markOrderPaidDirect(orderId);
    const invoice = await ensureInvoiceForOrder(orderId);

    sendMailMock.mockRejectedValueOnce(new Error("smtp temporarily down"));
    const failed = await sendInvoiceEmail(invoice.id);
    expect(failed.sent).toBe(false);
    expect(failed.reason).toBe("send_failed");

    const failLog = await prisma.emailLog.findFirst({ where: { invoiceId: invoice.id, status: "FAILED" } });
    expect(failLog).toBeTruthy();

    const afterFailure = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(afterFailure.emailedAt).toBeNull(); // claim released so auto-send can retry
    // Invoice itself remains valid/issued.
    expect(afterFailure.invoiceNumber).toBe(invoice.invoiceNumber);

    // Retry succeeds now that the mock resolves normally again.
    const retried = await sendInvoiceEmail(invoice.id);
    expect(retried.sent).toBe(true);

    // Admin resend works regardless of the earlier failure/claim state.
    const admin = await seedTestAdmin();
    const resend = await sendInvoiceEmail(invoice.id, { resend: true, adminId: admin.id });
    expect(resend.sent).toBe(true);
  });
});

describe("invoice access control", () => {
  it("denies a customer access to another customer's invoice", async () => {
    const customerA = await registerCustomer(app, { email: "a-inv@test.local" });
    const customerB = await registerCustomer(app, { email: "b-inv@test.local" });
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });

    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerA.accessToken}`)
      .send({ customer: { name: "A", email: "a-inv@test.local", phone: "9876543210" }, shippingAddress: VALID_ADDRESS, items: [{ slug: product.slug, quantity: 1 }] });
    const orderId = orderRes.body.data.orderId;
    await markOrderPaidDirect(orderId);
    const invoice = await ensureInvoiceForOrder(orderId);

    await expect(assertCustomerInvoice(customerB.customer.id, invoice.id)).rejects.toThrow();
    await expect(assertCustomerInvoice(customerA.customer.id, invoice.id)).resolves.toBeTruthy();

    const httpAsB = await request(app).get(`/api/account/invoices/${invoice.id}/download`).set("Authorization", `Bearer ${customerB.accessToken}`);
    expect(httpAsB.status).toBe(404);
    const httpAsA = await request(app).get(`/api/account/invoices/${invoice.id}/download`).set("Authorization", `Bearer ${customerA.accessToken}`);
    expect(httpAsA.status).toBe(200);
  });

  it("protects guest invoice access with the order's access token", async () => {
    const { orderId, orderNumber, accessToken } = await placeOrder();
    await markOrderPaidDirect(orderId);
    const invoice = await ensureInvoiceForOrder(orderId);

    await expect(assertGuestInvoice(orderNumber, "0".repeat(48), invoice.id)).rejects.toThrow();
    await expect(assertGuestInvoice(orderNumber, accessToken, invoice.id)).resolves.toBeTruthy();

    const wrongTokenRes = await request(app).post(`/api/orders/invoices/${invoice.id}/download`).send({ orderNumber, accessToken: "0".repeat(48) });
    expect(wrongTokenRes.status).toBe(404);
    const rightTokenRes = await request(app).post(`/api/orders/invoices/${invoice.id}/download`).send({ orderNumber, accessToken });
    expect(rightTokenRes.status).toBe(200);
  });
});

describe("COD invoice creation", () => {
  it("creates an invoice at the configured codInvoiceAt status (CONFIRMED by default)", async () => {
    await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [], codSupported: true } });
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });

    const res = await request(app)
      .post("/api/orders")
      .send({ customer: VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items: [{ slug: product.slug, quantity: 1 }], paymentMethod: "cod" });
    expect(res.status).toBe(201);

    const invoice = await prisma.invoice.findUnique({ where: { orderId: res.body.data.orderId } });
    expect(invoice).toBeTruthy();
    expect(invoice.pdfStorageKey).toBeTruthy();
  });

  it("creates an invoice at SHIPPED when codInvoiceAt is configured to SHIPPED", async () => {
    await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [], codSupported: true } });
    await updateInvoiceSettings({ ...(await getInvoiceSettings()), codInvoiceAt: "SHIPPED" });
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });

    const res = await request(app)
      .post("/api/orders")
      .send({ customer: VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items: [{ slug: product.slug, quantity: 1 }], paymentMethod: "cod" });
    const orderId = res.body.data.orderId;

    // No invoice yet at CONFIRMED since codInvoiceAt is now SHIPPED.
    expect(await prisma.invoice.findUnique({ where: { orderId } })).toBeNull();

    const token = await getAdminToken();
    await request(app).patch(`/api/admin/orders/${orderId}/status`).set("Authorization", `Bearer ${token}`).send({ status: "PROCESSING" });
    await request(app).patch(`/api/admin/orders/${orderId}/status`).set("Authorization", `Bearer ${token}`).send({ status: "SHIPPED" });

    const invoice = await prisma.invoice.findUnique({ where: { orderId } });
    expect(invoice).toBeTruthy();
  });
});

describe("invoice creation regardless of item type (shipment eligibility)", () => {
  it("creates an invoice for a PDF-only (digital) order", async () => {
    const book = await seedTestBookWithFormats({ slug: "inv-pdf-book", formats: { PDF: { price: 250 } } });
    const orderRes = await request(app)
      .post("/api/orders")
      .send({ customer: VALID_CUSTOMER, items: [{ slug: book.slug, bookFormat: "PDF", quantity: 1 }] });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.data.orderId;
    const payment = await prisma.payment.findFirst({ where: { orderId } });
    await prisma.payment.update({ where: { id: payment.id }, data: { providerOrderId: `rp_${payment.id}` } });

    await finalizePaidPayment({ providerOrderId: `rp_${payment.id}`, providerPaymentId: "pay_pdf", method: "card" });

    const invoice = await prisma.invoice.findUnique({ where: { orderId } });
    expect(invoice).toBeTruthy();
    expect(invoice.shippingAddress).toBeNull();
  });

  it("creates an invoice for a mixed physical + digital cart", async () => {
    const book = await seedTestBookWithFormats({ slug: "inv-mixed-book", formats: { PHYSICAL: { price: 400, stockQuantity: 5 }, PDF: { price: 250 } } });
    const orderRes = await request(app)
      .post("/api/orders")
      .send({
        customer: VALID_CUSTOMER,
        shippingAddress: VALID_ADDRESS,
        items: [
          { slug: book.slug, bookFormat: "PDF", quantity: 1 },
          { slug: book.slug, bookFormat: "PHYSICAL", quantity: 1 },
        ],
      });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.data.orderId;
    const payment = await prisma.payment.findFirst({ where: { orderId } });
    await prisma.payment.update({ where: { id: payment.id }, data: { providerOrderId: `rp_${payment.id}` } });

    await finalizePaidPayment({ providerOrderId: `rp_${payment.id}`, providerPaymentId: "pay_mixed", method: "card" });

    const invoice = await prisma.invoice.findUnique({ where: { orderId } });
    expect(invoice).toBeTruthy();
    expect(invoice.itemsSnapshot).toHaveLength(2);
    expect(invoice.shippingAddress).toBeTruthy();
  });
});

describe("totals/tax calculation correctness", () => {
  async function taxSettingsBase(overrides = {}) {
    return updateInvoiceSettings({ ...(await getInvoiceSettings()), gstEnabled: true, defaultTaxRate: 18, gstin: "29ABCDE1234F1Z5", pan: "ABCDE1234F", state: "Karnataka", stateCode: "29", ...overrides });
  }

  it("applies no tax split when GST is disabled", async () => {
    await updateInvoiceSettings({ ...(await getInvoiceSettings()), gstEnabled: false });
    const { orderId } = await placeOrder({ quantity: 2 });
    await markOrderPaidDirect(orderId);
    const invoice = await ensureInvoiceForOrder(orderId);
    expect(invoice.taxSnapshot.enabled).toBe(false);
    expect(Number(invoice.taxSnapshot.cgstAmount)).toBe(0);
    expect(Number(invoice.taxSnapshot.sgstAmount)).toBe(0);
    expect(Number(invoice.taxSnapshot.igstAmount)).toBe(0);
  });

  it("splits CGST/SGST for an intra-state order when GST is enabled", async () => {
    await taxSettingsBase();
    // Product price 500 x qty 2 = 1000 taxable value @ 18% = 180 tax.
    const { orderId } = await placeOrder({ quantity: 2, shippingAddress: { ...VALID_ADDRESS, state: "Karnataka" } });
    await markOrderPaidDirect(orderId);
    const invoice = await ensureInvoiceForOrder(orderId);

    expect(invoice.taxSnapshot.enabled).toBe(true);
    expect(Number(invoice.taxSnapshot.igstAmount)).toBe(0);
    expect(Number(invoice.taxSnapshot.cgstAmount)).toBeCloseTo(90, 2);
    expect(Number(invoice.taxSnapshot.sgstAmount)).toBeCloseTo(90, 2);
    expect(Number(invoice.taxAmount)).toBeCloseTo(180, 2);
  });

  it("applies IGST (no CGST/SGST split) for an inter-state order when GST is enabled", async () => {
    await taxSettingsBase(); // company/settings state is Karnataka
    const { orderId } = await placeOrder({ quantity: 2, shippingAddress: { ...VALID_ADDRESS, state: "Maharashtra", city: "Mumbai", postalCode: "400001" } });
    await markOrderPaidDirect(orderId);
    const invoice = await ensureInvoiceForOrder(orderId);

    expect(invoice.taxSnapshot.enabled).toBe(true);
    expect(Number(invoice.taxSnapshot.cgstAmount)).toBe(0);
    expect(Number(invoice.taxSnapshot.sgstAmount)).toBe(0);
    expect(Number(invoice.taxSnapshot.igstAmount)).toBeCloseTo(180, 2);
    expect(Number(invoice.taxAmount)).toBeCloseTo(180, 2);
  });
});

describe("invoice generation lifecycle race (regression for the awaited-invoice fix)", () => {
  it("the invoice row exists synchronously right after a COD order request returns, with no sleep/wait", async () => {
    await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [], codSupported: true } });
    const product = await seedTestProduct({ price: 500, stockQuantity: 10 });

    const res = await request(app)
      .post("/api/orders")
      .send({ customer: VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items: [{ slug: product.slug, quantity: 1 }], paymentMethod: "cod" });
    expect(res.status).toBe(201);

    // No sleep/setTimeout: if invoice persistence were still a detached,
    // un-awaited promise, this immediate read would frequently find nothing
    // (or race a subsequent teardown into an Invoice_orderId_fkey violation).
    const invoice = await prisma.invoice.findUnique({ where: { orderId: res.body.data.orderId } });
    expect(invoice).toBeTruthy();

    // Simulate a fast test-teardown-style delete happening immediately after
    // the HTTP response returns; this must not race the (already-completed)
    // invoice write into a foreign-key violation.
    await expect(resetDb()).resolves.not.toThrow();
  });

  it("the invoice row exists synchronously right after a Razorpay payment verification returns", async () => {
    const { orderId } = await placeOrder();
    const payment = await prisma.payment.findFirst({ where: { orderId } });
    await prisma.payment.update({ where: { id: payment.id }, data: { providerOrderId: `rp_${payment.id}` } });

    await finalizePaidPayment({ providerOrderId: `rp_${payment.id}`, providerPaymentId: "pay_race_regression", method: "card" });

    const invoice = await prisma.invoice.findUnique({ where: { orderId } });
    expect(invoice).toBeTruthy();

    await expect(resetDb()).resolves.not.toThrow();
  });
});
