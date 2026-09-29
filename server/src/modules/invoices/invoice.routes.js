import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireRole } from "../../middleware/adminAuth.js";
import { requireCustomer } from "../../middleware/customerAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { getInvoiceSettings, updateInvoiceSettings, getInvoiceFile, listCustomerInvoices, listAdminInvoices, assertCustomerInvoice, assertGuestInvoice, regenerateInvoicePdf } from "./invoice.service.js";
import { sendInvoiceEmail } from "../email/email.service.js";

function sendFile(res, file) { res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`); if (file.size) res.setHeader("Content-Length", String(file.size)); file.stream.on("error", () => res.destroy()); file.stream.pipe(res); }
const settingsSchema = z.object({ prefix: z.string().trim().min(1).max(30), nextInvoiceNumber: z.coerce.number().int().min(1), financialYearFormat: z.string().trim().max(40).optional(), legalName: z.string().trim().min(1).max(200), address: z.string().trim().max(1000).optional(), email: z.string().trim().email().or(z.literal("")).optional(), phone: z.string().trim().max(50).optional(), gstin: z.string().trim().max(30).optional(), pan: z.string().trim().max(30).optional(), state: z.string().trim().max(100).optional(), stateCode: z.string().trim().max(10).optional(), gstEnabled: z.boolean().optional(), defaultTaxRate: z.coerce.number().min(0).max(100).optional(), footer: z.string().trim().max(2000).optional(), terms: z.string().trim().max(4000).optional(), codInvoiceAt: z.enum(["CONFIRMED", "SHIPPED"]).optional() });
const adminListQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(200).optional() });

export const customerInvoiceRouter = Router();
customerInvoiceRouter.use(requireCustomer);
customerInvoiceRouter.get("/", asyncHandler(async (req, res) => ok(res, await listCustomerInvoices(req.customer.id))));
customerInvoiceRouter.get("/:id/download", asyncHandler(async (req, res) => { await assertCustomerInvoice(req.customer.id, req.params.id); sendFile(res, await getInvoiceFile(req.params.id)); }));

export const guestInvoiceRouter = Router();
guestInvoiceRouter.post("/:id/download", asyncHandler(async (req, res) => { const body = z.object({ orderNumber: z.string().trim().min(1), accessToken: z.string().trim().length(48) }).parse(req.body); await assertGuestInvoice(body.orderNumber, body.accessToken, req.params.id); sendFile(res, await getInvoiceFile(req.params.id)); }));

export const adminInvoiceRouter = Router();
adminInvoiceRouter.use(requireAdmin);
adminInvoiceRouter.get("/", asyncHandler(async (req, res) => {
  const query = adminListQuerySchema.parse(req.query);
  const result = await listAdminInvoices(query);
  ok(res, result.items, result.meta);
}));
adminInvoiceRouter.get("/settings", requireRole("SUPER_ADMIN"), asyncHandler(async (_req, res) => ok(res, await getInvoiceSettings())));
adminInvoiceRouter.put("/settings", requireRole("SUPER_ADMIN"), asyncHandler(async (req, res) => ok(res, await updateInvoiceSettings(settingsSchema.parse(req.body)))));
adminInvoiceRouter.get("/:id/download", asyncHandler(async (req, res) => sendFile(res, await getInvoiceFile(req.params.id))));
adminInvoiceRouter.post("/:id/regenerate", asyncHandler(async (req, res) => ok(res, await regenerateInvoicePdf(req.params.id))));
adminInvoiceRouter.post("/:id/resend", asyncHandler(async (req, res) => ok(res, await sendInvoiceEmail(req.params.id, { resend: true, adminId: req.admin.id }))));
