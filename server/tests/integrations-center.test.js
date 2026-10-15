import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import crypto from "node:crypto";
import request from "supertest";

// env.js reads INTEGRATION_ENCRYPTION_KEY at import time, so set it before any dynamic import.
process.env.INTEGRATION_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");

// Only the outbound Razorpay SDK is faked (no network in tests). Credential storage,
// mode selection, webhook verification and idempotency all run for real against the DB.
const rz = vi.hoisted(() => ({ behavior: "ok", lastConfig: null }));
vi.mock("razorpay", () => ({
  default: class FakeRazorpay {
    constructor(config) {
      rz.lastConfig = config;
      this.orders = {
        all: async () => {
          if (rz.behavior === "ok") return { items: [] };
          if (rz.behavior === "auth") throw { statusCode: 401, error: { description: "Authentication failed" } };
          throw new Error("getaddrinfo ENOTFOUND api.razorpay.com");
        },
        create: async () => ({ id: `order_ic_${crypto.randomBytes(4).toString("hex")}` }),
      };
    }
  },
}));

const { resetDb, seedTestAdmin, seedTestProduct, VALID_CUSTOMER, VALID_ADDRESS } = await import("./helpers.js");
const { prisma } = await import("../src/lib/prisma.js");
const { env } = await import("../src/config/env.js");
const { createApp } = await import("../src/app.js");
const { getRazorpayConfig } = await import("../src/modules/payments/razorpay.client.js");

const app = createApp();
const BASE = "/api/admin/integrations";
const TEST_KEY = "rzp_test_icenterkey0001";
const TEST_SECRET = "test_secret_value_AAAA1111";
const LIVE_KEY = "rzp_live_icenterkey0002";
const LIVE_SECRET = "live_secret_value_BBBB2222";
const WH_SECRET = "webhook_secret_value_CCCC3333";
const ALL_SECRETS = [TEST_SECRET, LIVE_SECRET, WH_SECRET];

async function login(role = "SUPER_ADMIN") {
  const email = `${role.toLowerCase()}@ic.local`;
  await seedTestAdmin({ role, email });
  const res = await request(app).post("/api/admin/auth/login").send({ email, password: env.admin.password });
  return res.body?.data?.accessToken;
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });
const put = (token, body) => request(app).put(`${BASE}/razorpay/credentials`).set(auth(token)).send(body);
const expectNoSecrets = (res, extra = []) => {
  const text = JSON.stringify(res.body) + JSON.stringify(res.text || "");
  for (const secret of [...ALL_SECRETS, ...extra]) expect(text).not.toContain(secret);
};

function signed(body, secret = WH_SECRET) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}
const postWebhook = (body, signature) => {
  const req = request(app).post("/api/webhooks/razorpay").set("Content-Type", "application/json");
  if (signature) req.set("x-razorpay-signature", signature);
  return req.send(body);
};

async function configureTest(token) {
  await put(token, { environment: "TEST", keyId: TEST_KEY, keySecret: TEST_SECRET, webhookSecret: WH_SECRET });
  return request(app).post(`${BASE}/razorpay/mode`).set(auth(token)).send({ environment: "TEST", confirm: true });
}

async function paidOrderFixture(token) {
  await configureTest(token);
  const product = await seedTestProduct({ price: 500, stockQuantity: 10 });
  const order = await request(app).post("/api/orders").send({ customer: VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items: [{ slug: product.slug, quantity: 1 }] });
  const created = await request(app).post(`/api/orders/${order.body.data.orderId}/payment`);
  return { orderId: order.body.data.orderId, providerOrderId: created.body.data.razorpayOrderId, product };
}

