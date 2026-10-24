import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import crypto from "node:crypto";
import request from "supertest";

// env.js reads INTEGRATION_ENCRYPTION_KEY at import time, so set it before any dynamic import.
process.env.INTEGRATION_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");

// Real credential storage, mode selection, config resolution and webhook verification run against the
// test database. Only the outbound HTTPS call to Cashfree is replaced (global fetch) - no network.
const { resetDb, seedTestAdmin, seedTestProduct, VALID_CUSTOMER, VALID_ADDRESS } = await import("./helpers.js");
const { prisma } = await import("../src/lib/prisma.js");
const { env } = await import("../src/config/env.js");
const { createApp } = await import("../src/app.js");
const { getCashfreeConfig } = await import("../src/modules/payments/cashfree.client.js");
const { signWebhook, webhookBody } = await import("./fakes/cashfree.js");

const app = createApp();
const BASE = "/api/admin/integrations";
const TEST_ID = "TEST10000abcdef";
const TEST_SECRET = "cfsk_ma_test_SECRETVALUE_AAAA1111";
const LIVE_ID = "10000liveabcdef";
const LIVE_SECRET = "cfsk_ma_prod_SECRETVALUE_BBBB2222";
const ALL_SECRETS = [TEST_SECRET, LIVE_SECRET];

