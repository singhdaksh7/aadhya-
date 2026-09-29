import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import crypto from "node:crypto";
import request from "supertest";

// This test file deliberately avoids *static* imports of anything that
// transitively imports ../src/config/env.js (helpers.js, prisma, app.js,
// the integration/payment modules) because env.js reads
// INTEGRATION_ENCRYPTION_KEY from process.env at module-evaluation time.
// Static imports are hoisted and would load env.js before we get a chance
// to set that variable, leaving encryption permanently unconfigured for
// the whole test run. Setting it first, then dynamic-importing everything
// else, guarantees it's in place before env.js is ever evaluated.
process.env.INTEGRATION_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");

const { resetDb, seedTestAdmin, registerCustomer } = await import("./helpers.js");
const { prisma } = await import("../src/lib/prisma.js");
const { env } = await import("../src/config/env.js");
const { createApp } = await import("../src/app.js");
const { saveCredential } = await import("../src/modules/integrations/credential.service.js");
const { getRazorpayConfig, isRazorpayConfigured } = await import("../src/modules/payments/razorpay.client.js");
const { verifyRazorpaySignature, verifyRazorpayWebhookSignature } = await import("../src/modules/payments/payment.service.js");

const app = createApp();

const ADMIN_SECRET = "admin_configured_super_secret_key";
const ADMIN_WEBHOOK_SECRET = "admin_configured_webhook_secret";
const ADMIN_KEY_ID = "rzp_live_admin_configured";

async function loginAs(role) {
  await seedTestAdmin({ role, email: `${role.toLowerCase()}@test.local` });
  const res = await request(app)
    .post("/api/admin/auth/login")
    .send({ email: `${role.toLowerCase()}@test.local`, password: env.admin.password });
  return res.body?.data?.accessToken;
}

