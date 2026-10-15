import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireRole } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  saveCredential,
  listCredentials,
  disableCredential,
  deleteCredential,
  markTest,
  getCredential,
  updateCredential,
  describeCredential,
  setActiveEnvironment,
  generateWebhookSecret,
  recordSecretAudit,
} from "./credential.service.js";
import { validateRazorpayCredential } from "./integration.validators.js";
import { getShippingProvider } from "../shipping/provider.service.js";
import { razorpaySummary, testRazorpayConnection, verifyWebhookSetup, razorpayWebhookEvents, validateRazorpayPatch, webhookUrlFor } from "./razorpay-integration.service.js";

const provider = z.enum(["RAZORPAY", "SHIPROCKET", "DELHIVERY", "CUSTOM"]);
const env = z.enum(["TEST", "LIVE", "DEFAULT"]);
const rzpEnv = z.enum(["TEST", "LIVE"]);
// Envelope only — "environment" must never be duplicated inside `data`, so
// the per-provider data schema below deliberately has no `environment` key
// and callers that send it there get a clear "Unrecognized key" error.
const credential = z.object({ provider, environment: env, data: z.object({ keyId: z.string().max(300).optional(), keySecret: z.string().max(500).optional(), webhookSecret: z.string().max(500).optional(), apiBaseUrl: z.string().url().or(z.literal("")).optional(), apiKey: z.string().max(500).optional(), apiSecret: z.string().max(500).optional(), apiEmail: z.string().email().optional(), apiPassword: z.string().max(500).optional(), bearerToken: z.string().max(1000).optional(), clientId: z.string().max(500).optional(), clientSecret: z.string().max(500).optional(), accountId: z.string().max(500).optional(), merchantLabel: z.string().max(200).optional(), enabled: z.boolean().optional() }).strict() });
// Dedicated Razorpay write schema: every field optional so one secret can be replaced alone.
const razorpayPatch = z.object({ environment: rzpEnv, keyId: z.string().max(300).optional(), keySecret: z.string().max(500).optional(), webhookSecret: z.string().max(500).optional(), enabled: z.boolean().optional() }).strict();

export const adminIntegrationRouter = Router();
adminIntegrationRouter.use(requireAdmin, requireRole("SUPER_ADMIN"));
// Anything under this router may carry or reference secrets: never let proxies/browsers cache it.
adminIntegrationRouter.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
adminIntegrationRouter.get("/", asyncHandler(async (req, res) => ok(res, { credentials: await listCredentials(), webhookUrl: webhookUrlFor(req) })));

// --- Razorpay Integration Center -------------------------------------------------
adminIntegrationRouter.get("/razorpay/summary", asyncHandler(async (req, res) => ok(res, await razorpaySummary(req))));
adminIntegrationRouter.get("/razorpay/webhook-events", asyncHandler(async (req, res) => ok(res, { items: await razorpayWebhookEvents(Number(req.query.limit) || 25) })));
adminIntegrationRouter.post("/razorpay/verify-setup", asyncHandler(async (req, res) => ok(res, await verifyWebhookSetup(req))));
adminIntegrationRouter.post("/razorpay/test", asyncHandler(async (req, res) => ok(res, await testRazorpayConnection(z.object({ environment: rzpEnv }).parse(req.body).environment, req.admin.id))));

adminIntegrationRouter.put(
  "/razorpay/credentials",
  asyncHandler(async (req, res) => {
    const input = razorpayPatch.parse(req.body);
    const existing = await describeCredential("RAZORPAY", input.environment);
    const patch = validateRazorpayPatch(input.environment, existing?.keyId, input);
    const hasSecretChange = Boolean(patch.keyId || patch.keySecret || patch.webhookSecret);
    if (!hasSecretChange && typeof input.enabled !== "boolean") throw ApiError.badRequest("Nothing to update.");
    const saved = await updateCredential("RAZORPAY", input.environment, { ...patch, ...(typeof input.enabled === "boolean" ? { enabled: input.enabled } : {}) }, req.admin.id, {
      auditAction: `RAZORPAY_${input.environment}_CREDENTIALS_CHANGED`,
    });
    ok(res, saved);
  })
);

