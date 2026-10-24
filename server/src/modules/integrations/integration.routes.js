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
  recordSecretAudit,
} from "./credential.service.js";
import { getShippingProvider } from "../shipping/provider.service.js";
import { cashfreeSummary, testCashfreeConnection, verifyWebhookSetup, cashfreeWebhookEvents, validateCashfreePatch, webhookUrlFor } from "./cashfree-integration.service.js";

// RAZORPAY stays in the enum only so that retired credentials can still be disabled/deleted from the API.
const provider = z.enum(["CASHFREE", "RAZORPAY", "SHIPROCKET", "DELHIVERY", "CUSTOM"]);
const env = z.enum(["TEST", "LIVE", "DEFAULT"]);
const cfEnv = z.enum(["TEST", "LIVE"]);
// Envelope only — "environment" must never be duplicated inside `data`, so
// the per-provider data schema below deliberately has no `environment` key
// and callers that send it there get a clear "Unrecognized key" error.
const credential = z.object({ provider, environment: env, data: z.object({ keyId: z.string().max(300).optional(), keySecret: z.string().max(500).optional(), webhookSecret: z.string().max(500).optional(), apiBaseUrl: z.string().url().or(z.literal("")).optional(), apiKey: z.string().max(500).optional(), apiSecret: z.string().max(500).optional(), apiEmail: z.string().email().optional(), apiPassword: z.string().max(500).optional(), bearerToken: z.string().max(1000).optional(), clientId: z.string().max(500).optional(), clientSecret: z.string().max(500).optional(), accountId: z.string().max(500).optional(), merchantLabel: z.string().max(200).optional(), enabled: z.boolean().optional() }).strict() });
// Dedicated Cashfree write schema: every field optional so the Secret Key can be replaced alone.
// A blank secret on edit preserves the stored one (updateCredential ignores empty values).
const cashfreePatch = z.object({ environment: cfEnv, appId: z.string().max(300).optional(), secretKey: z.string().max(500).optional(), enabled: z.boolean().optional() });

export const adminIntegrationRouter = Router();
adminIntegrationRouter.use(requireAdmin, requireRole("SUPER_ADMIN"));
// Anything under this router may carry or reference secrets: never let proxies/browsers cache it.
adminIntegrationRouter.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
adminIntegrationRouter.get("/", asyncHandler(async (req, res) => ok(res, { credentials: await listCredentials(), webhookUrl: webhookUrlFor(req) })));

// --- Cashfree Integration Center -------------------------------------------------
adminIntegrationRouter.get("/cashfree/summary", asyncHandler(async (req, res) => ok(res, await cashfreeSummary(req))));
adminIntegrationRouter.get("/cashfree/webhook-events", asyncHandler(async (req, res) => ok(res, { items: await cashfreeWebhookEvents(Number(req.query.limit) || 25) })));
adminIntegrationRouter.post("/cashfree/verify-setup", asyncHandler(async (req, res) => ok(res, await verifyWebhookSetup(req))));
adminIntegrationRouter.post("/cashfree/test", asyncHandler(async (req, res) => ok(res, await testCashfreeConnection(z.object({ environment: cfEnv }).parse(req.body).environment, req.admin.id))));

adminIntegrationRouter.put(
  "/cashfree/credentials",
  asyncHandler(async (req, res) => {
    const input = cashfreePatch.parse(req.body);
    const existing = await describeCredential("CASHFREE", input.environment);
    const patch = validateCashfreePatch(input.environment, existing?.appId, input);
    const hasSecretChange = Boolean(patch.appId || patch.secretKey);
    if (!hasSecretChange && typeof input.enabled !== "boolean") throw ApiError.badRequest("Nothing to update.");
    const saved = await updateCredential("CASHFREE", input.environment, { ...patch, ...(typeof input.enabled === "boolean" ? { enabled: input.enabled } : {}) }, req.admin.id, {
      auditAction: `CASHFREE_${input.environment}_CREDENTIALS_CHANGED`,
    });
    ok(res, saved);
  })
);

// Removes the stored credentials for one environment. Audited by name only, never by value.
adminIntegrationRouter.delete(
  "/cashfree/credentials",
  asyncHandler(async (req, res) => {
    const { environment } = z.object({ environment: cfEnv }).parse(req.query);
    const existing = await describeCredential("CASHFREE", environment);
    if (!existing) throw ApiError.badRequest("No credentials are stored for this environment.");
    await deleteCredential("CASHFREE", environment, req.admin.id);
    await recordSecretAudit(req.admin.id, "CASHFREE_CREDENTIALS_REMOVED", "CASHFREE", { environment });
    ok(res, { removed: true });
  })
);

// Switching TEST<->LIVE changes which credentials take real money. Requires an explicit
// confirm flag and a complete, enabled credential set for the target environment.
adminIntegrationRouter.post(
  "/cashfree/mode",
  asyncHandler(async (req, res) => {
    const { environment } = z.object({ environment: cfEnv, confirm: z.literal(true) }).parse(req.body);
    const target = await describeCredential("CASHFREE", environment);
    if (!target?.appId || !target.hasSecretKey) throw ApiError.badRequest(`Add ${environment} App ID and Secret Key before switching to ${environment} mode.`);
    if (!target.row.isActive) throw ApiError.badRequest(`${environment} credentials are disabled. Enable them before switching.`);
    await setActiveEnvironment("CASHFREE", environment, req.admin.id);
    ok(res, await cashfreeSummary(req));
  })
);

// --- Generic provider endpoints (Shiprocket etc.) ---
adminIntegrationRouter.put(
  "/credentials",
  asyncHandler(async (req, res) => {
    const input = credential.parse(req.body);
    if (input.provider === "CASHFREE" || input.provider === "RAZORPAY") throw ApiError.badRequest("Use the dedicated payment settings for this provider.");
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
    if (p === "CASHFREE") {
      const result = await testCashfreeConnection(cfEnv.parse(e), req.admin.id);
      const row = await describeCredential("CASHFREE", e);
      return ok(res, { provider: p, environment: e, configured: true, testStatus: result.testStatus, lastTestedAt: result.lastTestedAt, outcome: result.outcome, keyId: row?.appId || null });
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
