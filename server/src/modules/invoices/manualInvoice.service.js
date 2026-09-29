// Manual/offline invoice flow: admin-authored invoices for sales that never
// went through the online checkout. Two-phase lifecycle:
//   DRAFT   -> freely editable, no invoice number, not counted toward the
//              InvoiceSequence.
//   ISSUED  -> invoice number assigned via the SAME allocateInvoiceNumber()
//              helper the automatic flow uses (invoice.service.js), snapshot
//              frozen, PDF generated, immutable from then on.
//
// A lightweight synthetic Order row backs every manual Invoice (Invoice.orderId
// is required + unique in the schema, and deeply joined elsewhere — PDF
// rendering, email, customer/guest auth checks). Creating a real minimal
// Order keeps every one of those call sites working unmodified instead of
// threading null-checks through the whole codebase. The synthetic order is
// tagged via its own `notes` field ("MANUAL_INVOICE") so it's easy to spot,
// but nothing about Order's shape changes.
import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { round2 } from "../../utils/money.js";
import { getInvoiceSettings, allocateInvoiceNumber, computeItemTaxLine, regenerateInvoicePdf } from "./invoice.service.js";
import { hashToken } from "../../utils/secureToken.js";

const num = (value) => Number(value || 0);

function isInterState(customerState, settings) {
  const buyerState = customerState;
  const sellerState = settings.state;
  if (!buyerState || !sellerState) return false;
  return String(buyerState).trim().toLowerCase() !== String(sellerState).trim().toLowerCase();
}

function slugifyItemName(name) {
  return `manual-${String(name || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "item"}-${crypto.randomUUID().slice(0, 8)}`;
}

// Resolves a payload item (existing-product OR custom) into the fields
// needed for tax computation + snapshot, autofilling from the Product row
// when productId is given. Admin overrides (quantity/salePrice) win.
async function resolveManualItem(rawItem, settings) {
  const quantity = Math.max(1, Number(rawItem.quantity || 1));

  if (rawItem.productId) {
    const product = await prisma.product.findUnique({ where: { id: rawItem.productId } });
    if (!product) throw ApiError.badRequest(`Product ${rawItem.productId} not found`);
    const unitPrice = rawItem.salePrice != null ? Number(rawItem.salePrice) : Number(product.salePrice ?? product.price);
    return {
      productId: product.id,
      itemName: product.invoiceName || product.name,
      sku: product.sku || null,
      hsnCode: product.hsnCode || null,
      gstRate: product.gstRate != null ? Number(product.gstRate) : 0,
      unit: product.unit || "PCS",
      taxPricingMode: product.taxPricingMode || settings.defaultTaxPricingMode || "TAX_EXCLUSIVE",
      quantity,
      unitPrice,
      slug: product.slug,
    };
  }

  // Custom manual item: everything supplied directly by the admin.
  if (!rawItem.itemName) throw ApiError.badRequest("itemName is required for a custom invoice item");
  return {
    productId: null,
    itemName: rawItem.itemName,
    sku: null,
    hsnCode: rawItem.hsnCode || null,
    gstRate: rawItem.gstRate != null ? Number(rawItem.gstRate) : 0,
    unit: rawItem.unit || "PCS",
    taxPricingMode: rawItem.taxPricingMode || settings.defaultTaxPricingMode || "TAX_EXCLUSIVE",
    quantity,
    unitPrice: Number(rawItem.unitPrice || 0),
    slug: slugifyItemName(rawItem.itemName),
  };
}