// Generates a secret, stores it encrypted, and returns it exactly once. There is no
// endpoint that reads a stored webhook secret back.
adminIntegrationRouter.post(
  "/razorpay/webhook-secret/generate",
  asyncHandler(async (req, res) => {
    const { environment } = z.object({ environment: rzpEnv }).parse(req.body);
    const existing = await describeCredential("RAZORPAY", environment);
    const webhookSecret = generateWebhookSecret();
    await updateCredential("RAZORPAY", environment, { webhookSecret }, req.admin.id, {
      auditAction: existing?.hasWebhookSecret ? "RAZORPAY_WEBHOOK_SECRET_ROTATED" : "RAZORPAY_WEBHOOK_SECRET_CREATED",
    });
    ok(res, { environment, webhookSecret, shownOnce: true, rotated: Boolean(existing?.hasWebhookSecret) });
  })
);

adminIntegrationRouter.delete(
  "/razorpay/webhook-secret",
  asyncHandler(async (req, res) => {
    const { environment } = z.object({ environment: rzpEnv }).parse(req.query);
    const row = await getCredential("RAZORPAY", environment).catch(() => null);
    if (!row?.data.webhookSecret) throw ApiError.badRequest("No webhook secret is configured for this environment.");
    const { webhookSecret: _removed, ...rest } = row.data;
    await saveCredential("RAZORPAY", environment, { ...rest, enabled: row.row.isActive }, req.admin.id);
    await recordSecretAudit(req.admin.id, "RAZORPAY_WEBHOOK_SECRET_REMOVED", "RAZORPAY", { environment });
    ok(res, { removed: true });
  })
);

// Switching TEST<->LIVE changes which credentials take real money. Requires an explicit
// confirm flag and a complete credential set for the target environment.
adminIntegrationRouter.post(
  "/razorpay/mode",
  asyncHandler(async (req, res) => {
    const { environment } = z.object({ environment: rzpEnv, confirm: z.literal(true) }).parse(req.body);
    const target = await describeCredential("RAZORPAY", environment);
    if (!target?.keyId || !target.hasKeySecret) throw ApiError.badRequest(`Add ${environment} Key ID and Key Secret before switching to ${environment} mode.`);
    if (!target.row.isActive) throw ApiError.badRequest(`${environment} credentials are disabled. Enable them before switching.`);
    await setActiveEnvironment("RAZORPAY", environment, req.admin.id);
    ok(res, await razorpaySummary(req));
  })
);

// --- Generic provider endpoints (Shiprocket etc.; Razorpay kept for compatibility) ---
adminIntegrationRouter.put(
  "/credentials",
  asyncHandler(async (req, res) => {
    const input = credential.parse(req.body);
    if (input.provider === "RAZORPAY") {
      const { data, errors } = validateRazorpayCredential(input.environment, input.data);
      if (errors) throw ApiError.badRequest("Please check your Razorpay credentials.", errors);
      input.data = { ...input.data, ...data };
    }
    ok(res, await saveCredential(input.provider, input.environment, input.data, req.admin.id));
  })
);
adminIntegrationRouter.post("/:provider/:environment/disable", asyncHandler(async (req, res) => ok(res, await disableCredential(provider.parse(req.params.provider), env.parse(req.params.environment), req.admin.id))));
adminIntegrationRouter.delete("/:provider/:environment", asyncHandler(async (req, res) => ok(res, await deleteCredential(provider.parse(req.params.provider), env.parse(req.params.environment), req.admin.id))));
adminIntegrationRouter.post(
  "/:provider/:environment/test",
  asyncHandler(async (req, res) => {
    const p = provider.parse(req.params.provider);
    const e = env.parse(req.params.environment);
    await getCredential(p, e, { required: true });
    if (p === "RAZORPAY") {
      // Tests the credentials of the requested environment (not the active one).
      const result = await testRazorpayConnection(e, req.admin.id);
      const row = await describeCredential("RAZORPAY", e);
      return ok(res, { provider: p, environment: e, configured: true, testStatus: result.testStatus, lastTestedAt: result.lastTestedAt, outcome: result.outcome, keyId: row?.keyId || null });
    }
    let status = "SUCCESS";
    try {
      if (p === "SHIPROCKET") await getShippingProvider(p).testConnection({ environment: e });
    } catch {
      status = "FAILED";
    }
    ok(res, await markTest(p, e, status, req.admin.id));
  })
);
