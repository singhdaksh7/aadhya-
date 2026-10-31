import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { getInvoiceSettings, calculateInvoiceTax, regenerateInvoicePdf } from "./invoice.service.js";
import { isValidGstRate, isValidHsnCode, isValidGstin, VALID_GST_RATES } from "./invoice.tax.js";

const num = (v) => Number(v || 0);

// Reports what is missing for invoices to carry correct GST. Read-only.
export async function getInvoiceTaxReadiness() {
  const settings = await getInvoiceSettings();
  const [totalProducts, missingRate, missingHsn] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: true, gstRate: null } }),
    prisma.product.count({ where: { isActive: true, OR: [{ hsnCode: null }, { hsnCode: "" }] } }),
  ]);
  const issues = [];
  const add = (code, severity, message) => issues.push({ code, severity, message });
  if (!settings.gstEnabled) add("GST_DISABLED", "error", "GST is switched off. Invoices carry no tax unless products have their own GST rate.");
  if (!settings.gstin) add("GSTIN_MISSING", "error", "Your GSTIN is not set. Invoices will print as plain invoices, not tax invoices.");
  else if (!isValidGstin(settings.gstin)) add("GSTIN_INVALID", "error", "Your GSTIN is not a valid 15-character GSTIN.");
  if (!settings.state) add("STATE_MISSING", "error", "Company state is not set. CGST/SGST vs IGST cannot be decided reliably.");
  if (!settings.stateCode) add("STATE_CODE_MISSING", "warning", "Company GST state code is not set.");
  if (!(num(settings.defaultTaxRate) > 0)) add("DEFAULT_RATE_MISSING", "warning", "No default GST rate is set. Products without their own rate will show 'GST not configured'.");
  if (missingRate > 0) add("PRODUCTS_MISSING_RATE", "warning", `${missingRate} active product(s) have no GST rate.`);
  if (missingHsn > 0) add("PRODUCTS_MISSING_HSN", "warning", `${missingHsn} active product(s) have no HSN code.`);
  return {
    gstEnabled: Boolean(settings.gstEnabled),
    gstin: settings.gstin || "",
    state: settings.state || "",
    stateCode: settings.stateCode || "",
    defaultTaxRate: num(settings.defaultTaxRate),
    totalProducts,
    productsMissingGstRate: missingRate,
    productsMissingHsn: missingHsn,
    ready: issues.every((i) => i.severity !== "error") && missingRate === 0,
    issues,
  };
}

// Opt-in, admin-confirmed bulk default. ONLY touches products that have no
// value yet (gstRate null / hsnCode empty); never overwrites existing data.
// Without confirm:true it is a dry run that just returns the counts.
export async function applyDefaultGstToProducts(adminId, { gstRate, hsnCode, confirm = false } = {}) {
  const hasRate = gstRate !== undefined && gstRate !== null && gstRate !== "";
  const hasHsn = typeof hsnCode === "string" && hsnCode.trim() !== "";
  if (!hasRate && !hasHsn) throw ApiError.badRequest("Provide a GST rate and/or an HSN code to apply.");
  if (hasRate && !isValidGstRate(gstRate)) throw ApiError.badRequest(`gstRate must be one of ${VALID_GST_RATES.join(", ")}`);
  if (hasHsn && !isValidHsnCode(hsnCode)) throw ApiError.badRequest("hsnCode must be 4-8 digits");

  const rateWhere = { isActive: true, gstRate: null };
  const hsnWhere = { isActive: true, OR: [{ hsnCode: null }, { hsnCode: "" }] };
  const [rateCount, hsnCount] = await Promise.all([hasRate ? prisma.product.count({ where: rateWhere }) : 0, hasHsn ? prisma.product.count({ where: hsnWhere }) : 0]);
  if (!confirm) return { dryRun: true, wouldUpdateGstRate: rateCount, wouldUpdateHsn: hsnCount };

  const result = await prisma.$transaction(async (tx) => {
    const r = hasRate ? await tx.product.updateMany({ where: rateWhere, data: { gstRate: Number(gstRate) } }) : { count: 0 };
    const h = hasHsn ? await tx.product.updateMany({ where: hsnWhere, data: { hsnCode: hsnCode.trim() } }) : { count: 0 };
    await tx.adminAuditLog.create({ data: { adminId, action: "PRODUCT_GST_DEFAULTS_APPLIED", provider: "invoice", metadata: { gstRate: hasRate ? Number(gstRate) : null, hsnCode: hasHsn ? hsnCode.trim() : null, gstRateUpdated: r.count, hsnUpdated: h.count } } });
    return { gstRateUpdated: r.count, hsnUpdated: h.count };
  });
  return { dryRun: false, ...result };
}

// Explicit admin-triggered correction of an already-issued ONLINE invoice:
// recomputes tax from the CURRENT settings/product data, keeps the invoice
// number, date and total, rewrites the snapshots + PDF, and logs before/after.
export async function recomputeInvoiceTax(invoiceId, adminId) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (invoice.source !== "ONLINE") throw ApiError.badRequest("Tax can only be recomputed for order invoices, not manual invoices.");
  if (invoice.externalPdfIsCanonical) throw ApiError.badRequest("This invoice uses an uploaded external PDF as canonical; recompute is not allowed.");

  const settings = await getInvoiceSettings();
  const order = await prisma.order.findUnique({ where: { id: invoice.orderId }, include: { items: { include: { product: true, variant: true } }, address: true } });
  if (!order) throw ApiError.notFound("Order not found");
  const calculated = calculateInvoiceTax(order, settings);
  const newTax = round(calculated.tax.cgstAmount + calculated.tax.sgstAmount + calculated.tax.igstAmount);
  const nextTaxAmount = calculated.tax.enabled ? newTax : num(order.taxAmount);
  const before = { taxAmount: num(invoice.taxAmount), totalAmount: num(invoice.totalAmount), cgst: num(invoice.taxSnapshot?.cgstAmount), sgst: num(invoice.taxSnapshot?.sgstAmount), igst: num(invoice.taxSnapshot?.igstAmount) };

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        taxAmount: nextTaxAmount,
        totalAmount: calculated.totalAmount,
        taxSnapshot: calculated.tax,
        itemsSnapshot: calculated.items,
        companySnapshot: { ...(invoice.companySnapshot || {}), gstin: settings.gstin || null, pan: settings.pan || null },
      },
    });
    for (const item of calculated.items) {
      if (!item.orderItemId) continue;
      await tx.orderItem.update({
        where: { id: item.orderItemId },
        data: { hsnCodeSnapshot: item.hsnCode ?? null, gstRateSnapshot: item.gstRate ?? null, unitSnapshot: item.unit ?? null, cgstAmount: item.cgstAmount ?? null, sgstAmount: item.sgstAmount ?? null, igstAmount: item.igstAmount ?? null, taxableValueSnapshot: item.taxableValue ?? null },
      });
    }
    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: "INVOICE_TAX_RECOMPUTED",
        provider: "invoice",
        metadata: { invoiceId: invoice.id, orderId: invoice.orderId, invoiceNumber: invoice.invoiceNumber, before, after: { taxAmount: nextTaxAmount, totalAmount: calculated.totalAmount, cgst: calculated.tax.cgstAmount, sgst: calculated.tax.sgstAmount, igst: calculated.tax.igstAmount }, unratedItems: calculated.tax.unratedItemCount ?? 0 },
      },
    });
  });
  return regenerateInvoicePdf(invoice.id);
}

function round(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
