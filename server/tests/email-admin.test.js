import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";

// SMTP is unconfigured by default in the test env (.env.test has SMTP_HOST=""),
// so we flip it on here and mock nodemailer at the network boundary, the same
// pattern used in email.test.js and invoice.test.js.
process.env.SMTP_HOST = "smtp.test.local";

const sendMailMock = vi.fn(async () => ({ messageId: "mock-message-id" }));
const verifyMock = vi.fn(async () => true);
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: (...args) => sendMailMock(...args),
      verify: (...args) => verifyMock(...args),
    }),
  },
}));

const { createApp } = await import("../src/app.js");
const { prisma } = await import("../src/lib/prisma.js");
const { env } = await import("../src/config/env.js");
const { resetDb, seedTestAdmin, seedTestProduct, VALID_ADDRESS } = await import("./helpers.js");
const { sendInvoiceEmail } = await import("../src/modules/email/email.service.js");

const app = createApp();

async function loginAdmin(role = "SUPER_ADMIN") {
  await seedTestAdmin({ role });
  const res = await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password });
  return res.body.data.accessToken;
}

beforeEach(async () => {
  await resetDb();
  sendMailMock.mockClear();
  verifyMock.mockClear();
  sendMailMock.mockImplementation(async () => ({ messageId: "mock-message-id" }));
  verifyMock.mockImplementation(async () => true);
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("GET /api/admin/email/status", () => {
  it("reports SMTP as configured with host/port/sender but never the password or user", async () => {
    const token = await loginAdmin();
    const res = await request(app).get("/api/admin/email/status").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.configured).toBe(true);
    expect(res.body.data.host).toBe("smtp.test.local");
    expect(res.body.data).not.toHaveProperty("pass");
    expect(res.body.data).not.toHaveProperty("password");
    expect(JSON.stringify(res.body)).not.toContain(env.smtp?.pass || "unlikely-secret-marker");
  });

  it("requires admin auth", async () => {
    const res = await request(app).get("/api/admin/email/status");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/email/test", () => {
  it("verifies the transport and sends a safe test message, recording an EmailLog row", async () => {
    const token = await loginAdmin();
    const res = await request(app)
      .post("/api/admin/email/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ recipient: "ops@test.local" });
    expect(res.status).toBe(200);
    expect(res.body.data.sent).toBe(true);
    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0];
    expect(call.to).toBe("ops@test.local");

    const log = await prisma.emailLog.findFirst({ where: { type: "TEST_EMAIL" } });
    expect(log.status).toBe("SENT");
    expect(log.recipient).toBe("ops@test.local");
  });

  it("returns a sanitized failure without leaking provider error internals when the connection cannot be verified", async () => {
    verifyMock.mockRejectedValueOnce(new Error("ECONNREFUSED 1.2.3.4:587 secret-detail-should-not-leak"));
    const token = await loginAdmin();
    const res = await request(app)
      .post("/api/admin/email/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ recipient: "ops@test.local" });
    expect(res.status).toBe(200);
    expect(res.body.data.sent).toBe(false);
    expect(res.body.data.reason).toBe("connection_failed");
    expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(res.body)).not.toContain("secret-detail-should-not-leak");
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("rejects a non-admin caller", async () => {
    const res = await request(app).post("/api/admin/email/test").send({ recipient: "ops@test.local" });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid recipient address", async () => {
    const token = await loginAdmin();
    const res = await request(app)
      .post("/api/admin/email/test")
      .set("Authorization", `Bearer ${token}`)
      .send({ recipient: "not-an-email" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/admin/email/logs and /health", () => {
  it("lists EmailLog rows and reports failed count + recent failures", async () => {
    const token = await loginAdmin();
    const product = await seedTestProduct({ slug: "email-admin-product", stockQuantity: 5 });
    const order = await request(app)
      .post("/api/orders")
      .send({
        items: [{ slug: product.slug, quantity: 1 }],
        customer: { name: "Log Buyer", email: "log-buyer@test.local", phone: "9876543210" },
        shippingAddress: VALID_ADDRESS,
      });
    const orderId = order.body.data.orderId;
    await prisma.emailLog.create({ data: { type: "ORDER_CONFIRMATION", recipient: "log-buyer@test.local", orderId, status: "FAILED", failureMessage: "simulated failure" } });

    const logsRes = await request(app).get("/api/admin/email/logs").set("Authorization", `Bearer ${token}`);
    expect(logsRes.status).toBe(200);
    expect(logsRes.body.data.items.length).toBeGreaterThan(0);

    const healthRes = await request(app).get("/api/admin/email/health").set("Authorization", `Bearer ${token}`);
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.data.failedCount).toBeGreaterThanOrEqual(1);
    expect(healthRes.body.data.recentFailures.some((f) => f.recipient === "log-buyer@test.local")).toBe(true);
  });
});

describe("POST /api/admin/email/logs/:id/retry", () => {
  it("resends a failed invoice email explicitly and marks the new attempt SENT", async () => {
    const token = await loginAdmin();
    const product = await seedTestProduct({ slug: "email-retry-product", stockQuantity: 5 });
    const order = await request(app)
      .post("/api/orders")
      .send({
        items: [{ slug: product.slug, quantity: 1 }],
        customer: { name: "Retry Buyer", email: "retry-buyer@test.local", phone: "9876543210" },
        shippingAddress: VALID_ADDRESS,
      });
    const orderId = order.body.data.orderId;
    const invoice = await prisma.invoice.create({
      data: {
        orderId,
        invoiceNumber: `INV-RETRY-${Date.now()}`,
        customerName: "Retry Buyer",
        customerEmail: "retry-buyer@test.local",
        billingAddress: { fullName: "Retry Buyer", addressLine1: "1 Test St", city: "Test City", state: "TS", postalCode: "000000", country: "IN" },
        subtotal: 500,
        totalAmount: 500,
        companySnapshot: { name: "Aadya Society" },
        itemsSnapshot: [{ name: "Test item", quantity: 1, lineTotal: 500 }],
      },
    });

    // Simulate a prior failed send.
    sendMailMock.mockRejectedValueOnce(new Error("simulated smtp failure"));
    await sendInvoiceEmail(invoice.id, { resend: true });
    const failedLog = await prisma.emailLog.findFirst({ where: { invoiceId: invoice.id, status: "FAILED" } });
    expect(failedLog).toBeTruthy();

    sendMailMock.mockClear();
    sendMailMock.mockImplementation(async () => ({ messageId: "retry-message-id" }));

    const retryRes = await request(app)
      .post(`/api/admin/email/logs/${failedLog.id}/retry`)
      .set("Authorization", `Bearer ${token}`);
    expect(retryRes.status).toBe(200);
    expect(retryRes.body.data.sent).toBe(true);
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const auditRow = await prisma.adminAuditLog.findFirst({ where: { action: "INVOICE_RESEND" } });
    expect(auditRow).toBeTruthy();
  });

  it("rejects retrying a log entry that is not in a failed/skipped state", async () => {
    const token = await loginAdmin();
    const log = await prisma.emailLog.create({ data: { type: "ORDER_CONFIRMATION", recipient: "x@test.local", status: "SENT" } });
    const res = await request(app).post(`/api/admin/email/logs/${log.id}/retry`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("404s for an unknown log id", async () => {
    const token = await loginAdmin();
    const res = await request(app).post("/api/admin/email/logs/00000000-0000-0000-0000-000000000000/retry").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("requires admin auth to retry", async () => {
    const log = await prisma.emailLog.create({ data: { type: "ORDER_CONFIRMATION", recipient: "x@test.local", status: "FAILED" } });
    const res = await request(app).post(`/api/admin/email/logs/${log.id}/retry`);
    expect(res.status).toBe(401);
  });
});
