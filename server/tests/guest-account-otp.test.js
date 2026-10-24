import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";

// Guest checkout -> auto-created account -> one-time email code login -> first password.
// Real SMTP delivery is not exercised: nodemailer is mocked at the network boundary (same as email.test.js).
process.env.SMTP_HOST = "smtp.test.local";

const sendMailMock = vi.fn(async () => ({ messageId: "mock-message-id" }));
const createTransportMock = vi.fn(() => ({ sendMail: (...a) => sendMailMock(...a), verify: async () => true }));
vi.mock("nodemailer", () => ({ default: { createTransport: (...a) => createTransportMock(...a) } }));

const { createApp } = await import("../src/app.js");
const { prisma } = await import("../src/lib/prisma.js");
const { env } = await import("../src/config/env.js");
const { ensureAccountForOrder } = await import("../src/modules/customer-auth/guest-account.service.js");
const { resetDb, seedTestAdmin, seedTestProduct, registerCustomer, VALID_ADDRESS } = await import("./helpers.js");

const app = createApp();

beforeEach(async () => {
  await resetDb();
  sendMailMock.mockClear();
  createTransportMock.mockClear();
});
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

async function createGuestOrder(email = "guest@test.local", name = "Guest Buyer") {
  const product = await seedTestProduct({ slug: `p-${Math.random().toString(36).slice(2, 8)}`, stockQuantity: 10 });
  const res = await request(app)
    .post("/api/orders")
    .send({ items: [{ slug: product.slug, quantity: 1 }], customer: { name, email, phone: "9876543210" }, shippingAddress: VALID_ADDRESS });
  expect(res.status).toBe(201);
  return res.body.data;
}

const lastCode = () => {
  const call = sendMailMock.mock.calls.at(-1)?.[0];
  return call?.html?.match(/>(\d{6})</)?.[1];
};

describe("ensureAccountForOrder", () => {
  it("creates a passwordless account for a guest order and links the order", async () => {
    const created = await createGuestOrder("fresh@test.local", "Fresh Buyer");
    const order = await prisma.order.findUnique({ where: { orderNumber: created.orderNumber } });
    expect(order.customerId).toBeNull();

    const result = await ensureAccountForOrder(order.id);
    expect(result).toMatchObject({ linked: true, created: true });

    const customer = await prisma.customer.findUnique({ where: { email: "fresh@test.local" } });
    expect(customer).toMatchObject({ name: "Fresh Buyer", autoCreated: true, passwordSetAt: null, phone: "9876543210" });
    expect(customer.passwordHash).toBeTruthy();
    expect((await prisma.order.findUnique({ where: { id: order.id } })).customerId).toBe(customer.id);
  });

  it("is idempotent and links to an existing registered account instead of creating a duplicate", async () => {
    await registerCustomer(app, { email: "owner@test.local" });
    const created = await createGuestOrder("owner@test.local");
    const order = await prisma.order.findUnique({ where: { orderNumber: created.orderNumber } });
    const first = await ensureAccountForOrder(order.id);
    expect(first).toMatchObject({ linked: true, created: false });
    const again = await ensureAccountForOrder(order.id);
    expect(again).toMatchObject({ linked: true, created: false });
    expect(await prisma.customer.count({ where: { email: "owner@test.local" } })).toBe(1);
    const existing = await prisma.customer.findUnique({ where: { email: "owner@test.local" } });
    expect(existing.autoCreated).toBe(false);
    expect(existing.passwordSetAt).not.toBeNull();
  });

  it("does not link orders to a deactivated account", async () => {
    await registerCustomer(app, { email: "off@test.local" });
    await prisma.customer.update({ where: { email: "off@test.local" }, data: { isActive: false } });
    const created = await createGuestOrder("off@test.local");
    const order = await prisma.order.findUnique({ where: { orderNumber: created.orderNumber } });
    expect(await ensureAccountForOrder(order.id)).toMatchObject({ linked: false });
  });
});

