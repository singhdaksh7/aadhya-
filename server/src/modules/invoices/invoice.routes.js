import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireRole } from "../../middleware/adminAuth.js";
import { requireCustomer } from "../../middleware/customerAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { getInvoiceSettings, updateInvoiceSettings, getInvoiceFile, listCustomerInvoices, listAdminInvoices, assertCustomerInvoice, assertGuestInvoice, regenerateInvoicePdf, getInvoiceDetail } from "./invoice.service.js";
import { createManualInvoiceDraft, editManualInvoiceDraft, issueManualInvoice, uploadExternalInvoicePdf } from "./manualInvoice.service.js";
import { sendInvoiceEmail } from "../email/email.service.js";
import { bookPdfUpload, verifyPdfContent } from "../uploads/upload.middleware.js";
import { writeInvoicePdf } from "./invoice.storage.js";
import { prisma } from "../../lib/prisma.js";

function sendFile(res, file) { res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`); if (file.size) res.setHeader("Content-Length", String(file.size)); file.stream.on("error", () => res.destroy()); file.stream.pipe(res); }
const settingsSchema = z.object({ prefix: z.string().trim().min(1).max(30), nextInvoiceNumber: z.coerce.number().int().min(1), financialYearFormat: z.string().trim().max(40).optional(), legalName: z.string().trim().min(1).max(200), address: z.string().trim().max(1000).optional(), email: z.string().trim().email().or(z.literal("")).optional(), phone: z.string().trim().max(50).optional(), gstin: z.string().trim().max(30).optional(), pan: z.string().trim().max(30).optional(), state: z.string().trim().max(100).optional(), stateCode: z.string().trim().max(10).optional(), gstEnabled: z.boolean().optional(), defaultTaxRate: z.coerce.number().min(0).max(100).optional(), footer: z.string().trim().max(2000).optional(), terms: z.string().trim().max(4000).optional(), codInvoiceAt: z.enum(["CONFIRMED", "SHIPPED"]).optional(), defaultTaxPricingMode: z.enum(["TAX_INCLUSIVE", "TAX_EXCLUSIVE"]).optional(), shippingTaxRate: z.coerce.number().min(0).max(100).optional(), shippingHsnCode: z.string().trim().max(20).or(z.literal("")).optional().nullable(), bankName: z.string().trim().max(200).optional(), bankAccountHolder: z.string().trim().max(200).optional(), bankAccountNumber: z.string().trim().max(40).optional(), bankIfsc: z.string().trim().max(20).optional(), bankBranch: z.string().trim().max(200).optional(), upiId: z.string().trim().max(100).optional(), logoUrl: z.string().trim().max(1000).or(z.literal("")).optional().nullable(), signatoryName: z.string().trim().max(200).optional(), signatureUrl: z.string().trim().max(1000).or(z.literal("")).optional().nullable() });
const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  invoiceNumber: z.string().trim().max(100).optional(),
  orderNumber: z.string().trim().max(100).optional(),
  customer: z.string().trim().max(200).optional(),
  dateFrom: z.string().trim().max(40).optional(),
  dateTo: z.string().trim().max(40).optional(),
  paymentMethod: z.string().trim().max(40).optional(),
  status: z.string().trim().max(40).optional(),
});

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
adminInvoiceRouter.get("/:id", asyncHandler(async (req, res) => ok(res, await getInvoiceDetail(req.params.id))));
adminInvoiceRouter.post("/:id/regenerate", asyncHandler(async (req, res) => ok(res, await regenerateInvoicePdf(req.params.id))));
adminInvoiceRouter.post("/:id/resend", asyncHandler(async (req, res) => ok(res, await sendInvoiceEmail(req.params.id, { resend: true, adminId: req.admin.id }))));

// --- Manual/offline invoices (Phase 2) ---
const manualCustomerSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().max(20).optional(),
  billingAddress: z.object({ fullName: z.string().optional(), phone: z.string().optional(), addressLine1: z.string().optional(), addressLine2: z.string().optional(), city: z.string().optional(), state: z.string().optional(), postalCode: z.string().optional(), country: z.string().optional() }).optional(),
  shippingAddress: z.object({ fullName: z.string().optional(), phone: z.string().optional(), addressLine1: z.string().optional(), addressLine2: z.string().optional(), city: z.string().optional(), state: z.string().optional(), postalCode: z.string().optional(), country: z.string().optional() }).optional(),
  state: z.string().trim().max(100).optional(),
  stateCode: z.string().trim().max(10).optional(),
});
const manualInvoiceMetaSchema = z.object({
  date: z.string().trim().optional(),
  paymentMethod: z.string().trim().max(50).optional(),
  paymentReference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});
const manualItemSchema = z.union([
  z.object({ productId: z.string().trim().min(1), quantity: z.coerce.number().int().min(1), salePrice: z.coerce.number().min(0).optional() }),
  z.object({ itemName: z.string().trim().min(1), description: z.string().trim().max(500).optional(), hsnCode: z.string().trim().optional(), unit: z.string().trim().optional(), quantity: z.coerce.number().int().min(1), unitPrice: z.coerce.number().min(0), gstRate: z.coerce.number().min(0).max(100).optional(), taxPricingMode: z.enum(["TAX_INCLUSIVE", "TAX_EXCLUSIVE"]).optional() }),
]);
const manualInvoicePayloadSchema = z.object({ customer: manualCustomerSchema, invoice: manualInvoiceMetaSchema.optional(), items: z.array(manualItemSchema).min(1) });

adminInvoiceRouter.post("/manual", requireRole("SUPER_ADMIN", "ADMIN"), asyncHandler(async (req, res) => {
  const payload = manualInvoicePayloadSchema.parse(req.body);
  ok(res, await createManualInvoiceDraft(req.admin.id, payload));
}));
adminInvoiceRouter.patch("/manual/:id", requireRole("SUPER_ADMIN", "ADMIN"), asyncHandler(async (req, res) => {
  const payload = manualInvoicePayloadSchema.parse(req.body);
  ok(res, await editManualInvoiceDraft(req.params.id, req.admin.id, payload));
}));
adminInvoiceRouter.post("/manual/:id/issue", requireRole("SUPER_ADMIN", "ADMIN"), asyncHandler(async (req, res) => {
  const body = z.object({ sendEmail: z.boolean().optional().default(false) }).parse(req.body || {});
  ok(res, await issueManualInvoice(req.params.id, req.admin.id, { sendEmail: body.sendEmail }));
}));

adminInvoiceRouter.post(
  "/:id/external-pdf",
  requireRole("SUPER_ADMIN", "ADMIN"),
  bookPdfUpload.single("file"),
  verifyPdfContent,
  asyncHandler(async (req, res) => {
    const body = z.object({ externalInvoiceNumber: z.string().trim().max(100).optional(), externalInvoiceDate: z.string().trim().optional(), makeCanonical: z.coerce.boolean().optional().default(false) }).parse(req.body || {});
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return res.status(404).json({ success: false, error: { message: "Invoice not found" } });
    if (!req.file) return res.status(400).json({ success: false, error: { message: "file is required" } });
    const key = `invoice-${invoice.id}-external-${Date.now()}.pdf`;
    await writeInvoicePdf(key, req.file.buffer);
    const updated = await uploadExternalInvoicePdf(invoice.id, req.admin.id, {
      externalInvoiceNumber: body.externalInvoiceNumber,
      externalInvoiceDate: body.externalInvoiceDate,
      storageKey: key,
      makeCanonical: body.makeCanonical,
    });
    ok(res, updated);
  })
);
