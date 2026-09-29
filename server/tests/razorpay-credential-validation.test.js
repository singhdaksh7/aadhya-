import { describe, it, expect, beforeEach, afterAll } from "vitest";
import crypto from "node:crypto";
import request from "supertest";

// See razorpay-security.test.js for why INTEGRATION_ENCRYPTION_KEY must be
// set before any dynamic import that transitively loads config/env.js.
process.env.INTEGRATION_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");

const { resetDb, seedTestAdmin } = await import("./helpers.js");
const { prisma } = await import("../src/lib/prisma.js");
const { env } = await import("../src/config/env.js");
const { createApp } = await import("../src/app.js");

const app = createApp();

const VALID_TEST_KEY = "rzp_test_valid_key_1";
const VALID_LIVE_KEY = "rzp_live_valid_key_1";
const SECRET = "a_valid_key_secret";
const WEBHOOK_SECRET = "a_valid_webhook_secret";

async function loginAsSuperAdmin() {
  await seedTestAdmin({ role: "SUPER_ADMIN", email: "super@test.local" });
  const res = await request(app)
    .post("/api/admin/auth/login")
    .send({ email: "super@test.local", password: env.admin.password });
  return res.body.data.accessToken;
}

function putCredential(token, body) {
  return request(app).put("/api/admin/integrations/credentials").set("Authorization", `Bearer ${token}`).send(body);
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("PUT /api/admin/integrations/credentials — Razorpay contract", () => {
  it("accepts a valid TEST credentials payload", async () => {
    const token = await loginAsSuperAdmin();
    const res = await putCredential(token, {
      provider: "RAZORPAY",
      environment: "TEST",
      data: { keyId: VALID_TEST_KEY, keySecret: SECRET, webhookSecret: WEBHOOK_SECRET },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.environment).toBe("TEST");
  });

  it("accepts a valid LIVE credentials payload", async () => {
    const token = await loginAsSuperAdmin();
    const res = await putCredential(token, {
      provider: "RAZORPAY",
      environment: "LIVE",
      data: { keyId: VALID_LIVE_KEY, keySecret: SECRET, webhookSecret: WEBHOOK_SECRET },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.environment).toBe("LIVE");
  });

  it("rejects a duplicate `environment` field sent inside `data` with a clear (non-generic) error", async () => {
    const token = await loginAsSuperAdmin();
    const res = await putCredential(token, {
      provider: "RAZORPAY",
      environment: "TEST",
      data: { environment: "TEST", keyId: VALID_TEST_KEY, keySecret: SECRET, webhookSecret: WEBHOOK_SECRET },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).not.toBe("Validation failed");
  });

  it("rejects a missing Key ID with a field-level error", async () => {
    const token = await loginAsSuperAdmin();
    const res = await putCredential(token, {
      provider: "RAZORPAY",
      environment: "TEST",
      data: { keyId: "", keySecret: SECRET, webhookSecret: WEBHOOK_SECRET },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).not.toBe("Validation failed");
    expect(res.body.error.details.keyId).toBe("Razorpay Key ID is required.");
  });

  it("rejects a missing Key Secret with a field-level error", async () => {
    const token = await loginAsSuperAdmin();
    const res = await putCredential(token, {
      provider: "RAZORPAY",
      environment: "TEST",
      data: { keyId: VALID_TEST_KEY, keySecret: "  ", webhookSecret: WEBHOOK_SECRET },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.keySecret).toBe("Razorpay Key Secret is required.");
  });

  it("requires the webhook secret (production webhook verification depends on it)", async () => {
    const token = await loginAsSuperAdmin();
    const res = await putCredential(token, {
      provider: "RAZORPAY",
      environment: "TEST",
      data: { keyId: VALID_TEST_KEY, keySecret: SECRET, webhookSecret: "" },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.webhookSecret).toBe("Webhook secret is required for Razorpay webhook verification.");
  });

  it("flags a LIVE-looking key selected under TEST environment", async () => {
    const token = await loginAsSuperAdmin();
    const res = await putCredential(token, {
      provider: "RAZORPAY",
      environment: "TEST",
      data: { keyId: VALID_LIVE_KEY, keySecret: SECRET, webhookSecret: WEBHOOK_SECRET },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.keyId).toBe("This looks like a LIVE Razorpay key. Select LIVE or use a TEST key.");
  });

  it("flags a TEST-looking key selected under LIVE environment", async () => {
    const token = await loginAsSuperAdmin();
    const res = await putCredential(token, {
      provider: "RAZORPAY",
      environment: "LIVE",
      data: { keyId: VALID_TEST_KEY, keySecret: SECRET, webhookSecret: WEBHOOK_SECRET },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.keyId).toBe("This looks like a TEST Razorpay key. Select TEST or use a LIVE key.");
  });

  it("returns a safe, field-scoped validation response rather than a bare 'Validation failed'", async () => {
    const token = await loginAsSuperAdmin();
    const res = await putCredential(token, { provider: "RAZORPAY", environment: "TEST", data: { keyId: "", keySecret: "", webhookSecret: "" } });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Please check your Razorpay credentials.");
    expect(res.body.error.details).toEqual({
      keyId: "Razorpay Key ID is required.",
      keySecret: "Razorpay Key Secret is required.",
      webhookSecret: "Webhook secret is required for Razorpay webhook verification.",
    });
  });

  it("never returns secrets in the save response, even on success", async () => {
    const token = await loginAsSuperAdmin();
    const res = await putCredential(token, {
      provider: "RAZORPAY",
      environment: "TEST",
      data: { keyId: VALID_TEST_KEY, keySecret: SECRET, webhookSecret: WEBHOOK_SECRET },
    });
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain(SECRET);
    expect(bodyText).not.toContain(WEBHOOK_SECRET);
  });
});

describe("Connection test endpoint response sanitization", () => {
  it("never leaks provider error internals for a misconfigured client", async () => {
    const token = await loginAsSuperAdmin();
    await putCredential(token, {
      provider: "RAZORPAY",
      environment: "TEST",
      data: { keyId: "rzp_test_not_a_real_key", keySecret: "not_a_real_secret", webhookSecret: WEBHOOK_SECRET },
    });
    const res = await request(app).post("/api/admin/integrations/RAZORPAY/TEST/test").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(["SUCCESS", "FAILED"]).toContain(res.body.data.testStatus);
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain("not_a_real_secret");
  });
});