async function login(role = "SUPER_ADMIN") {
  const email = `${role.toLowerCase()}@cf.local`;
  await seedTestAdmin({ role, email });
  const res = await request(app).post("/api/admin/auth/login").send({ email, password: env.admin.password });
  return res.body?.data?.accessToken;
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const put = (token, body) => request(app).put(`${BASE}/cashfree/credentials`).set(auth(token)).send(body);
const expectNoSecrets = (res) => {
  const text = JSON.stringify(res.body) + JSON.stringify(res.headers);
  for (const s of ALL_SECRETS) expect(text).not.toContain(s);
};

let fetchBehavior;
const realFetch = globalThis.fetch;
beforeEach(async () => {
  await resetDb();
  await prisma.integrationCredential.deleteMany();
  await prisma.webhookDeliveryLog.deleteMany();
  fetchBehavior = { status: 404, body: { code: "order_not_found", message: "order not found" }, calls: [] };
  globalThis.fetch = vi.fn(async (url, init) => {
    // Let supertest-style internal calls through; fake only Cashfree hosts.
    if (!String(url).includes("cashfree.com")) return realFetch(url, init);
    fetchBehavior.calls.push({ url: String(url), headers: init?.headers });
    if (fetchBehavior.throw) throw new Error("ENOTFOUND");
    return { ok: fetchBehavior.status < 400, status: fetchBehavior.status, json: async () => fetchBehavior.body };
  });
});
afterEach(() => {
  globalThis.fetch = realFetch;
});
afterAll(async () => {
  await prisma.integrationCredential.deleteMany();
  await resetDb();
  await prisma.$disconnect();
});

describe("RBAC", () => {
  it("rejects anonymous and non-super admins on every Cashfree integration route", async () => {
    const admin = await login("ADMIN");
    for (const [method, path] of [["get", "/cashfree/summary"], ["put", "/cashfree/credentials"], ["post", "/cashfree/test"], ["post", "/cashfree/mode"], ["delete", "/cashfree/credentials?environment=TEST"], ["post", "/cashfree/verify-setup"], ["get", "/cashfree/webhook-events"]]) {
      expect((await request(app)[method](`${BASE}${path}`)).status).toBe(401);
      expect((await request(app)[method](`${BASE}${path}`).set(auth(admin))).status).toBe(403);
    }
  });
});

describe("encrypted, write-only credentials", () => {
  it("never returns the Secret Key after saving (save, summary, list, no-store) and stores it encrypted", async () => {
    const token = await login();
    const saved = await put(token, { environment: "TEST", appId: TEST_ID, secretKey: TEST_SECRET });
    expect(saved.status).toBe(200);
    expectNoSecrets(saved);
    const summary = await request(app).get(`${BASE}/cashfree/summary`).set(auth(token));
    expectNoSecrets(summary);
    expect(summary.body.data.environments.TEST).toMatchObject({ configured: true, appId: TEST_ID });
    expect(summary.body.data.environments.TEST.secretKeyMask).toMatch(/^•+1111$/);
    expect(summary.headers["cache-control"]).toContain("no-store");
    expectNoSecrets(await request(app).get(BASE).set(auth(token)));

    const row = await prisma.integrationCredential.findUnique({ where: { provider_environment: { provider: "CASHFREE", environment: "TEST" } } });
    expect(row.encryptedData).not.toContain(TEST_SECRET);
    expect(row.encryptedData).not.toContain(TEST_ID);
    const settings = JSON.stringify(await prisma.siteSetting.findMany());
    expect(settings).not.toContain(TEST_SECRET);
  });

  it("public and admin settings expose no credentials", async () => {
    const token = await login();
    await put(token, { environment: "TEST", appId: TEST_ID, secretKey: TEST_SECRET });
    expectNoSecrets(await request(app).get("/api/settings"));
    expectNoSecrets(await request(app).get("/api/admin/settings").set(auth(token)));
  });

  it("a blank Secret Key on edit preserves the stored one; replacing one field keeps the other", async () => {
    const token = await login();
    await put(token, { environment: "TEST", appId: TEST_ID, secretKey: TEST_SECRET });
    // Enable/disable toggle without sending secrets.
    expect((await put(token, { environment: "TEST", enabled: true })).status).toBe(200);
    expect((await put(token, { environment: "TEST", secretKey: "" })).status).toBe(400); // nothing to update
    expect((await getCashfreeConfig()).secretKey).toBe(TEST_SECRET);
    expect((await put(token, { environment: "TEST", appId: "TEST10000zzzzzz", secretKey: "cfsk_ma_test_NEWSECRET" })).status).toBe(200);
    expect((await getCashfreeConfig()).secretKey).toBe("cfsk_ma_test_NEWSECRET");
  });

  it("audit log records changed field NAMES but never secret values", async () => {
    const token = await login();
    await put(token, { environment: "TEST", appId: TEST_ID, secretKey: TEST_SECRET });
    const logs = await prisma.adminAuditLog.findMany({ where: { provider: "CASHFREE" } });
    expect(logs.length).toBeGreaterThan(0);
    const text = JSON.stringify(logs);
    expect(text).toContain("secretKey");
    for (const s of ALL_SECRETS) expect(text).not.toContain(s);
    expect(logs.some((l) => l.action === "CASHFREE_TEST_CREDENTIALS_CHANGED")).toBe(true);
  });

  it("removes credentials on request, audited by name", async () => {
    const token = await login();
    await put(token, { environment: "TEST", appId: TEST_ID, secretKey: TEST_SECRET });
    const res = await request(app).delete(`${BASE}/cashfree/credentials?environment=TEST`).set(auth(token));
    expect(res.status).toBe(200);
    expect(await getCashfreeConfig()).toBeNull();
    expect((await prisma.adminAuditLog.findMany({ where: { action: "CASHFREE_CREDENTIALS_REMOVED" } })).length).toBe(1);
    expect((await request(app).delete(`${BASE}/cashfree/credentials?environment=TEST`).set(auth(token))).status).toBe(400);
  });
});

describe("validation and TEST/LIVE separation", () => {
  it("requires the Secret Key to be supplied together with a changed App ID", async () => {
    const token = await login();
    await put(token, { environment: "TEST", appId: TEST_ID, secretKey: TEST_SECRET });
    const res = await put(token, { environment: "TEST", appId: "TEST10000other" });
    expect(res.status).toBe(400);
    expect(res.body.error.details?.secretKey).toBeTruthy();
  });

  it("refuses sandbox credentials in LIVE and production keys in TEST", async () => {
    const token = await login();
    expect((await put(token, { environment: "LIVE", appId: "TESTabc", secretKey: "cfsk_ma_prod_x" })).status).toBe(400);
    expect((await put(token, { environment: "LIVE", appId: LIVE_ID, secretKey: "cfsk_ma_test_x" })).status).toBe(400);
    expect((await put(token, { environment: "TEST", appId: TEST_ID, secretKey: "cfsk_ma_prod_x" })).status).toBe(400);
    expect(await prisma.integrationCredential.count()).toBe(0);
  });

  it("defaults to TEST (sandbox) and keeps TEST and LIVE separate, using only the selected mode", async () => {
    const token = await login();
    await put(token, { environment: "TEST", appId: TEST_ID, secretKey: TEST_SECRET });
    await put(token, { environment: "LIVE", appId: LIVE_ID, secretKey: LIVE_SECRET });
    let summary = (await request(app).get(`${BASE}/cashfree/summary`).set(auth(token))).body.data;
    expect(summary.mode).toBe("TEST");
    let config = await getCashfreeConfig();
    expect(config).toMatchObject({ environment: "TEST", appId: TEST_ID, secretKey: TEST_SECRET, baseUrl: "https://sandbox.cashfree.com/pg" });

    const switched = await request(app).post(`${BASE}/cashfree/mode`).set(auth(token)).send({ environment: "LIVE", confirm: true });
    expect(switched.status).toBe(200);
    config = await getCashfreeConfig();
    expect(config).toMatchObject({ environment: "LIVE", appId: LIVE_ID, secretKey: LIVE_SECRET, baseUrl: "https://api.cashfree.com/pg" });
  });

  it("does not silently fall back to the other environment when the selected one is disabled", async () => {
    const token = await login();
    await put(token, { environment: "TEST", appId: TEST_ID, secretKey: TEST_SECRET });
    await put(token, { environment: "LIVE", appId: LIVE_ID, secretKey: LIVE_SECRET });
    await request(app).post(`${BASE}/cashfree/mode`).set(auth(token)).send({ environment: "LIVE", confirm: true });
    await put(token, { environment: "LIVE", enabled: false });
    expect(await getCashfreeConfig()).toBeNull();
  });

  it("mode switch needs explicit confirmation and complete, enabled credentials", async () => {
    const token = await login();
    expect((await request(app).post(`${BASE}/cashfree/mode`).set(auth(token)).send({ environment: "LIVE", confirm: true })).status).toBe(400);
    await put(token, { environment: "LIVE", appId: LIVE_ID, secretKey: LIVE_SECRET });
    expect((await request(app).post(`${BASE}/cashfree/mode`).set(auth(token)).send({ environment: "LIVE" })).status).toBe(400);
  });

  it("the generic credential endpoint cannot be used to store payment-provider secrets", async () => {
    const token = await login();
    const res = await request(app).put(`${BASE}/credentials`).set(auth(token)).send({ provider: "CASHFREE", environment: "TEST", data: { clientSecret: "x" } });
    expect(res.status).toBe(400);
  });
});

describe("webhook URL and connection test", () => {
  it("shows the exact webhook URL and only the events the handler processes", async () => {
    const token = await login();
    const summary = (await request(app).get(`${BASE}/cashfree/summary`).set(auth(token))).body.data;
    expect(summary.webhook.url).toMatch(/\/api\/webhooks\/cashfree$/);
    expect(summary.webhook.events.map((e) => e.event).sort()).toEqual(["PAYMENT_FAILED_WEBHOOK", "PAYMENT_SUCCESS_WEBHOOK", "PAYMENT_USER_DROPPED_WEBHOOK"]);
  });

  it("reports CONNECTED when Cashfree accepts the credentials (order-not-found probe), creating nothing", async () => {
    const token = await login();
    await put(token, { environment: "TEST", appId: TEST_ID, secretKey: TEST_SECRET });
    const res = await request(app).post(`${BASE}/cashfree/test`).set(auth(token)).send({ environment: "TEST" });
    expect(res.body.data.outcome).toBe("CONNECTED");
    expect(res.body.data.testStatus).toBe("SUCCESS");
    expect(fetchBehavior.calls).toHaveLength(1);
    expect(fetchBehavior.calls[0].url).toContain("sandbox.cashfree.com/pg/orders/");
    expect(await prisma.order.count()).toBe(0);
  });

  it("classifies failures without leaking secrets", async () => {
    const token = await login();
    await put(token, { environment: "TEST", appId: TEST_ID, secretKey: TEST_SECRET });
    fetchBehavior.status = 401;
    fetchBehavior.body = { message: `bad ${TEST_SECRET}` };
    const bad = await request(app).post(`${BASE}/cashfree/test`).set(auth(token)).send({ environment: "TEST" });
    expect(bad.body.data.outcome).toBe("AUTH_FAILED");
    expectNoSecrets(bad);
    fetchBehavior.throw = true;
    const down = await request(app).post(`${BASE}/cashfree/test`).set(auth(token)).send({ environment: "TEST" });
    expect(down.body.data.outcome).toBe("UNREACHABLE");
    expect((await request(app).post(`${BASE}/cashfree/test`).set(auth(token)).send({ environment: "LIVE" })).body.data.outcome).toBe("MISSING_CREDENTIALS");
  });
});

describe("webhook with real stored credentials", () => {
  it("verifies with the SELECTED mode's Secret Key only, and logs the delivery without payloads", async () => {
    const token = await login();
    await put(token, { environment: "TEST", appId: TEST_ID, secretKey: TEST_SECRET });
    await put(token, { environment: "LIVE", appId: LIVE_ID, secretKey: LIVE_SECRET });
    const body = webhookBody("PAYMENT_FAILED_WEBHOOK", { orderId: "TUS-2026-000777", status: "FAILED" });
    const post = (secret) => {
      const sig = signWebhook(body, undefined, secret);
      return request(app).post("/api/webhooks/cashfree").set("Content-Type", "application/json").set("x-webhook-timestamp", sig.timestamp).set("x-webhook-signature", sig.signature).send(body);
    };
    expect((await post(LIVE_SECRET)).status).toBe(400); // TEST mode is active: the LIVE secret must not verify
    expect((await post(TEST_SECRET)).status).toBe(200);
    const logs = await prisma.webhookDeliveryLog.findMany({ where: { provider: "cashfree" }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.signatureResult)).toEqual(["FAILED", "VERIFIED"]);
    const text = JSON.stringify(logs);
    for (const s of ALL_SECRETS) expect(text).not.toContain(s);
    expect(text).not.toContain("customer_phone");
  });

  it("setup verification never claims a signed event arrived before one has", async () => {
    const token = await login();
    await put(token, { environment: "TEST", appId: TEST_ID, secretKey: TEST_SECRET });
    const res = await request(app).post(`${BASE}/cashfree/verify-setup`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.waitingForFirstSignedEvent).toBe(true);
  });
});

describe("COD is independent of Cashfree configuration", () => {
  it("creates a COD order with no Cashfree credentials at all", async () => {
    const p = await seedTestProduct({ price: 500, stockQuantity: 5 });
    const res = await request(app).post("/api/orders").send({ customer: VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items: [{ slug: p.slug, quantity: 1 }], paymentMethod: "cod" });
    expect(res.status).toBe(201);
    expect(await getCashfreeConfig()).toBeNull();
    expect(fetchBehavior.calls).toHaveLength(0);
  });
});