// Same math as the automatic flow's calculatePerItem, re-derived for a flat
// item list (no discount allocation across lines here — manual invoices
// don't currently support an order-level discount; per-item pricing is
// exactly what the admin entered).
function computeManualTotals(resolvedItems, settings, { interState }) {
  const lineTotal = (item) => round2(item.unitPrice * item.quantity);
  const items = resolvedItems.map((item) => {
    const priceAfterDiscount = lineTotal(item);
    const tax = computeItemTaxLine({ priceAfterDiscount, gstRate: item.gstRate, taxPricingMode: item.taxPricingMode, interState });
    return {
      productName: item.itemName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: 0,
      hsnCode: item.hsnCode,
      gstRate: item.gstRate,
      unit: item.unit,
      taxPricingMode: item.taxPricingMode,
      taxableValue: tax.taxableValue,
      taxAmount: tax.taxAmount,
      cgstAmount: tax.cgstAmount,
      sgstAmount: tax.sgstAmount,
      igstAmount: tax.igstAmount,
      lineTotal: tax.lineTotal,
      productId: item.productId,
    };
  });

  const subtotal = round2(items.reduce((sum, i) => sum + i.taxableValue, 0));
  const cgstAmount = round2(items.reduce((sum, i) => sum + i.cgstAmount, 0));
  const sgstAmount = round2(items.reduce((sum, i) => sum + i.sgstAmount, 0));
  const igstAmount = round2(items.reduce((sum, i) => sum + i.igstAmount, 0));
  const taxAmount = round2(cgstAmount + sgstAmount + igstAmount);
  const totalAmount = round2(subtotal + taxAmount);

  return {
    items,
    subtotal,
    taxAmount,
    totalAmount,
    tax: {
      enabled: true,
      rate: null,
      gstin: settings.gstin || "",
      pan: settings.pan || "",
      state: settings.state || "",
      stateCode: settings.stateCode || "",
      cgstAmount,
      sgstAmount,
      igstAmount,
      hasIncompleteTaxData: false,
    },
  };
}

function addressJson(addr, fallbackName, fallbackPhone) {
  if (!addr) return null;
  return {
    fullName: addr.fullName || fallbackName,
    phone: addr.phone || fallbackPhone || "",
    addressLine1: addr.addressLine1 || "",
    addressLine2: addr.addressLine2 || "",
    city: addr.city || "",
    state: addr.state || "",
    postalCode: addr.postalCode || "",
    country: addr.country || "India",
  };
}