beforeEach(async () => {
  await resetDb();
  rz.behavior = "ok";
});
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("RBAC", () => {
  it("rejects anonymous and non-super admins on every Razorpay integration route", async () => {
    const admin = await login("ADMIN");
    for (const [method, path] of [["get", "/razorpay/summary"], ["put", "/razorpay/credentials"], ["post", "/razorpay/webhook-secret/generate"], ["post", "/razorpay/mode"], ["post", "/razorpay/test"], ["get", "/razorpay/webhook-events"], ["post", "/razorpay/verify-setup"]]) {
      expect((await request(app)[method](`${BASE}${path}`).send({})).status).toBe(401);
      expect((await request(app)[method](`${BASE}${path}`).set(auth(admin)).send({})).status).toBe(403);
    }
  });
  it("lets a super admin read the summary", async () => {
    const res = await request(app).get(`${BASE}/razorpay/summary`).set(auth(await login()));
    expect(res.status).toBe(200);
    expect(res.body.data.webhook.url).toMatch(/\/api\/webhooks\/razorpay$/);
  });
});

describe("secret redaction", () => {
  it("never returns key secret or webhook secret after saving (save, summary, list, no-store)", async () => {
    const token = await login();
    const saved = await put(token, { environment: "TEST", keyId: TEST_KEY, keySecret: TEST_SECRET, webhookSecret: WH_SECRET });
    expect(saved.status).toBe(200);
    expect(saved.headers["cache-control"]).toContain("no-store");
    expectNoSecrets(saved);
    const summary = await request(app).get(`${BASE}/razorpay/summary`).set(auth(token));
    expectNoSecrets(summary);
    expect(summary.body.data.environments.TEST.webhookSecretConfigured).toBe(true);
    expect(summary.body.data.environments.TEST.keySecretMask).toBe("••••••1111");
    expectNoSecrets(await request(app).get(BASE).set(auth(token)));
  });
  it("stores secrets encrypted, not in SiteSetting JSON", async () => {
    const token = await login();
    await put(token, { environment: "TEST", keyId: TEST_KEY, keySecret: TEST_SECRET, webhookSecret: WH_SECRET });
    const row = await prisma.integrationCredential.findUnique({ where: { provider_environment: { provider: "RAZORPAY", environment: "TEST" } } });
    for (const secret of ALL_SECRETS) expect(row.encryptedData).not.toContain(secret);
    const settings = JSON.stringify(await prisma.siteSetting.findMany());
    for (const secret of ALL_SECRETS) expect(settings).not.toContain(secret);
  });
  it("public settings and admin settings expose no integration secrets or config", async () => {
    const token = await login();
    await configureTest(token);
    const publicRes = await request(app).get("/api/settings");
    expect(publicRes.status).toBe(200);
    expectNoSecrets(publicRes, [TEST_KEY, "encryptedData"]);
    const adminSettings = await request(app).get("/api/admin/settings").set(auth(token));
    expectNoSecrets(adminSettings, ["encryptedData"]);
  });
  it("audit log records changed field names but never secret values", async () => {
    const token = await login();
    await put(token, { environment: "TEST", keyId: TEST_KEY, keySecret: TEST_SECRET, webhookSecret: WH_SECRET });
    await request(app).post(`${BASE}/razorpay/webhook-secret/generate`).set(auth(token)).send({ environment: "TEST" });
    const logs = await prisma.adminAuditLog.findMany();
    const text = JSON.stringify(logs);
    for (const secret of ALL_SECRETS) expect(text).not.toContain(secret);
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(["RAZORPAY_TEST_CREDENTIALS_CHANGED", "RAZORPAY_WEBHOOK_SECRET_ROTATED"]));
    expect(logs.find((l) => l.action === "RAZORPAY_TEST_CREDENTIALS_CHANGED").metadata.changedFields).toEqual(["keyId", "keySecret", "webhookSecret"]);
  });
});

