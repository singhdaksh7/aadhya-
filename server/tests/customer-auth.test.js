import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";
import { resetDb, seedTestCustomer, registerCustomer, createRawResetToken } from "./helpers.js";

const app = createApp();
const credentials = { name: "Customer Test", email: "customer@test.local", password: "SafePassword123!", phone: "9876543210" };

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("customer auth isolation", () => {
  it("registers, refreshes, and refuses its token on admin routes", async () => {
    const agent = request.agent(app);
    const r = await agent.post("/api/auth/register").send(credentials);
    expect(r.status).toBe(201);
    expect(r.body.data.customer.email).toBe(credentials.email);
    expect(r.headers["set-cookie"][0]).toMatch(/customer_refresh_token/);
    const me = await agent.get("/api/auth/me").set("Authorization", `Bearer ${r.body.data.accessToken}`);
    expect(me.status).toBe(200);
    const admin = await agent.get("/api/admin/auth/me").set("Authorization", `Bearer ${r.body.data.accessToken}`);
    expect(admin.status).toBe(401);
    const refreshed = await agent.post("/api/auth/refresh");
    expect(refreshed.status).toBe(200);
  });

  // The reverse case (admin token on a customer route) is covered in
  // auth.test.js's "admin/customer JWT audience isolation" describe block.
});

describe("register", () => {
  it("registers with valid input and never returns a passwordHash", async () => {
    const res = await request(app).post("/api/auth/register").send(credentials);
    expect(res.status).toBe(201);
    expect(res.body.data.customer.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    expect(res.body.data.refreshToken).toBeUndefined();
  });

  it("normalizes email case on register and login", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...credentials, email: "Customer@Test.LOCAL" });
    expect(res.status).toBe(201);
    expect(res.body.data.customer.email).toBe("customer@test.local");
    const login = await request(app).post("/api/auth/login").send({ email: "CUSTOMER@TEST.LOCAL", password: credentials.password });
    expect(login.status).toBe(200);
  });

  it("rejects a duplicate email, including case-insensitive duplicates", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const dup = await request(app).post("/api/auth/register").send(credentials);
    expect(dup.status).toBe(409);
    const dupCase = await request(app).post("/api/auth/register").send({ ...credentials, email: "CUSTOMER@TEST.LOCAL" });
    expect(dupCase.status).toBe(409);
  });

  it("rejects an invalid email", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...credentials, email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("rejects a weak password (too short, or missing a digit)", async () => {
    const tooShort = await request(app).post("/api/auth/register").send({ ...credentials, email: "a@test.local", password: "short1" });
    expect(tooShort.status).toBe(400);
    const noDigit = await request(app).post("/api/auth/register").send({ ...credentials, email: "b@test.local", password: "NoDigitsHere" });
    expect(noDigit.status).toBe(400);
  });

  it("rejects an invalid phone number", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...credentials, phone: "12345" });
    expect(res.status).toBe(400);
  });
});

describe("login", () => {
  it("logs in with valid credentials", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const res = await request(app).post("/api/auth/login").send({ email: credentials.email, password: credentials.password });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf("string");
  });

  it("rejects a wrong password with a generic message", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const res = await request(app).post("/api/auth/login").send({ email: credentials.email, password: "WrongPassword1" });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password.");
  });

  it("rejects a nonexistent email with the same generic message as a wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "nobody@test.local", password: "WhateverPassword1" });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password.");
  });

  it("rejects an inactive customer", async () => {
    await seedTestCustomer({ email: credentials.email, password: credentials.password, isActive: false });
    const res = await request(app).post("/api/auth/login").send({ email: credentials.email, password: credentials.password });
    expect(res.status).toBe(401);
  });

  it("issues an access token with audience=customer and type=access", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const res = await request(app).post("/api/auth/login").send({ email: credentials.email, password: credentials.password });
    const payload = jwt.verify(res.body.data.accessToken, env.jwt.accessSecret);
    expect(payload.audience).toBe("customer");
    expect(payload.type).toBe("access");
  });
});

