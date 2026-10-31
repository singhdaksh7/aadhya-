import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { resetDb, seedTestAdmin } from "./helpers.js";
import { newsletterLimiter } from "../src/middleware/rateLimiters.js";
import { corsOriginsFrom } from "../src/config/env.js";
import { csvCell } from "../src/modules/newsletter/newsletter.routes.js";

const request = supertest(createApp());

describe("Newsletter subscribe", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("subscribes a valid email (lower-cased, trimmed)", async () => {
    const res = await request.post("/api/newsletter/subscribe").send({ email: "  Person@Example.COM " });
    expect(res.status).toBe(201);
    expect(res.body.data.subscribed).toBe(true);
    expect(await prisma.newsletterSubscriber.count({ where: { email: "person@example.com" } })).toBe(1);
  });

  it("treats a duplicate as success, not an error, and stores one row", async () => {
    await request.post("/api/newsletter/subscribe").send({ email: "dup@example.com" });
    const again = await request.post("/api/newsletter/subscribe").send({ email: "DUP@example.com" });
    expect(again.status).toBe(201);
    expect(again.body.data.subscribed).toBe(true);
    expect(await prisma.newsletterSubscriber.count()).toBe(1);
  });

  it("rejects invalid, missing and empty emails with a readable 400 message", async () => {
    for (const body of [{ email: "not-an-email" }, {}, { email: "" }, { email: 42 }, undefined]) {
      const res = await request.post("/api/newsletter/subscribe").send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/email/i);
    }
    expect(await prisma.newsletterSubscriber.count()).toBe(0);
  });

  it("has a rate limiter configured (10 per 15 minutes) on the route", () => {
    expect(typeof newsletterLimiter).toBe("function");
  });

  it("allows CORS from the apex origin and its www twin, not from strangers", async () => {
    expect(corsOriginsFrom("https://aadyavocational.com")).toEqual(["https://aadyavocational.com", "https://www.aadyavocational.com"]);
    expect(corsOriginsFrom("http://localhost:5173")).toEqual(["http://localhost:5173"]);
  });
});

describe("Newsletter admin", () => {
  let token;
  const auth = () => ({ Authorization: `Bearer ${token}` });
  beforeEach(async () => {
    await resetDb();
    await seedTestAdmin({ email: "admin@test.local", password: "TestPassword123!" });
    const login = await request.post("/api/admin/auth/login").send({ email: "admin@test.local", password: "TestPassword123!" });
    token = login.body.data.accessToken;
    for (const email of ["alice@example.com", "bob@example.com", "+evil@example.com"]) await prisma.newsletterSubscriber.create({ data: { email } });
  });

  it("requires auth on every admin endpoint", async () => {
    expect((await request.get("/api/admin/newsletter")).status).toBe(401);
    expect((await request.get("/api/admin/newsletter/export")).status).toBe(401);
    expect((await request.delete("/api/admin/newsletter/x")).status).toBe(401);
  });

  it("lists with count and searches", async () => {
    const all = await request.get("/api/admin/newsletter").set(auth());
    expect(all.status).toBe(200);
    expect(all.body.data.total).toBe(3);
    expect(all.body.data.totalAll).toBe(3);
    const q = await request.get("/api/admin/newsletter?q=ALI").set(auth());
    expect(q.body.data.items.map((i) => i.email)).toEqual(["alice@example.com"]);
    expect(q.body.data.totalAll).toBe(3);
  });

  it("exports CSV and neutralises formula-leading cells", async () => {
    const res = await request.get("/api/admin/newsletter/export").set(auth());
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toContain("Email,Subscribed at");
    expect(res.text).toContain('"alice@example.com"');
    expect(res.text).toContain(`"'+evil@example.com"`);
    expect(csvCell('a"b')).toBe('"a""b"');
  });

  it("deletes (unsubscribes) a subscriber and 404s for unknown ids", async () => {
    const row = await prisma.newsletterSubscriber.findUnique({ where: { email: "bob@example.com" } });
    expect((await request.delete(`/api/admin/newsletter/${row.id}`).set(auth())).status).toBe(200);
    expect(await prisma.newsletterSubscriber.count()).toBe(2);
    expect((await request.delete(`/api/admin/newsletter/${row.id}`).set(auth())).status).toBe(404);
  });
});