describe("one-time email login code", () => {
  async function guestAccount(email = "guest@test.local") {
    const created = await createGuestOrder(email);
    const order = await prisma.order.findUnique({ where: { orderNumber: created.orderNumber } });
    await ensureAccountForOrder(order.id);
    sendMailMock.mockClear(); // the welcome email for the new account is covered in email-automation.test.js
    return prisma.customer.findUnique({ where: { email } });
  }

  it("emails a 6-digit code, logs in with it once, and asks for a first password", async () => {
    const customer = await guestAccount();
    const req = await request(app).post("/api/auth/otp/request").send({ email: "guest@test.local" });
    expect(req.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0].to).toBe("guest@test.local");
    const code = lastCode();
    expect(code).toMatch(/^\d{6}$/);
    // only a hash is stored, never the code itself
    const row = await prisma.customerLoginOtp.findFirst({ where: { customerId: customer.id } });
    expect(row.codeHash).not.toContain(code);

    const ok = await request(app).post("/api/auth/otp/verify").send({ email: "guest@test.local", code });
    expect(ok.status).toBe(200);
    expect(ok.body.data.accessToken).toBeTruthy();
    expect(ok.body.data.customer).toMatchObject({ email: "guest@test.local", requiresPasswordSetup: true });
    expect((await prisma.customer.findUnique({ where: { id: customer.id } })).emailVerifiedAt).not.toBeNull();

    const reuse = await request(app).post("/api/auth/otp/verify").send({ email: "guest@test.local", code });
    expect(reuse.status).toBe(401);
  });

  it("sets the first password with the OTP session, then password login works and a second set is refused", async () => {
    await guestAccount();
    await request(app).post("/api/auth/otp/request").send({ email: "guest@test.local" });
    const login = await request(app).post("/api/auth/otp/verify").send({ email: "guest@test.local", code: lastCode() });
    const token = login.body.data.accessToken;

    const bad = await request(app).post("/api/account/set-password").set("Authorization", `Bearer ${token}`).send({ newPassword: "short", confirmPassword: "short" });
    expect(bad.status).toBe(400);

    const set = await request(app).post("/api/account/set-password").set("Authorization", `Bearer ${token}`).send({ newPassword: "Sturdy-pass-123", confirmPassword: "Sturdy-pass-123" });
    expect(set.status).toBe(200);
    expect(set.body.data.customer.requiresPasswordSetup).toBe(false);

    const pw = await request(app).post("/api/auth/login").send({ email: "guest@test.local", password: "Sturdy-pass-123" });
    expect(pw.status).toBe(200);
    expect(pw.body.data.customer.requiresPasswordSetup).toBe(false);

    const again = await request(app).post("/api/account/set-password").set("Authorization", `Bearer ${pw.body.data.accessToken}`).send({ newPassword: "Another-pass-456", confirmPassword: "Another-pass-456" });
    expect(again.status).toBe(400);
  });

  it("answers identically for unknown emails and sends nothing", async () => {
    const res = await request(app).post("/api/auth/otp/request").send({ email: "nobody@test.local" });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/if an account exists/i);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("rejects wrong codes, locks the code after 5 wrong attempts, and enforces a resend cooldown", async () => {
    await guestAccount();
    await request(app).post("/api/auth/otp/request").send({ email: "guest@test.local" });
    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i += 1) {
      const r = await request(app).post("/api/auth/otp/verify").send({ email: "guest@test.local", code: wrong });
      expect(r.status).toBe(401);
    }
    const afterLock = await request(app).post("/api/auth/otp/verify").send({ email: "guest@test.local", code });
    expect(afterLock.status).toBe(401);

    const calls = sendMailMock.mock.calls.length;
    await request(app).post("/api/auth/otp/request").send({ email: "guest@test.local" });
    expect(sendMailMock.mock.calls.length).toBe(calls); // within the 60s cooldown: still 200 but no new email
  });

  it("rejects an expired code", async () => {
    const customer = await guestAccount();
    await request(app).post("/api/auth/otp/request").send({ email: "guest@test.local" });
    const code = lastCode();
    await prisma.customerLoginOtp.updateMany({ where: { customerId: customer.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await request(app).post("/api/auth/otp/verify").send({ email: "guest@test.local", code });
    expect(res.status).toBe(401);
  });

  it("validates the request shape", async () => {
    expect((await request(app).post("/api/auth/otp/verify").send({ email: "a@test.local", code: "12" })).status).toBe(400);
    expect((await request(app).post("/api/auth/otp/request").send({ email: "not-an-email" })).status).toBe(400);
  });
});

describe("Admin-managed SMTP settings", () => {
  async function loginAdmin() {
    await seedTestAdmin({ role: "SUPER_ADMIN" });
    const res = await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password });
    return res.body.data.accessToken;
  }
  const body = { host: "smtp.mail.test", port: 587, encryption: "STARTTLS", user: "orders@shop.test", password: "s3cret-smtp-pass", fromName: "Tushaqsa", fromEmail: "orders@shop.test", replyTo: "help@shop.test", enabled: true };

  it("saves settings encrypted, never returns the password, and keeps it when the field is left blank", async () => {
    const token = await loginAdmin();
    const put = await request(app).put("/api/admin/email/settings").set("Authorization", `Bearer ${token}`).send(body);
    expect(put.status).toBe(200);
    expect(JSON.stringify(put.body)).not.toContain("s3cret-smtp-pass");
    expect(put.body.data).toMatchObject({ saved: true, enabled: true, host: "smtp.mail.test", hasPassword: true, effectiveSource: "admin" });

    const stored = await prisma.integrationCredential.findUnique({ where: { provider_environment: { provider: "SMTP", environment: "DEFAULT" } } });
    expect(stored.encryptedData).not.toContain("s3cret-smtp-pass");

    const keep = await request(app).put("/api/admin/email/settings").set("Authorization", `Bearer ${token}`).send({ ...body, password: "", fromName: "Renamed" });
    expect(keep.status).toBe(200);
    expect(keep.body.data).toMatchObject({ hasPassword: true, fromName: "Renamed" });

    const get = await request(app).get("/api/admin/email/settings").set("Authorization", `Bearer ${token}`);
    expect(JSON.stringify(get.body)).not.toContain("s3cret-smtp-pass");
  });

  it("uses the saved settings for sending (host, auth, sender, reply-to) and can be removed", async () => {
    const token = await loginAdmin();
    await request(app).put("/api/admin/email/settings").set("Authorization", `Bearer ${token}`).send(body);
    const res = await request(app).post("/api/admin/email/test").set("Authorization", `Bearer ${token}`).send({ recipient: "me@test.local" });
    expect(res.body.data.sent).toBe(true);
    const [options, defaults] = createTransportMock.mock.calls.at(-1);
    expect(options).toMatchObject({ host: "smtp.mail.test", port: 587, secure: false, requireTLS: true, auth: { user: "orders@shop.test", pass: "s3cret-smtp-pass" } });
    expect(defaults).toMatchObject({ from: '"Tushaqsa" <orders@shop.test>', replyTo: "help@shop.test" });

    const del = await request(app).delete("/api/admin/email/settings").set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);
    expect(del.body.data.saved).toBe(false);
    expect(del.body.data.effectiveSource).toBe("env"); // SMTP_HOST env fallback is still set in this test file
  });

  it("validates input and requires a super admin", async () => {
    const token = await loginAdmin();
    expect((await request(app).put("/api/admin/email/settings").set("Authorization", `Bearer ${token}`).send({ ...body, host: "bad host!" })).status).toBe(400);
    expect((await request(app).put("/api/admin/email/settings").set("Authorization", `Bearer ${token}`).send({ ...body, fromEmail: "nope" })).status).toBe(400);
    expect((await request(app).put("/api/admin/email/settings").send(body)).status).toBe(401);
  });
});
