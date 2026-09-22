import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb, seedTestAdmin } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("admin auth", () => {
  it("logs in with correct credentials", async () => {
    await seedTestAdmin();
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({ email: env.admin.email, password: env.admin.password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf("string");
    expect(res.body.data.admin.email).toBe(env.admin.email.toLowerCase());
    expect(res.headers["set-cookie"]?.[0]).toMatch(/admin_refresh_token=/);
  });

  it("rejects an incorrect password", async () => {
    await seedTestAdmin();
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({ email: env.admin.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects a login for an unknown email with the same generic message", async () => {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({ email: "nobody@example.com", password: "whatever" });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Invalid email or password");
  });

  it("rejects a deactivated admin", async () => {
    await seedTestAdmin({ isActive: false });
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({ email: env.admin.email, password: env.admin.password });

    expect(res.status).toBe(403);
  });

  it("blocks protected routes without a token", async () => {
    const res = await request(app).get("/api/admin/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current admin for a valid token", async () => {
    await seedTestAdmin();
    const login = await request(app)
      .post("/api/admin/auth/login")
      .send({ email: env.admin.email, password: env.admin.password });

    const res = await request(app)
      .get("/api/admin/auth/me")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.admin.email).toBe(env.admin.email.toLowerCase());
  });

  it("blocks admin routes with a garbage token", async () => {
    const res = await request(app).get("/api/admin/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("checks password before the active-status flag: a deactivated admin with a wrong password still gets the generic 401, not 403", async () => {
    await seedTestAdmin({ isActive: false });
    const res = await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: "wrong-password" });
    expect(res.status).toBe(401);
  });
});

describe("admin refresh / logout", () => {
  it("issues a new access token on a valid refresh", async () => {
    await seedTestAdmin();
    const agent = request.agent(app);
    await agent.post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password });
    const res = await agent.post("/api/admin/auth/refresh");
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf("string");
  });

  it("rejects a refresh with no cookie", async () => {
    const res = await request(app).post("/api/admin/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("rejects a refresh for a deactivated admin", async () => {
    const admin = await seedTestAdmin();
    const agent = request.agent(app);
    await agent.post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password });
    await prisma.adminUser.update({ where: { id: admin.id }, data: { isActive: false } });
    const res = await agent.post("/api/admin/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("logout clears the cookie, but admin refresh is a stateless JWT with no server-side revocation list — the same refresh token still works after logout (documents a real asymmetry vs. customer refresh, which IS revocable)", async () => {
    await seedTestAdmin();
    const login = await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password });
    const refreshCookie = login.headers["set-cookie"][0];
    await request(app).post("/api/admin/auth/logout");
    const reuseAfterLogout = await request(app).post("/api/admin/auth/refresh").set("Cookie", refreshCookie);
    expect(reuseAfterLogout.status).toBe(200);
  });
});

describe("admin/customer JWT audience isolation", () => {
  it("a customer access token is rejected on an admin route", async () => {
    const customerRegister = await request(app)
      .post("/api/auth/register")
      .send({ name: "Cust", email: "cust-audience@test.local", password: "SafePassword123!", phone: "9876543210" });
    const res = await request(app).get("/api/admin/auth/me").set("Authorization", `Bearer ${customerRegister.body.data.accessToken}`);
    expect(res.status).toBe(401);
  });

  it("an admin access token is rejected on a customer route", async () => {
    await seedTestAdmin();
    const login = await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(res.status).toBe(401);
  });
});
