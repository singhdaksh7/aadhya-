import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireRole } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { saveCredential, listCredentials, disableCredential, deleteCredential, markTest, getCredential } from "./credential.service.js";
import { getRazorpayClient } from "../payments/razorpay.client.js";

const provider = z.enum(["RAZORPAY", "SHIPROCKET", "DELHIVERY", "CUSTOM"]);
const env = z.enum(["TEST", "LIVE", "DEFAULT"]);
const credential = z.object({ provider, environment: env, data: z.object({ keyId: z.string().max(300).optional(), keySecret: z.string().max(500).optional(), webhookSecret: z.string().max(500).optional(), apiBaseUrl: z.string().url().optional(), apiKey: z.string().max(500).optional(), apiSecret: z.string().max(500).optional(), bearerToken: z.string().max(1000).optional(), clientId: z.string().max(500).optional(), clientSecret: z.string().max(500).optional(), accountId: z.string().max(500).optional(), merchantLabel: z.string().max(200).optional(), enabled: z.boolean().optional() }).strict() });
export const adminIntegrationRouter = Router();
adminIntegrationRouter.use(requireAdmin, requireRole("SUPER_ADMIN"));
adminIntegrationRouter.get("/", asyncHandler(async (_req, res) => ok(res, { credentials: await listCredentials(), webhookUrl: "/api/webhooks/razorpay" })));
adminIntegrationRouter.put("/credentials", asyncHandler(async (req, res) => { const input = credential.parse(req.body); if (input.provider === "RAZORPAY" && (!input.data.keyId || !input.data.keySecret)) throw new Error("Razorpay Key ID and Key Secret are required."); ok(res, await saveCredential(input.provider, input.environment, input.data, req.admin.id)); }));
adminIntegrationRouter.post("/:provider/:environment/disable", asyncHandler(async (req, res) => ok(res, await disableCredential(provider.parse(req.params.provider), env.parse(req.params.environment), req.admin.id))));
adminIntegrationRouter.delete("/:provider/:environment", asyncHandler(async (req, res) => ok(res, await deleteCredential(provider.parse(req.params.provider), env.parse(req.params.environment), req.admin.id))));
adminIntegrationRouter.post("/:provider/:environment/test", asyncHandler(async (req, res) => { const p = provider.parse(req.params.provider), e = env.parse(req.params.environment); await getCredential(p, e, { required: true }); let status = "SUCCESS"; try { if (p === "RAZORPAY") { const client = await getRazorpayClient(); if (!client) throw new Error("Client unavailable"); await client.orders.all({ count: 1 }); } } catch { status = "FAILED"; } ok(res, await markTest(p, e, status, req.admin.id)); }));
