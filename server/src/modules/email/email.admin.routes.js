import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireRole } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { getEmailStatus, sendTestEmail, getEmailHealthSummary, retryEmailLog } from "./email.service.js";

export const adminEmailRouter = Router();
adminEmailRouter.use(requireAdmin, requireRole("SUPER_ADMIN"));

const testEmailSchema = z.object({ recipient: z.string().email().max(300) });
const logsQuerySchema = z.object({
  status: z.enum(["SENT", "FAILED", "SKIPPED"]).optional(),
  type: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

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