async function saveRazorpayCredential(overrides = {}) {
  return saveCredential(
    "RAZORPAY",
    "LIVE",
    { keyId: ADMIN_KEY_ID, keySecret: ADMIN_SECRET, webhookSecret: ADMIN_WEBHOOK_SECRET, ...overrides },
    "test-admin-id"
  );
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("Razorpay credential encryption at rest", () => {
  it("never stores the plaintext secret in the database row", async () => {
    await saveRazorpayCredential();
    const row = await prisma.integrationCredential.findUnique({
      where: { provider_environment: { provider: "RAZORPAY", environment: "LIVE" } },
    });
    expect(row).toBeTruthy();
    expect(row.encryptedData).not.toContain(ADMIN_SECRET);
    expect(row.encryptedData).not.toContain(ADMIN_WEBHOOK_SECRET);
    // Sanity: it really is opaque ciphertext, not e.g. base64(JSON) of the data.
    expect(() => JSON.parse(Buffer.from(row.encryptedData, "base64").toString("utf8"))).toThrow();
  });
});

describe("GET /api/admin/integrations never leaks raw secrets", () => {
  it("returns only masked secret fields in the response body", async () => {
    const token = await loginAs("SUPER_ADMIN");
    await saveRazorpayCredential();

    const res = await request(app).get("/api/admin/integrations").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain(ADMIN_SECRET);
    expect(bodyText).not.toContain(ADMIN_WEBHOOK_SECRET);

    const razorpayEntry = res.body.data.credentials.find((c) => c.provider === "RAZORPAY");
    expect(razorpayEntry).toBeTruthy();
    expect(razorpayEntry.masked.keySecret).toBe(`••••••${ADMIN_SECRET.slice(-4)}`);
    expect(razorpayEntry.masked.webhookSecret).toBe(`••••••${ADMIN_WEBHOOK_SECRET.slice(-4)}`);
  });

  it("save-credential response (echoed back to the admin) is also masked, not raw", async () => {
    const saved = await saveRazorpayCredential();
    const savedText = JSON.stringify(saved);
    expect(savedText).not.toContain(ADMIN_SECRET);
    expect(savedText).not.toContain(ADMIN_WEBHOOK_SECRET);
  });
});

describe("Role gating on Razorpay credential endpoints", () => {
  it("rejects a non-super-admin ADMIN from reading integration config", async () => {
    const adminToken = await loginAs("ADMIN");
    const res = await request(app).get("/api/admin/integrations").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it("rejects a non-super-admin ADMIN from writing Razorpay credentials", async () => {
    const adminToken = await loginAs("ADMIN");
    const res = await request(app)
      .put("/api/admin/integrations/credentials")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ provider: "RAZORPAY", environment: "LIVE", data: { keyId: "x", keySecret: "y" } });
    expect(res.status).toBe(403);
  });

  it("allows a SUPER_ADMIN to write Razorpay credentials", async () => {
    const token = await loginAs("SUPER_ADMIN");
    const res = await request(app)
      .put("/api/admin/integrations/credentials")
      .set("Authorization", `Bearer ${token}`)
      .send({ provider: "RAZORPAY", environment: "LIVE", data: { keyId: ADMIN_KEY_ID, keySecret: ADMIN_SECRET, webhookSecret: ADMIN_WEBHOOK_SECRET } });
    expect(res.status).toBe(200);
  });

  it("rejects an unauthenticated request entirely", async () => {
    const res = await request(app).get("/api/admin/integrations");
    expect(res.status).toBe(401);
  });

  it("rejects a customer token entirely", async () => {
    const customer = await registerCustomer(app);
    const res = await request(app)
      .get("/api/admin/integrations")
      .set("Authorization", `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(401);
  });
});

describe("Admin-configured credentials take precedence over env vars", () => {
  it("getRazorpayConfig returns the admin-configured values, not env", async () => {
    // Env vars are set (RAZORPAY_KEY_ID/KEY_SECRET/WEBHOOK_SECRET in .env.test)
    // and differ from the admin-configured ones below.
    expect(env.razorpay.keySecret).not.toBe(ADMIN_SECRET);
    await saveRazorpayCredential();

    const config = await getRazorpayConfig();
    expect(config.keyId).toBe(ADMIN_KEY_ID);
    expect(config.keySecret).toBe(ADMIN_SECRET);
    expect(config.webhookSecret).toBe(ADMIN_WEBHOOK_SECRET);
  });

  it("signature verification uses the admin-configured secret over the env secret", async () => {
    await saveRazorpayCredential();
    const orderId = "order_precedence_1";
    const paymentId = "pay_precedence_1";

    const signedWithAdminSecret = crypto
      .createHmac("sha256", ADMIN_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    const signedWithEnvSecret = crypto
      .createHmac("sha256", env.razorpay.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    await expect(
      verifyRazorpaySignature({ razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signedWithAdminSecret })
    ).resolves.toBe(true);
    await expect(
      verifyRazorpaySignature({ razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signedWithEnvSecret })
    ).resolves.toBe(false);
  });
});

describe("Falls back to env vars when no admin credential exists", () => {
  it("getRazorpayConfig resolves to the env-configured values", async () => {
    const config = await getRazorpayConfig();
    expect(config).toBeTruthy();
    expect(config.keyId).toBe(env.razorpay.keyId);
    expect(config.keySecret).toBe(env.razorpay.keySecret);
    expect(config.environment).toBe("ENV");
    expect(await isRazorpayConfigured()).toBe(true);
  });

  it("signature verification falls back to the env secret", async () => {
    const orderId = "order_fallback_1";
    const paymentId = "pay_fallback_1";
    const signature = crypto.createHmac("sha256", env.razorpay.keySecret).update(`${orderId}|${paymentId}`).digest("hex");
    await expect(
      verifyRazorpaySignature({ razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature })
    ).resolves.toBe(true);
  });
});

describe("Malformed/corrupted encrypted credential blob fails safely", () => {
  it("does not crash the process and returns a sensible error from the admin API", async () => {
    const token = await loginAs("SUPER_ADMIN");
    await saveRazorpayCredential();
    // Corrupt the stored ciphertext directly, simulating bit-rot / bad migration / tampering.
    await prisma.integrationCredential.update({
      where: { provider_environment: { provider: "RAZORPAY", environment: "LIVE" } },
      data: { encryptedData: "not-valid-ciphertext-at-all" },
    });

    const res = await request(app).post("/api/admin/integrations/RAZORPAY/LIVE/test").set("Authorization", `Bearer ${token}`);
    // Must fail gracefully (4xx/5xx handled by errorHandler), never hang or crash the app.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(600);
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain("not-valid-ciphertext-at-all");
    expect(bodyText.toLowerCase()).not.toContain("authtagunavailable");

    // The app must still be alive and serving other requests afterwards.
    const health = await request(app).get("/api/health").catch(() => null);
    if (health) expect(health.status).toBeLessThan(500);
  });

  it("listCredentials (GET /) degrades gracefully instead of throwing on a corrupted row", async () => {
    const token = await loginAs("SUPER_ADMIN");
    await saveRazorpayCredential();
    await prisma.integrationCredential.update({
      where: { provider_environment: { provider: "RAZORPAY", environment: "LIVE" } },
      data: { encryptedData: Buffer.from("short").toString("base64") },
    });

    const res = await request(app).get("/api/admin/integrations").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const razorpayEntry = res.body.data.credentials.find((c) => c.provider === "RAZORPAY");
    expect(razorpayEntry).toBeTruthy();
    expect(razorpayEntry.masked).toEqual({});
  });

  it("getRazorpayConfig never crashes or leaks ciphertext on a corrupted row (falls back to env instead of throwing)", async () => {
    await saveRazorpayCredential();
    await prisma.integrationCredential.update({
      where: { provider_environment: { provider: "RAZORPAY", environment: "LIVE" } },
      data: { encryptedData: "garbage" },
    });

    // getRazorpayConfig swallows the decrypt failure (via getCredential(...).catch(() => null))
    // and falls back to the env-configured credentials rather than throwing or crashing —
    // this is the actual, intentional resilience behavior; assert it stays that way and
    // that the corrupt ciphertext never leaks through the resolved config.
    const config = await getRazorpayConfig();
    expect(config.keyId).toBe(env.razorpay.keyId);
    expect(config.environment).toBe("ENV");
    expect(JSON.stringify(config)).not.toContain("garbage");
  });
});

describe("Webhook signature secret resolution", () => {
  it("uses the resolved (admin-configured) webhook secret and rejects the wrong one", async () => {
    await saveRazorpayCredential();
    const rawBody = JSON.stringify({ event: "payment.captured" });

    const correctSig = crypto.createHmac("sha256", ADMIN_WEBHOOK_SECRET).update(rawBody).digest("hex");
    const wrongSig = crypto.createHmac("sha256", "totally-wrong-secret").update(rawBody).digest("hex");
    const envSig = crypto.createHmac("sha256", env.razorpay.webhookSecret).update(rawBody).digest("hex");

    await expect(verifyRazorpayWebhookSignature(rawBody, correctSig)).resolves.toBe(true);
    await expect(verifyRazorpayWebhookSignature(rawBody, wrongSig)).resolves.toBe(false);
    // Since an admin credential is configured, the env secret must NOT validate.
    await expect(verifyRazorpayWebhookSignature(rawBody, envSig)).resolves.toBe(false);
  });

  it("falls back to the env webhook secret when no admin credential exists", async () => {
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const sig = crypto.createHmac("sha256", env.razorpay.webhookSecret).update(rawBody).digest("hex");
    await expect(verifyRazorpayWebhookSignature(rawBody, sig)).resolves.toBe(true);
  });
});

describe("No secret values ever appear in logs", () => {
  it("console.log/console.error are never called with the raw secret during save + verify", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const token = await loginAs("SUPER_ADMIN");
      await request(app)
        .put("/api/admin/integrations/credentials")
        .set("Authorization", `Bearer ${token}`)
        .send({ provider: "RAZORPAY", environment: "LIVE", data: { keyId: ADMIN_KEY_ID, keySecret: ADMIN_SECRET, webhookSecret: ADMIN_WEBHOOK_SECRET } });

      await request(app).get("/api/admin/integrations").set("Authorization", `Bearer ${token}`);

      const orderId = "order_log_check";
      const paymentId = "pay_log_check";
      const signature = crypto.createHmac("sha256", ADMIN_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
      await verifyRazorpaySignature({ razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature });

      const rawBody = JSON.stringify({ event: "payment.captured" });
      const webhookSig = crypto.createHmac("sha256", ADMIN_WEBHOOK_SECRET).update(rawBody).digest("hex");
      await request(app).post("/api/webhooks/razorpay").set("Content-Type", "application/json").set("x-razorpay-signature", webhookSig).send(rawBody);

      const allCalls = [...logSpy.mock.calls, ...errorSpy.mock.calls, ...warnSpy.mock.calls];
      const flattened = allCalls.map((call) => call.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ")).join("\n");
      expect(flattened).not.toContain(ADMIN_SECRET);
      expect(flattened).not.toContain(ADMIN_WEBHOOK_SECRET);
    } finally {
      logSpy.mockRestore();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});

describe("Test-connection endpoint never returns the raw secret", () => {
  it("POST /api/admin/integrations/:provider/:environment/test response body is secret-free", async () => {
    const token = await loginAs("SUPER_ADMIN");
    await saveRazorpayCredential();

    const res = await request(app).post("/api/admin/integrations/RAZORPAY/LIVE/test").set("Authorization", `Bearer ${token}`);
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain(ADMIN_SECRET);
    expect(bodyText).not.toContain(ADMIN_WEBHOOK_SECRET);
  });
});
