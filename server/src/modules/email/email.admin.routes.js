import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireRole } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { getEmailStatus, sendTestEmail, getEmailHealthSummary, retryEmailLog, getSmtpConfig } from "./email.service.js";
import { getCredentialRaw, saveCredential, deleteCredential } from "../integrations/credential.service.js";
import { EMAIL_TEMPLATES, TEMPLATE_VARIABLES } from "../mailer/templates.js";
import { listTemplates, previewTemplate, validateTemplateInput, retryNotification, getBrand, loadTemplate } from "../mailer/mailer.service.js";
import { composeEmail } from "../mailer/render.js";
import { deliverEmail } from "./email.service.js";

export const adminEmailRouter = Router();
adminEmailRouter.use(requireAdmin, requireRole("SUPER_ADMIN"));

const testEmailSchema = z.object({ recipient: z.string().email().max(300) });
const logsQuerySchema = z.object({
  status: z.enum(["SENT", "FAILED", "SKIPPED"]).optional(),
  type: z.string().max(50).optional(),
  orderId: z.string().max(64).optional(),
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
    const { status, type, orderId, page = 1, pageSize = 25 } = logsQuerySchema.parse(req.query);
    const where = { ...(status ? { status } : {}), ...(type ? { type } : {}), ...(orderId ? { orderId } : {}) };
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

// ---------------------------------------------------------------------------------------------------
// Email templates: Admin edits wording (subject, heading, message) with whitelisted {{placeholders}}.
// Layout, order summary, login-code box and safety rules stay in code; security emails cannot be disabled.
// ---------------------------------------------------------------------------------------------------
const templateInput = z.object({
  subject: z.string().trim().min(3).max(200),
  heading: z.string().trim().min(2).max(200),
  body: z.string().trim().min(5).max(4000),
  enabled: z.boolean().optional(),
});

function assertValidTemplate(key, input) {
  if (!EMAIL_TEMPLATES[key]) throw ApiError.notFound("Unknown email template.");
  const unknown = validateTemplateInput(input);
  if (unknown.length) throw ApiError.badRequest(`Unknown placeholder${unknown.length > 1 ? "s" : ""}: ${unknown.map((n) => `{{${n}}}`).join(", ")}.`, { placeholders: unknown });
  if (/<\s*script|javascript:/i.test(`${input.subject} ${input.heading} ${input.body}`)) throw ApiError.badRequest("Scripts are not allowed in email text.");
}

adminEmailRouter.get("/templates", asyncHandler(async (_req, res) => ok(res, { templates: await listTemplates(), variables: TEMPLATE_VARIABLES })));

adminEmailRouter.put(
  "/templates/:key",
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const input = templateInput.parse(req.body);
    assertValidTemplate(key, input);
    const def = EMAIL_TEMPLATES[key];
    const enabled = def.locked ? true : input.enabled ?? def.defaultEnabled;
    await prisma.emailTemplate.upsert({
      where: { key },
      create: { key, subject: input.subject, heading: input.heading, body: input.body, enabled, updatedById: req.admin.id },
      update: { subject: input.subject, heading: input.heading, body: input.body, enabled, updatedById: req.admin.id },
    });
    await prisma.adminAuditLog.create({ data: { adminId: req.admin.id, action: "EMAIL_TEMPLATE_UPDATED", provider: "email", metadata: { key, enabled } } });
    ok(res, (await listTemplates()).find((t) => t.key === key));
  })
);

// Toggle only (works for templates left at their default wording too).
adminEmailRouter.patch(
  "/templates/:key/enabled",
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    const def = EMAIL_TEMPLATES[key];
    if (!def) throw ApiError.notFound("Unknown email template.");
    if (def.locked && !enabled) throw ApiError.badRequest("Security emails (login code, password reset) cannot be switched off.");
    await prisma.emailTemplate.upsert({
      where: { key },
      create: { key, subject: def.subject, heading: def.heading, body: def.body, enabled, updatedById: req.admin.id },
      update: { enabled, updatedById: req.admin.id },
    });
    await prisma.adminAuditLog.create({ data: { adminId: req.admin.id, action: "EMAIL_TEMPLATE_TOGGLED", provider: "email", metadata: { key, enabled } } });
    ok(res, (await listTemplates()).find((t) => t.key === key));
  })
);

adminEmailRouter.post(
  "/templates/:key/preview",
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    if (!EMAIL_TEMPLATES[key]) throw ApiError.notFound("Unknown email template.");
    const draft = req.body && Object.keys(req.body).length ? templateInput.pick({ subject: true, heading: true, body: true }).parse(req.body) : null;
    if (draft) assertValidTemplate(key, draft);
    ok(res, await previewTemplate(key, draft));
  })
);

adminEmailRouter.post(
  "/templates/:key/reset",
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    if (!EMAIL_TEMPLATES[key]) throw ApiError.notFound("Unknown email template.");
    await prisma.emailTemplate.deleteMany({ where: { key } });
    await prisma.adminAuditLog.create({ data: { adminId: req.admin.id, action: "EMAIL_TEMPLATE_RESET", provider: "email", metadata: { key } } });
    ok(res, (await listTemplates()).find((t) => t.key === key));
  })
);

// Sends the preview (sample data) to an address so the real inbox rendering can be checked.
adminEmailRouter.post(
  "/templates/:key/send-test",
  asyncHandler(async (req, res) => {
    const { key } = req.params;
    const { recipient } = testEmailSchema.parse(req.body);
    if (!EMAIL_TEMPLATES[key]) throw ApiError.notFound("Unknown email template.");
    const tpl = await loadTemplate(key);
    const mail = await previewTemplate(key, tpl.override);
    const result = await deliverEmail({ to: recipient, subject: `[Preview] ${mail.subject}`, html: mail.html, text: mail.text, type: "TEMPLATE_TEST", event: key, source: "ADMIN" });
    ok(res, { sent: result.sent, reason: result.reason || null });
  })
);

// ---- notification ledger: what was sent for an order, what failed, manual retry ---------------------------
adminEmailRouter.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const q = z.object({ orderId: z.string().max(64).optional(), status: z.enum(["PENDING", "SENT", "FAILED"]).optional(), limit: z.coerce.number().int().min(1).max(100).optional() }).parse(req.query);
    const items = await prisma.notificationEvent.findMany({
      where: { ...(q.orderId ? { orderId: q.orderId } : {}), ...(q.status ? { status: q.status } : {}) },
      orderBy: { createdAt: "desc" },
      take: q.limit || 50,
      select: { id: true, event: true, orderId: true, recipient: true, source: true, status: true, attempts: true, lastError: true, nextRetryAt: true, sentAt: true, createdAt: true },
    });
    ok(res, { items });
  })
);
adminEmailRouter.post("/notifications/:id/retry", asyncHandler(async (req, res) => ok(res, await retryNotification(req.params.id, req.admin.id))));