describe("partial updates and TEST/LIVE separation", () => {
  it("replaces one secret without re-entering the others", async () => {
    const token = await login();
    await put(token, { environment: "TEST", keyId: TEST_KEY, keySecret: TEST_SECRET, webhookSecret: WH_SECRET });
    const res = await put(token, { environment: "TEST", webhookSecret: "a_brand_new_webhook_secret" });
    expect(res.status).toBe(200);
    await request(app).post(`${BASE}/razorpay/mode`).set(auth(token)).send({ environment: "TEST", confirm: true });
    const cfg = await getRazorpayConfig();
    expect(cfg.keyId).toBe(TEST_KEY);
    expect(cfg.keySecret).toBe(TEST_SECRET);
    expect(cfg.webhookSecret).toBe("a_brand_new_webhook_secret");
  });
  it("requires a new Key Secret whenever the Key ID changes", async () => {
    const token = await login();
    await put(token, { environment: "TEST", keyId: TEST_KEY, keySecret: TEST_SECRET });
    const res = await put(token, { environment: "TEST", keyId: "rzp_test_anotherkey0003" });
    expect(res.status).toBe(400);
    expect(res.body.error.details.keySecret).toBeDefined();
  });
  it("refuses LIVE keys in TEST and TEST keys in LIVE", async () => {
    const token = await login();
    expect((await put(token, { environment: "TEST", keyId: LIVE_KEY, keySecret: "x".repeat(10) })).status).toBe(400);
    expect((await put(token, { environment: "LIVE", keyId: TEST_KEY, keySecret: "x".repeat(10) })).status).toBe(400);
  });
  it("keeps TEST and LIVE credentials separate and uses only the selected mode", async () => {
    const token = await login();
    await put(token, { environment: "TEST", keyId: TEST_KEY, keySecret: TEST_SECRET, webhookSecret: WH_SECRET });
    await put(token, { environment: "LIVE", keyId: LIVE_KEY, keySecret: LIVE_SECRET, webhookSecret: "live_webhook_secret_DDDD" });
    await request(app).post(`${BASE}/razorpay/mode`).set(auth(token)).send({ environment: "TEST", confirm: true });
    expect((await getRazorpayConfig()).keyId).toBe(TEST_KEY);
    await request(app).post(`${BASE}/razorpay/mode`).set(auth(token)).send({ environment: "LIVE", confirm: true });
    const live = await getRazorpayConfig();
    expect(live.keyId).toBe(LIVE_KEY);
    expect(live.keySecret).toBe(LIVE_SECRET);
    expect(live.webhookSecret).toBe("live_webhook_secret_DDDD");
  });
  it("does not silently fall back to another environment when the selected one is disabled", async () => {
    const token = await login();
    await configureTest(token);
    await put(token, { environment: "LIVE", keyId: LIVE_KEY, keySecret: LIVE_SECRET });
    await put(token, { environment: "TEST", enabled: false });
    expect(await getRazorpayConfig()).toBeNull();
  });
  it("mode switch needs explicit confirmation and complete credentials", async () => {
    const token = await login();
    await configureTest(token);
    expect((await request(app).post(`${BASE}/razorpay/mode`).set(auth(token)).send({ environment: "LIVE" })).status).toBe(400);
    const noCreds = await request(app).post(`${BASE}/razorpay/mode`).set(auth(token)).send({ environment: "LIVE", confirm: true });
    expect(noCreds.status).toBe(400);
    expect((await getRazorpayConfig()).keyId).toBe(TEST_KEY);
  });
});

describe("webhook secret generation", () => {
  it("returns a high-entropy secret exactly once, never again", async () => {
    const token = await login();
    await configureTest(token);
    const a = await request(app).post(`${BASE}/razorpay/webhook-secret/generate`).set(auth(token)).send({ environment: "TEST" });
    const b = await request(app).post(`${BASE}/razorpay/webhook-secret/generate`).set(auth(token)).send({ environment: "TEST" });
    const secretA = a.body.data.webhookSecret;
    const secretB = b.body.data.webhookSecret;
    expect(a.body.data.shownOnce).toBe(true);
    expect(secretA).not.toBe(secretB);
    expect(Buffer.from(secretA, "base64url").length).toBe(32); // 256 bits
    expect(secretA).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const summary = await request(app).get(`${BASE}/razorpay/summary`).set(auth(token));
    expect(JSON.stringify(summary.body)).not.toContain(secretB);
    expect((await getRazorpayConfig()).webhookSecret).toBe(secretB); // newest one is live
  });
});