async function createSyntheticOrder(tx, payload, totals) {
  const orderNumber = `MAN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const accessTokenHash = hashToken(crypto.randomBytes(24).toString("hex"));
  return tx.order.create({
    data: {
      orderNumber,
      customerName: payload.customer.name,
      customerEmail: payload.customer.email,
      customerPhone: payload.customer.phone || "",
      status: "DELIVERED",
      paymentStatus: "PAID",
      subtotal: totals.subtotal,
      shippingAmount: 0,
      discountAmount: 0,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      currency: "INR",
      notes: "MANUAL_INVOICE",
      accessTokenHash,
      paymentMethod: payload.invoice?.paymentMethod || "manual",
      billingSameAsShipping: false,
    },
  });
}

function buildCompanySnapshot(settings) {
  return {
    legalName: settings.legalName,
    address: settings.address,
    email: settings.email,
    phone: settings.phone,
    gstin: settings.gstin || null,
    pan: settings.pan || null,
    footer: settings.footer,
    terms: settings.terms,
    logoUrl: settings.logoUrl || null,
    signatoryName: settings.signatoryName || "",
    signatureUrl: settings.signatureUrl || null,
    bank: {
      bankName: settings.bankName || "",
      accountHolder: settings.bankAccountHolder || "",
      accountNumber: settings.bankAccountNumber || "",
      ifsc: settings.bankIfsc || "",
      branch: settings.bankBranch || "",
      upiId: settings.upiId || "",
    },
  };
}

// Computes (but does not persist) everything needed for the draft snapshot,
// so a draft is always a valid, self-consistent Invoice row even before it
// has a number.
async function buildManualSnapshot(payload, settings) {
  const interState = isInterState(payload.customer.state, settings);
  const resolvedItems = [];
  for (const rawItem of payload.items || []) {
    resolvedItems.push(await resolveManualItem(rawItem, settings));
  }
  if (!resolvedItems.length) throw ApiError.badRequest("At least one item is required");
  const totals = computeManualTotals(resolvedItems, settings, { interState });
  return { totals, interState };
}

// Informational, non-persisting tax preview for the admin "create invoice"
// UI (live preview while typing). Reuses buildManualSnapshot -> the exact
// same resolveManualItem/computeItemTaxLine/isInterState path the real
// draft/issue endpoints use, so the numbers shown here are guaranteed to be
// byte-for-byte identical to what gets persisted on submit (this is the
// "real endpoint" approach chosen for task 3/7's rounding parity, rather
// than mirroring the rounding logic separately in frontend JS — see
// AdminInvoiceCreate.jsx for the corresponding fetch). Nothing is written
// to the database; no Order/Invoice/AdminAuditLog row is created.
export async function previewManualInvoice(payload) {
  const settings = await getInvoiceSettings();
  const { totals, interState } = await buildManualSnapshot(payload, settings);
  return {
    items: totals.items,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    tax: totals.tax,
    interState,
  };
}

export async function createManualInvoiceDraft(adminId, payload) {
  if (!payload?.customer?.name || !payload?.customer?.email) throw ApiError.badRequest("customer.name and customer.email are required");
  const settings = await getInvoiceSettings();
  const { totals } = await buildManualSnapshot(payload, settings);

  const billingAddress = addressJson(payload.customer.billingAddress, payload.customer.name, payload.customer.phone) || {
    fullName: payload.customer.name,
    phone: payload.customer.phone || "",
    addressLine1: "",
    city: "",
    state: payload.customer.state || "",
    postalCode: "",
    country: "India",
  };
  const shippingAddress = addressJson(payload.customer.shippingAddress, payload.customer.name, payload.customer.phone);

  const invoice = await prisma.$transaction(async (tx) => {
    const order = await createSyntheticOrder(tx, payload, totals);
    const created = await tx.invoice.create({
      data: {
        orderId: order.id,
        invoiceNumber: null,
        invoiceDate: payload.invoice?.date ? new Date(payload.invoice.date) : new Date(),
        customerName: payload.customer.name,
        customerEmail: payload.customer.email,
        customerPhone: payload.customer.phone || null,
        billingAddress,
        shippingAddress,
        subtotal: totals.subtotal,
        discountAmount: 0,
        shippingAmount: 0,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        currency: "INR",
        companySnapshot: buildCompanySnapshot(settings),
        taxSnapshot: totals.tax,
        itemsSnapshot: totals.items,
        source: "MANUAL",
        status: "DRAFT",
        createdByAdminId: adminId,
        notes: payload.invoice?.notes || null,
        paymentMethod: payload.invoice?.paymentMethod || null,
        paymentReference: payload.invoice?.paymentReference || null,
      },
    });
    await tx.adminAuditLog.create({ data: { adminId, action: "MANUAL_INVOICE_CREATED", provider: "invoices", metadata: { invoiceId: created.id, orderId: order.id } } });
    return created;
  });
  return invoice;
}

async function assertEditable(invoiceId) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw ApiError.notFound("Invoice not found");
  if (invoice.source !== "MANUAL") throw ApiError.badRequest("Only manual invoices can be edited through this endpoint");
  if (invoice.status !== "DRAFT") throw ApiError.forbidden("Only DRAFT invoices can be edited; this invoice has already been issued and is immutable");
  return invoice;
}

export async function editManualInvoiceDraft(invoiceId, adminId, payload) {
  const existing = await assertEditable(invoiceId);
  const settings = await getInvoiceSettings();
  const { totals } = await buildManualSnapshot(payload, settings);

  const billingAddress = addressJson(payload.customer.billingAddress, payload.customer.name, payload.customer.phone) || existing.billingAddress;
  const shippingAddress = addressJson(payload.customer.shippingAddress, payload.customer.name, payload.customer.phone);

  const updated = await prisma.$transaction(async (tx) => {
    // Keep the synthetic order's totals/customer fields in sync too, since
    // PDF rendering and any future order-based lookups read from it.
    await tx.order.update({
      where: { id: existing.orderId },
      data: {
        customerName: payload.customer.name,
        customerEmail: payload.customer.email,
        customerPhone: payload.customer.phone || "",
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        paymentMethod: payload.invoice?.paymentMethod || "manual",
      },
    });
    const row = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        invoiceDate: payload.invoice?.date ? new Date(payload.invoice.date) : existing.invoiceDate,
        customerName: payload.customer.name,
        customerEmail: payload.customer.email,
        customerPhone: payload.customer.phone || null,
        billingAddress,
        shippingAddress,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        companySnapshot: buildCompanySnapshot(settings),
        taxSnapshot: totals.tax,
        itemsSnapshot: totals.items,
        notes: payload.invoice?.notes ?? existing.notes,
        paymentMethod: payload.invoice?.paymentMethod ?? existing.paymentMethod,
        paymentReference: payload.invoice?.paymentReference ?? existing.paymentReference,
      },
    });
    await tx.adminAuditLog.create({ data: { adminId, action: "MANUAL_INVOICE_EDITED", provider: "invoices", metadata: { invoiceId } } });
    return row;
  });
  return updated;
}

export async function issueManualInvoice(invoiceId, adminId, { sendEmail = false } = {}) {
  const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!existing) throw ApiError.notFound("Invoice not found");
  if (existing.source !== "MANUAL") throw ApiError.badRequest("Only manual invoices can be issued through this endpoint");
  if (existing.status === "ISSUED") {
    // Idempotent no-op on the numbering/freezing step; email send below is
    // still allowed to fire (e.g. admin picks "Issue & Send" after already
    // issuing without email).
  } else {
    const settings = await getInvoiceSettings();
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (fresh.status === "ISSUED") return; // race: already issued by a concurrent call
      const { invoiceNumber, date } = await allocateInvoiceNumber(tx, settings);
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { invoiceNumber, invoiceDate: date, status: "ISSUED" },
      });
      await tx.adminAuditLog.create({ data: { adminId, action: "MANUAL_INVOICE_ISSUED", provider: "invoices", metadata: { invoiceId, invoiceNumber } } });
    });
  }

  await regenerateInvoicePdf(invoiceId);

  if (sendEmail) {
    const { sendInvoiceEmail } = await import("../email/email.service.js");
    const result = await sendInvoiceEmail(invoiceId, { resend: true, adminId });
    await prisma.adminAuditLog.create({ data: { adminId, action: "MANUAL_INVOICE_EMAILED", provider: "invoices", metadata: { invoiceId, sent: result.sent } } });
  }

  return prisma.invoice.findUnique({ where: { id: invoiceId } });
}

export async function uploadExternalInvoicePdf(invoiceId, adminId, { externalInvoiceNumber, externalInvoiceDate, storageKey, makeCanonical = false }) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw ApiError.notFound("Invoice not found");
  const data = {
    externalPdfStorageKey: storageKey,
    externalInvoiceNumber: externalInvoiceNumber || null,
    externalInvoiceDate: externalInvoiceDate ? new Date(externalInvoiceDate) : null,
    externalPdfUploadedAt: new Date(),
    externalPdfIsCanonical: Boolean(makeCanonical),
  };
  // Only when the admin explicitly designates it canonical do we point the
  // regular download route at the uploaded file. We never overwrite the
  // structured PDF's own key implicitly.
  if (makeCanonical) data.pdfStorageKey = storageKey;
  const updated = await prisma.invoice.update({ where: { id: invoiceId }, data });
  await prisma.adminAuditLog.create({ data: { adminId, action: "INVOICE_EXTERNAL_PDF_UPLOADED", provider: "invoices", metadata: { invoiceId, makeCanonical } } });
  return updated;
}
