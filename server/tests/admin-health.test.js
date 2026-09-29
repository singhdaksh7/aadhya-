import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";
import { resetDb, seedTestAdmin } from "./helpers.js";

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
  const res = await request(app)
    .post("/api/admin/auth/login")
    .send({ email: env.admin.email, password: env.admin.password });
  return res.body.data.accessToken;
}

describe("GET /api/admin/health", () => {
  it("rejects requests with no admin session", async () => {
    const res = await request(app).get("/api/admin/health");
    expect(res.status).toBe(401);
  });

  it("rejects requests with an invalid/garbage token", async () => {
    const res = await request(app).get("/api/admin/health").set(auth("not-a-real-token"));
    expect(res.status).toBe(401);
  });

  it("returns detailed health data for an authenticated admin", async () => {
    const token = await adminToken();
    const res = await request(app).get("/api/admin/health").set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("database.ok");
    expect(res.body.data).toHaveProperty("storage.uploads");
    expect(res.body.data).toHaveProperty("storage.books");
    expect(res.body.data).toHaveProperty("storage.invoices");
    expect(res.body.data).toHaveProperty("email.smtpConfigured");
    expect(res.body.data).toHaveProperty("integrations.razorpay.configured");
    expect(res.body.data).toHaveProperty("integrations.shiprocket.configured");
    expect(res.body.data).toHaveProperty("backup");
    expect(typeof res.body.data.storage.uploads).toBe("boolean");
    expect(typeof res.body.data.storage.books).toBe("boolean");
    expect(typeof res.body.data.storage.invoices).toBe("boolean");
  });

  it("never leaks secrets (passwords, keys, connection strings) in the response", async () => {
    const token = await adminToken();
    const res = await request(app).get("/api/admin/health").set(auth(token));

    const serialized = JSON.stringify(res.body);
    const forbiddenSubstrings = [
      env.jwt.accessSecret,
      env.jwt.refreshSecret,
      env.databaseUrl,
      env.admin.password,
    ].filter(Boolean);

    for (const secret of forbiddenSubstrings) {
      expect(serialized).not.toContain(secret);
    }
    // No absolute filesystem paths should ever be exposed either.
    expect(serialized.toLowerCase()).not.toMatch(/[a-z]:\\|\/home\/|\/users\//i);
    // Generic secret-shaped keys should never appear as field names.
    expect(serialized.toLowerCase()).not.toMatch(/"password"|"secret"|"apikey"|"api_key"/);
  });

  it("never leaks the raw admin password even when the credential is misconfigured", async () => {
    const token = await adminToken();
    const res = await request(app).get("/api/admin/health").set(auth(token));
    expect(JSON.stringify(res.body)).not.toContain(env.admin.password);
  });

  it("does not weaken the existing public /api/health endpoint", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: "ok" } });
  });
});