describe("webhook URL", () => {
  it("is derived from the request origin and follows a domain change", async () => {
    const token = await login();
    const a = await request(app).get(`${BASE}/razorpay/summary`).set(auth(token)).set("Host", "api.example-one.test");
    const b = await request(app).get(`${BASE}/razorpay/summary`).set(auth(token)).set("Host", "api.example-two.test");
    expect(a.body.data.webhook.url).toBe("http://api.example-one.test/api/webhooks/razorpay");
    expect(b.body.data.webhook.url).toBe("http://api.example-two.test/api/webhooks/razorpay");
    expect(JSON.stringify(a.body)).not.toContain("77.37.45.177");
  });
  it("lists only the events the handler really processes", async () => {
    const res = await request(app).get(`${BASE}/razorpay/summary`).set(auth(await login()));
    expect(res.body.data.webhook.events.map((e) => e.event)).toEqual(["payment.captured", "payment.failed"]);
  });
});

describe("connection test", () => {
  it("reports CONNECTED on success and stores the result", async () => {
    const token = await login();
    await configureTest(token);
    const res = await request(app).post(`${BASE}/razorpay/test`).set(auth(token)).send({ environment: "TEST" });
    expect(res.body.data.outcome).toBe("CONNECTED");
    expect(res.body.data.testStatus).toBe("SUCCESS");
    expectNoSecrets(res);
  });
  it("tests the requested environment, not the active one", async () => {
    const token = await login();
    await configureTest(token);
    await put(token, { environment: "LIVE", keyId: LIVE_KEY, keySecret: LIVE_SECRET });
    await request(app).post(`${BASE}/razorpay/test`).set(auth(token)).send({ environment: "LIVE" });
    expect(rz.lastConfig.key_id).toBe(LIVE_KEY);
  });
  it("classifies failures without leaking secrets", async () => {
    const token = await login();
    await configureTest(token);
    rz.behavior = "auth";
    const auth401 = await request(app).post(`${BASE}/razorpay/test`).set(auth(token)).send({ environment: "TEST" });
    expect(auth401.body.data.outcome).toBe("AUTH_FAILED");
    rz.behavior = "network";
    const net = await request(app).post(`${BASE}/razorpay/test`).set(auth(token)).send({ environment: "TEST" });
    expect(net.body.data.outcome).toBe("UNREACHABLE");
    expect(net.body.data.testStatus).toBe("FAILED");
    expectNoSecrets(net);
    const missing = await request(app).post(`${BASE}/razorpay/test`).set(auth(token)).send({ environment: "LIVE" });
    expect(missing.body.data.outcome).toBe("MISSING_CREDENTIALS");
  });
});

