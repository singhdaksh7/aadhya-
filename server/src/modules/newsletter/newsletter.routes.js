import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { created, ok } from "../../utils/apiResponse.js";
import { newsletterLimiter } from "../../middleware/rateLimiters.js";

const emailSchema = z.string().trim().min(1, "Please enter your email address.").max(254, "That email address is too long.").email("Please enter a valid email address.");

// Public: POST /api/newsletter/subscribe. Subscribing an address that is already on the list is a
// success (same response), so the visitor is never shown an error for it.
export const newsletterRouter = Router();
newsletterRouter.post(
  "/subscribe",
  newsletterLimiter,
  asyncHandler(async (req, res) => {
    const raw = req.body?.email;
    const parsed = emailSchema.safeParse(typeof raw === "string" ? raw : "");
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || "Please enter a valid email address.";
      return res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message, details: [{ path: "email", message }] } });
    }
    const email = parsed.data.toLowerCase();
    await prisma.newsletterSubscriber.upsert({ where: { email }, create: { email }, update: {} });
    created(res, { subscribed: true });
  })
);

// Admin: list / search / export / delete (delete = unsubscribe, the row is removed).
export const adminNewsletterRouter = Router();
adminNewsletterRouter.use(requireAdmin);

const searchWhere = (q) => (q && String(q).trim() ? { email: { contains: String(q).trim().toLowerCase(), mode: "insensitive" } } : {});

adminNewsletterRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize, 10) || 50));
    const where = searchWhere(req.query.q);
    const [items, total, totalAll] = await Promise.all([
      prisma.newsletterSubscriber.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.newsletterSubscriber.count({ where }),
      prisma.newsletterSubscriber.count(),
    ]);
    ok(res, { items, total, totalAll, page, pageSize });
  })
);

// Spreadsheet apps execute cells starting with = + - @; prefix those with an apostrophe.
export const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

adminNewsletterRouter.get(
  "/export",
  asyncHandler(async (req, res) => {
    const rows = await prisma.newsletterSubscriber.findMany({ where: searchWhere(req.query.q), orderBy: { createdAt: "desc" } });
    const csv = ["Email,Subscribed at", ...rows.map((r) => `${csvCell(r.email)},${csvCell(r.createdAt.toISOString())}`)].join("\r\n") + "\r\n";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="newsletter-subscribers.csv"');
    res.status(200).send(csv);
  })
);

adminNewsletterRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { count } = await prisma.newsletterSubscriber.deleteMany({ where: { id: req.params.id } });
    if (!count) return res.status(404).json({ success: false, error: { message: "Subscriber not found" } });
    ok(res, { deleted: true });
  })
);
