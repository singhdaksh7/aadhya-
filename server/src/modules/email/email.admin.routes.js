import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireRole } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { getEmailStatus, sendTestEmail, getEmailHealthSummary, retryEmailLog, getSmtpConfig } from "./email.service.js";
import { getCredentialRaw, saveCredential, deleteCredential } from "../integrations/credential.service.js";

export const adminEmailRouter = Router();
adminEmailRouter.use(requireAdmin, requireRole("SUPER_ADMIN"));

const testEmailSchema = z.object({ recipient: z.string().email().max(300) });
const logsQuerySchema = z.object({
  status: z.enum(["SENT", "FAILED", "SKIPPED"]).optional(),
  type: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const smtpSettingsSchema = z.object({
  host: z.string().trim().min(1, "SMTP host is required").max(255).regex(/^[A-Za-z0-9.-]+$/, "Enter a hostname such as smtp.example.com"),
  port: z.coerce.number().int().min(1).max(65535),
  encryption: z.enum(["SSL_TLS", "STARTTLS", "NONE"]),
  user: z.string().trim().max(255).optional().default(""),
  password: z.string().max(500).optional().default(""),
  fromName: z.string().trim().max(120).optional().default(""),
  fromEmail: z.string().trim().email("Enter a valid sender email").max(255),
  replyTo: z.string().trim().email("Enter a valid reply-to email").max(255).or(z.literal("")).optional().default(""),
  enabled: z.boolean().optional().default(true),
});

async function describeSmtpSettings() {
  const raw = await getCredentialRaw("SMTP", "DEFAULT");
  const effective = await getSmtpConfig();
  const d = raw?.data || {};
  return {
    saved: Boolean(raw),
    enabled: raw ? raw.row.isActive : false,
    host: d.host || "",
    port: Number(d.port) || 587,
    encryption: d.encryption || "STARTTLS",
    user: d.user || "",
    hasPassword: Boolean(d.apiPassword),
    fromName: d.fromName || "",
    fromEmail: d.fromEmail || "",
    replyTo: d.replyTo || "",
    effectiveSource: effective.source,
  };
}

// GET /admin/email/settings — editable SMTP settings. The password is never returned, only whether one is stored.
adminEmailRouter.get("/settings", asyncHandler(async (_req, res) => ok(res, await describeSmtpSettings())));

// PUT /admin/email/settings — save SMTP settings (password encrypted at rest; blank password keeps the stored one).
adminEmailRouter.put(
  "/settings",
  asyncHandler(async (req, res) => {
    const input = smtpSettingsSchema.parse(req.body);
    const existing = (await getCredentialRaw("SMTP", "DEFAULT"))?.data || {};
    const apiPassword = input.password || existing.apiPassword || "";
    if (input.user && !apiPassword) throw ApiError.badRequest("Enter the SMTP password for this username.");
    await saveCredential(
      "SMTP",
      "DEFAULT",
      { host: input.host, port: input.port, encryption: input.encryption, user: input.user, apiPassword, fromName: input.fromName, fromEmail: input.fromEmail, replyTo: input.replyTo, enabled: input.enabled },
      req.admin.id
    );
    ok(res, await describeSmtpSettings());
  })
);

// DELETE /admin/email/settings — remove the Admin-managed SMTP settings (falls back to SMTP_* environment variables, if any).
adminEmailRouter.delete(
  "/settings",
  asyncHandler(async (req, res) => {
    if (await getCredentialRaw("SMTP", "DEFAULT")) await deleteCredential("SMTP", "DEFAULT", req.admin.id);
    ok(res, await describeSmtpSettings());
  })
);

// GET /admin/email/status — SMTP configured? host/port/sender, never the password.
adminEmailRouter.get("/status", asyncHandler(async (_req, res) => ok(res, await getEmailStatus())));

// POST /admin/email/test — verify transport + send a safe test message.
adminEmailRouter.post(
  "/test",
  asyncHandler(async (req, res) => {
    const { recipient } = testEmailSchema.parse(req.body);
    const result = await sendTestEmail(recipient, req.admin.id);
    ok(res, result);
  })
);

// GET /admin/email/health — failed count + recent failures, for a dashboard widget.
adminEmailRouter.get("/health", asyncHandler(async (_req, res) => ok(res, await getEmailHealthSummary())));

// GET /admin/email/logs — paginated EmailLog list.
adminEmailRouter.get(
  "/logs",
  asyncHandler(async (req, res) => {
    const { status, type, page = 1, pageSize = 25 } = logsQuerySchema.parse(req.query);
    const where = { ...(status ? { status } : {}), ...(type ? { type } : {}) };
    const [total, items] = await Promise.all([
      prisma.emailLog.count({ where }),
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    ok(res, { items, total, page, pageSize });
  })
);

// GET /admin/email/logs/:id — single EmailLog entry detail.
adminEmailRouter.get(
  "/logs/:id",
  asyncHandler(async (req, res) => {
    const log = await prisma.emailLog.findUnique({ where: { id: req.params.id } });
    if (!log) throw ApiError.notFound("Email log entry not found.");
    ok(res, log);
  })
);

// POST /admin/email/logs/:id/retry — explicit, admin-only manual retry.
adminEmailRouter.post(
  "/logs/:id/retry",
  asyncHandler(async (req, res) => ok(res, await retryEmailLog(req.params.id, req.admin.id)))
);
