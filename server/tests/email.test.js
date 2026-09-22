import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";

// AUTOMATED EMAIL CONTENT TESTED via a mocked nodemailer transport.
// REAL SMTP DELIVERY IS NOT TESTED — no live SMTP credentials exist in this
// environment (see .env.test, where SMTP_HOST is blank).
const sendMailMock = vi.fn().mockResolvedValue({ messageId: "test" });
vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: sendMailMock })) },
}));

const { createApp } = await import("../src/app.js");
const { prisma } = await import("../src/lib/prisma.js");
const { sendOrderConfirmationEmail } = await import("../src/modules/email/email.service.js");
const { resetDb, registerCustomer, seedTestProduct, VALID_ADDRESS } = await import("./helpers.js");

const app = createApp();

beforeEach(async () => {
  await resetDb();
  sendMailMock.mockClear();
  vi.stubEnv("SMTP_HOST", "smtp.test.local");
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
  vi.unstubAllEnvs();
});

describe("password reset email", () => {
  it("sends to the correct recipient with the correct subject, reset URL, and expiry wording", async () => {
    const { customer, credentials } = await registerCustomer(app, { email: "reset-target@test.local" });
    await request(app).post("/api/auth/forgot-password").send({ email: credentials.email });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0];
    expect(call.to).toBe(customer.email);
    expect(call.subject).toBe("Reset your Aadya Society password");
    expect(call.html).toContain("/reset-password?token=");
    expect(call.html).toContain("expires in one hour");
  });

  it("does not send an email for an unknown address (enumeration-safe)", async () => {
    await request(app).post("/api/auth/forgot-password").send({ email: "nobody@test.local" });
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});

describe("order confirmation email", () => {
  it("includes an account order CTA for an authenticated order", async () => {
    const { accessToken, customer } = await registerCustomer(app, { email: "buyer@test.local" });
    const product = await seedTestProduct({ slug: "email-product", stockQuantity: 10 });
    const order = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ items: [{ slug: product.slug, quantity: 1 }], customer: { name: customer.name, email: customer.email, phone: "9876543210" }, shippingAddress: VALID_ADDRESS });
    sendMailMock.mockClear();
    await sendOrderConfirmationEmail(order.body.data.orderId);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0];
    expect(call.to).toBe(customer.email);
    expect(call.subject).toContain(order.body.data.orderNumber);
    expect(call.html).toContain(`/account/orders/${encodeURIComponent(order.body.data.orderNumber)}`);
  });

  it("a guest order's confirmation email has no account CTA (documents current behavior — see report: no guest confirmation-link CTA exists either, a pre-existing gap)", async () => {
    const product = await seedTestProduct({ slug: "guest-email-product", stockQuantity: 10 });
    const order = await request(app)
      .post("/api/orders")
      .send({ items: [{ slug: product.slug, quantity: 1 }], customer: { name: "Guest", email: "guest-email@test.local", phone: "9876543210" }, shippingAddress: VALID_ADDRESS });
    sendMailMock.mockClear();
    await sendOrderConfirmationEmail(order.body.data.orderId);
    const call = sendMailMock.mock.calls[0][0];
    expect(call.to).toBe("guest-email@test.local");
    expect(call.html).not.toContain("/account/orders/");
  });
});

describe("SMTP not configured", () => {
  it("forgot-password still returns success and never throws when SMTP is unconfigured", async () => {
    vi.stubEnv("SMTP_HOST", "");
    const { credentials } = await registerCustomer(app, { email: "no-smtp@test.local" });
    const res = await request(app).post("/api/auth/forgot-password").send({ email: credentials.email });
    expect(res.status).toBe(200);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