describe("webhook security, logging and idempotency", () => {
  it("rejects unsigned requests and wrong signatures, and logs them", async () => {
    await configureTest(await login());
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_x", order_id: "order_x" } } } });
    expect((await postWebhook(body)).status).toBe(400);
    expect((await postWebhook(body, "0".repeat(64))).status).toBe(400);
    expect((await postWebhook(body, "z".repeat(64))).status).toBe(400); // malformed hex must not 500
    expect((await postWebhook(body, "short")).status).toBe(400);
    const logs = await prisma.webhookDeliveryLog.findMany();
    expect(logs).toHaveLength(4);
    expect(logs.every((l) => l.result === "REJECTED" && l.signatureResult === "FAILED")).toBe(true);
    expect(await prisma.webhookEvent.count()).toBe(0);
  });
  it("accepts a correct signature, finalizes once, and logs PROCESSED then DUPLICATE", async () => {
    const token = await login();
    const { orderId, providerOrderId, product } = await paidOrderFixture(token);
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_ic_1", order_id: providerOrderId, method: "upi" } } } });
    const first = await postWebhook(body, signed(body));
    const second = await postWebhook(body, signed(body));
    expect(first.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).toBe("PAID");
    expect((await prisma.product.findUnique({ where: { id: product.id } })).stockQuantity).toBe(9);
    const logs = await prisma.webhookDeliveryLog.findMany({ orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.result)).toEqual(["PROCESSED", "DUPLICATE"]);
    expect(logs[0].signatureResult).toBe("VERIFIED");
    expect(JSON.stringify(logs)).not.toContain(WH_SECRET);
    const events = await request(app).get(`${BASE}/razorpay/webhook-events`).set(auth(token));
    expect(events.body.data.items[0]).toEqual(expect.objectContaining({ event: "payment.captured", result: "DUPLICATE", signature: "VERIFIED" }));
    const summary = await request(app).get(`${BASE}/razorpay/summary`).set(auth(token));
    expect(summary.body.data.webhook).toEqual(expect.objectContaining({ lastEventType: "payment.captured", waitingForFirstSignedEvent: false }));
  });
  it("uses the secret of the SELECTED mode only", async () => {
    const token = await login();
    await configureTest(token);
    await put(token, { environment: "LIVE", keyId: LIVE_KEY, keySecret: LIVE_SECRET, webhookSecret: "live_webhook_secret_DDDD" });
    const body = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_z", order_id: "order_z" } } } });
    expect((await postWebhook(body, signed(body, "live_webhook_secret_DDDD"))).status).toBe(400);
    expect((await postWebhook(body, signed(body))).status).toBe(200);
  });
  it("logs business rejections as FAILED without retry storms", async () => {
    await configureTest(await login());
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_nomatch", order_id: "order_nomatch" } } } });
    const res = await postWebhook(body, signed(body));
    expect(res.status).toBe(200);
    expect((await prisma.webhookDeliveryLog.findFirst()).result).toBe("FAILED");
  });
  it("releases the idempotency row after an unexpected failure so Razorpay's retry is processed", async () => {
    const token = await login();
    const { orderId, providerOrderId } = await paidOrderFixture(token);
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_retry", order_id: providerOrderId, method: "upi" } } } });
    // Simulate a transient DB failure inside finalizePaidPayment (first payment lookup only).
    const original = prisma.payment.findFirst;
    prisma.payment.findFirst = vi.fn().mockRejectedValueOnce(new Error("connection reset"));
    const failed = await postWebhook(body, signed(body));
    prisma.payment.findFirst = original;
    expect(failed.status).toBe(500);
    expect(await prisma.webhookEvent.count()).toBe(0);
    const retry = await postWebhook(body, signed(body));
    expect(retry.status).toBe(200);
    expect((await prisma.order.findUnique({ where: { id: orderId } })).paymentStatus).toBe("PAID");
  });
});

describe("setup verification", () => {
  it("never claims a signed event arrived before one has", async () => {
    const token = await login();
    await configureTest(token);
    const res = await request(app).post(`${BASE}/razorpay/verify-setup`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.checks.map((c) => c.key)).toEqual(["credentials", "secret", "endpoint", "events"]);
    expect(res.body.data.waitingForFirstSignedEvent).toBe(true);
    expect(res.body.data.checks.find((c) => c.key === "secret").pass).toBe(true);
  });
});

describe("COD is unaffected by Razorpay configuration", () => {
  it("still creates a COD order after Razorpay credentials are removed", async () => {
    const token = await login();
    await configureTest(token);
    await request(app).delete(`${BASE}/RAZORPAY/TEST`).set(auth(token));
    const product = await seedTestProduct({ price: 500, stockQuantity: 5 });
    await prisma.shippingZone.create({ data: { name: "KA", states: ["Karnataka"], postalCodes: [], codSupported: true } });
    const res = await request(app).post("/api/orders").send({ customer: VALID_CUSTOMER, shippingAddress: VALID_ADDRESS, items: [{ slug: product.slug, quantity: 1 }], paymentMethod: "cod" });
    expect(res.status).toBe(201);
    expect((await prisma.order.findUnique({ where: { id: res.body.data.orderId } })).paymentMethod).toBe("cod");
  });
});