describe("refresh", () => {
  it("issues a new access token on valid refresh", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send(credentials);
    const res = await agent.post("/api/auth/refresh");
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf("string");
  });

  it("rotates the refresh session so the old cookie cannot be reused", async () => {
    const agent = request.agent(app);
    const registerRes = await agent.post("/api/auth/register").send(credentials);
    const oldCookie = registerRes.headers["set-cookie"][0];
    const firstRefresh = await agent.post("/api/auth/refresh");
    expect(firstRefresh.status).toBe(200);
    // Replay the original (now-rotated-away) cookie directly.
    const reuse = await request(app).post("/api/auth/refresh").set("Cookie", oldCookie);
    expect(reuse.status).toBe(401);
  });

  it("rejects a refresh after logout (revoked session)", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send(credentials);
    await agent.post("/api/auth/logout");
    const res = await agent.post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("rejects an expired refresh session", async () => {
    const agent = request.agent(app);
    const registerRes = await agent.post("/api/auth/register").send(credentials);
    const customerId = registerRes.body.data.customer.id;
    await prisma.customerRefreshSession.updateMany({ where: { customerId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await agent.post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("rejects a refresh with no cookie at all", async () => {
    const res = await request(app).post("/api/auth/refresh");
    expect(res.status).toBe(401);
  });
});

describe("logout", () => {
  it("revokes the session so a subsequent refresh fails", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send(credentials);
    const out = await agent.post("/api/auth/logout");
    expect(out.status).toBe(200);
    const refreshed = await agent.post("/api/auth/refresh");
    expect(refreshed.status).toBe(401);
  });

  it("does not error when logging out with no session", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
  });
});

describe("me / profile", () => {
  it("returns the current customer for a valid access token", async () => {
    const { accessToken } = await registerCustomer(app, credentials);
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.customer.email).toBe(credentials.email);
  });

  it("rejects /me with no token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("updates the profile name and phone", async () => {
    const { accessToken } = await registerCustomer(app, credentials);
    const res = await request(app)
      .patch("/api/account/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "New Name", phone: "9123456780" });
    expect(res.status).toBe(200);
    expect(res.body.data.customer.name).toBe("New Name");
    expect(res.body.data.customer.phone).toBe("9123456780");
  });
});

describe("change password", () => {
  it("succeeds with the correct current password and revokes existing sessions", async () => {
    const { agent, accessToken } = await registerCustomer(app, credentials);
    const res = await agent
      .post("/api/account/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: credentials.password, newPassword: "NewSafePassword1", confirmPassword: "NewSafePassword1" });
    expect(res.status).toBe(200);
    // The refresh cookie held by this agent belongs to the now-revoked session.
    const refreshed = await agent.post("/api/auth/refresh");
    expect(refreshed.status).toBe(401);
  });

  it("rejects an incorrect current password", async () => {
    const { accessToken } = await registerCustomer(app, credentials);
    const res = await request(app)
      .post("/api/account/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: "WrongPassword1", newPassword: "NewSafePassword1", confirmPassword: "NewSafePassword1" });
    expect(res.status).toBe(401);
  });

  it("rejects a weak new password", async () => {
    const { accessToken } = await registerCustomer(app, credentials);
    const res = await request(app)
      .post("/api/account/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: credentials.password, newPassword: "short1", confirmPassword: "short1" });
    expect(res.status).toBe(400);
  });

  it("rejects a mismatched confirmation", async () => {
    const { accessToken } = await registerCustomer(app, credentials);
    const res = await request(app)
      .post("/api/account/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: credentials.password, newPassword: "NewSafePassword1", confirmPassword: "DifferentPassword1" });
    expect(res.status).toBe(400);
  });

  it("old password stops authenticating and new password works after change", async () => {
    const { accessToken } = await registerCustomer(app, credentials);
    await request(app)
      .post("/api/account/change-password")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ currentPassword: credentials.password, newPassword: "NewSafePassword1", confirmPassword: "NewSafePassword1" });
    const oldLogin = await request(app).post("/api/auth/login").send({ email: credentials.email, password: credentials.password });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post("/api/auth/login").send({ email: credentials.email, password: "NewSafePassword1" });
    expect(newLogin.status).toBe(200);
  });
});

describe("password reset", () => {
  it("forgot-password returns the identical generic response for a known and an unknown email", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const known = await request(app).post("/api/auth/forgot-password").send({ email: credentials.email });
    const unknown = await request(app).post("/api/auth/forgot-password").send({ email: "missing@test.local" });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.data.message).toBe(unknown.body.data.message);
    expect(known.body.data.message).toContain("If an account exists");
  });

  it("does not disclose unknown reset emails", async () => {
    const r = await request(app).post("/api/auth/forgot-password").send({ email: "missing@test.local" });
    expect(r.status).toBe(200);
    expect(r.body.data.message).toContain("If an account exists");
  });

  it("stores only a hashed reset token, never the raw token, and gives it an expiry", async () => {
    const registerRes = await request(app).post("/api/auth/register").send(credentials);
    const customerId = registerRes.body.data.customer.id;
    await request(app).post("/api/auth/forgot-password").send({ email: credentials.email });
    const row = await prisma.passwordResetToken.findFirst({ where: { customerId } });
    expect(row).toBeTruthy();
    expect(row.tokenHash).toHaveLength(64); // sha256 hex
    expect(row.expiresAt).toBeInstanceOf(Date);
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("a valid reset succeeds and revokes existing refresh sessions", async () => {
    const agent = request.agent(app);
    const registerRes = await agent.post("/api/auth/register").send(credentials);
    const customerId = registerRes.body.data.customer.id;
    const token = await createRawResetToken(customerId);
    const res = await request(app).post("/api/auth/reset-password").send({ token, newPassword: "BrandNewPassword1", confirmPassword: "BrandNewPassword1" });
    expect(res.status).toBe(200);
    // Session created at register-time must now be revoked.
    const refreshed = await agent.post("/api/auth/refresh");
    expect(refreshed.status).toBe(401);
    const oldLogin = await request(app).post("/api/auth/login").send({ email: credentials.email, password: credentials.password });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post("/api/auth/login").send({ email: credentials.email, password: "BrandNewPassword1" });
    expect(newLogin.status).toBe(200);
  });

  it("rejects an invalid (unknown) token", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "a".repeat(48), newPassword: "BrandNewPassword1", confirmPassword: "BrandNewPassword1" });
    expect(res.status).toBe(400);
  });

  it("rejects a malformed token (wrong length)", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "tooshort", newPassword: "BrandNewPassword1", confirmPassword: "BrandNewPassword1" });
    expect(res.status).toBe(400);
  });

  it("rejects an expired token", async () => {
    const registerRes = await request(app).post("/api/auth/register").send(credentials);
    const token = await createRawResetToken(registerRes.body.data.customer.id, { expired: true });
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "BrandNewPassword1", confirmPassword: "BrandNewPassword1" });
    expect(res.status).toBe(400);
  });

  it("rejects an already-used token and cannot be reused", async () => {
    const registerRes = await request(app).post("/api/auth/register").send(credentials);
    const token = await createRawResetToken(registerRes.body.data.customer.id);
    const first = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "BrandNewPassword1", confirmPassword: "BrandNewPassword1" });
    expect(first.status).toBe(200);
    const second = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "AnotherPassword2", confirmPassword: "AnotherPassword2" });
    expect(second.status).toBe(400);
  });

  it("rejects a weak new password on reset", async () => {
    const registerRes = await request(app).post("/api/auth/register").send(credentials);
    const token = await createRawResetToken(registerRes.body.data.customer.id);
    const res = await request(app).post("/api/auth/reset-password").send({ token, newPassword: "short1", confirmPassword: "short1" });
    expect(res.status).toBe(400);
  });

  it("rejects a mismatched confirmation on reset", async () => {
    const registerRes = await request(app).post("/api/auth/register").send(credentials);
    const token = await createRawResetToken(registerRes.body.data.customer.id);
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "BrandNewPassword1", confirmPassword: "DifferentPassword1" });
    expect(res.status).toBe(400);
  });
});
