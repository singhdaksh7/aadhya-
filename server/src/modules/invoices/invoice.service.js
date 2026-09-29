import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { renderInvoicePdf } from "./invoice.pdf.js";
import { writeInvoicePdf, readInvoicePdf } from "./invoice.storage.js";
import { round2 } from "../../utils/money.js";

const DEFAULTS = {
  prefix: "AADYA",
  financialYearFormat: "YYYY-YY",
  nextInvoiceNumber: 1,
  legalName: "Aadya Society",
  address: "",
  email: "",
  phone: "",
  gstEnabled: false,
  defaultTaxRate: 0,
  footer: "This is a computer-generated invoice.",
  terms: "Thank you for shopping with Aadya.",
  codInvoiceAt: "CONFIRMED",
  // Global default pricing mode for products that don't define their own,
  // and GST handling for the shipping line item. These are settings-level
  // knobs (SiteSetting JSON blob), not schema fields.
  defaultTaxPricingMode: "TAX_EXCLUSIVE",
  shippingTaxRate: 0,
  shippingHsnCode: null,
  // Bank/payment details are printed on invoices only (not treated as
  // secrets requiring encryption, unlike IntegrationCredential). Optional.
  bankName: "",
  bankAccountHolder: "",
  bankAccountNumber: "",
  bankIfsc: "",
  bankBranch: "",
  upiId: "",
  // Branding used only by the PDF renderer: a logo URL, and the named
  // authorized signatory shown above the signature line (with an optional
  // signature image URL). Additive/optional; the PDF omits sections left
  // blank.
  logoUrl: null,
  signatoryName: "",
  signatureUrl: null,
};
const num = (value) => Number(value || 0);

export async function getInvoiceSettings() {
  const row = await prisma.siteSetting.findUnique({ where: { key: "invoice" } });
  return { ...DEFAULTS, ...(row?.value || {}) };
}
export async function updateInvoiceSettings(settings) {
  const safe = { ...DEFAULTS, ...settings, nextInvoiceNumber: Math.max(1, Number(settings.nextInvoiceNumber || 1)), defaultTaxRate: Math.max(0, Number(settings.defaultTaxRate || 0)) };
  await prisma.$transaction(async (tx) => {
    const sequence = await tx.invoiceSequence.upsert({ where: { id: "default" }, create: { id: "default", nextNumber: safe.nextInvoiceNumber }, update: {} });
    // Never permit rewinding the sequence: it would make a duplicate number
    // possible under a later invoice transaction. Increasing it is safe.
    safe.nextInvoiceNumber = Math.max(safe.nextInvoiceNumber, sequence.nextNumber);
    await tx.invoiceSequence.update({ where: { id: "default" }, data: { nextNumber: safe.nextInvoiceNumber } });
    await tx.siteSetting.upsert({ where: { key: "invoice" }, create: { key: "invoice", value: safe }, update: { value: safe } });
  });
  return safe;
}
export function financialYear(date) {
  const year = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}

// Shared, transactional numbering step. MUST be the only place that
// increments InvoiceSequence, so automatic and manual invoices can never
// collide or go out of order. Caller supplies the tx and settings; this
// creates the sequence row if missing (race-safe) and returns the next
// invoiceNumber/date pair. Does not create/update the Invoice row itself.
export async function allocateInvoiceNumber(tx, settings) {
  await tx.$executeRaw`INSERT INTO "InvoiceSequence" (id, "nextNumber", "updatedAt") VALUES ('default', ${Number(settings.nextInvoiceNumber || 1)}, now()) ON CONFLICT (id) DO NOTHING`;
  const sequence = await tx.invoiceSequence.update({ where: { id: "default" }, data: { nextNumber: { increment: 1 } }, select: { nextNumber: true } });
  const serial = sequence.nextNumber - 1;
  const date = new Date();
  const invoiceNumber = `${settings.prefix}/${financialYear(date)}/${String(serial).padStart(6, "0")}`;
  return { invoiceNumber, date };
}
function addressSnapshot(address, fallback) { return address ? { ...address } : { fullName: fallback.customerName, phone: fallback.customerPhone, addressLine1: "", city: "", state: "", postalCode: "", country: "India" }; }

function isInterState(order, settings) {
  const buyerState = order.address?.state;
  const sellerState = settings.state;
  if (!buyerState || !sellerState) return false;
  return buyerState.trim().toLowerCase() !== sellerState.trim().toLowerCase();
}

// Legacy flat-rate calculation: a single settings.defaultTaxRate is applied
// uniformly to every line item's lineTotal. This is the pre-existing
// behavior, preserved as a fallback whenever gstEnabled is false OR any
// order item is missing per-product HSN/GST data (so a rate can never be
// guessed for it).
function calculateFlat(order, settings, { hasIncompleteTaxData = false } = {}) {
  const enabled = Boolean(settings.gstEnabled);
  const rate = enabled ? num(settings.defaultTaxRate) : 0;
  const interState = isInterState(order, settings);
  const items = order.items.map((item) => {
    const taxableValue = num(item.lineTotal);
    const taxAmount = round2((taxableValue * rate) / 100);
    return {
      productName: item.productNameSnapshot,
      sku: item.variantSkuSnapshot || item.bookFormatSkuSnapshot || item.skuSnapshot || null,
      format: item.bookFormatSnapshot || null,
      quantity: item.quantity,
      unitPrice: num(item.unitPrice),
      discountAmount: 0,
      taxableValue,
      taxAmount,
      lineTotal: round2(taxableValue + taxAmount),
      hsnCode: null,
      gstRate: enabled ? rate : null,
      unit: null,
      taxPricingMode: null,
      cgstAmount: enabled && !interState ? round2(taxAmount / 2) : 0,
      sgstAmount: enabled && !interState ? round2(taxAmount / 2) : 0,
      igstAmount: enabled && interState ? taxAmount : 0,
      orderItemId: item.id,
    };
  });
  const itemTax = round2(items.reduce((sum, item) => sum + item.taxAmount, 0));
  // Existing order totals are authoritative and normally already include tax.
  // Tax is separately shown only when a configured rate is used for a new invoice.
  const taxAmount = enabled ? itemTax : num(order.taxAmount);
  const totalAmount = round2(num(order.subtotal) - num(order.discountAmount) + num(order.shippingAmount) + taxAmount);
  return {
    items,
    tax: {
      enabled,
      rate,
      gstin: settings.gstin || "",
      pan: settings.pan || "",
      state: settings.state || "",
      stateCode: settings.stateCode || "",
      cgstAmount: enabled && !interState ? round2(taxAmount / 2) : 0,
      sgstAmount: enabled && !interState ? round2(taxAmount / 2) : 0,
      igstAmount: enabled && interState ? taxAmount : 0,
      hasIncompleteTaxData,
    },
    totalAmount,
    hasIncompleteTaxData,
  };
}

// Resolves the effective HSN/GST-rate/unit/pricing-mode for an order item:
// variant override wins, else the parent product's value, else null (no
// guessing). `complete` is false when the rate cannot be resolved at all.
function resolveItemTax(item, settings) {
  const product = item.product || null;
  const variant = item.variant || null;
  const hsnCode = (variant?.hsnCode ?? product?.hsnCode) || null;
  const gstRateRaw = variant?.gstRate ?? product?.gstRate ?? null;
  const gstRate = gstRateRaw != null ? Number(gstRateRaw) : null;
  const unit = (variant?.unit ?? product?.unit) || null;
  const taxPricingMode = product?.taxPricingMode || settings.defaultTaxPricingMode || "TAX_EXCLUSIVE";
  return { hsnCode, gstRate, unit, taxPricingMode, complete: gstRate != null };
}

// Single source of truth for per-line GST math (TAX_INCLUSIVE/EXCLUSIVE,
// CGST/SGST vs IGST split). Shared by the automatic per-item calculator
// (calculatePerItem, below) and the manual/offline invoice flow
// (manualInvoice.service.js) so the two paths can never diverge.
export function computeItemTaxLine({ priceAfterDiscount, gstRate, taxPricingMode, interState }) {
  const rate = num(gstRate);
  const taxableValue = taxPricingMode === "TAX_INCLUSIVE" ? round2(priceAfterDiscount / (1 + rate / 100)) : round2(priceAfterDiscount);
  const taxOnItem = round2((taxableValue * rate) / 100);
  const cgstAmount = interState ? 0 : round2(taxOnItem / 2);
  const sgstAmount = interState ? 0 : round2(taxOnItem / 2);
  const igstAmount = interState ? taxOnItem : 0;
  return { taxableValue, taxAmount: taxOnItem, cgstAmount, sgstAmount, igstAmount, lineTotal: round2(taxableValue + taxOnItem) };
}

// Full per-item GST calculation. Only used once every order item resolves a
// concrete gstRate (via resolveItemTax) — otherwise calculateFlat is used so
// behavior stays identical to the pre-existing simplified flow.
function calculatePerItem(order, settings, resolved) {
  const interState = isInterState(order, settings);
  const subtotal = num(order.subtotal);
  const discountTotal = num(order.discountAmount);

  let allocatedDiscount = 0;
  const items = resolved.map((r, idx) => {
    const item = r.item;
    const lineTotal = num(item.lineTotal);
    const isLast = idx === resolved.length - 1;
    const share = subtotal > 0 ? lineTotal / subtotal : 0;
    const discountForItem = isLast ? round2(discountTotal - allocatedDiscount) : round2(discountTotal * share);
    allocatedDiscount = round2(allocatedDiscount + discountForItem);
    const priceAfterDiscount = round2(lineTotal - discountForItem);

    const rate = r.gstRate;
    const { taxableValue, taxAmount: taxOnItem, cgstAmount, sgstAmount, igstAmount, lineTotal: itemLineTotal } = computeItemTaxLine({ priceAfterDiscount, gstRate: rate, taxPricingMode: r.taxPricingMode, interState });

    return {
      productName: item.productNameSnapshot,
      sku: item.variantSkuSnapshot || item.bookFormatSkuSnapshot || item.skuSnapshot || null,
      format: item.bookFormatSnapshot || null,
      quantity: item.quantity,
      unitPrice: num(item.unitPrice),
      discountAmount: discountForItem,
      hsnCode: r.hsnCode,
      gstRate: rate,
      unit: r.unit,
      taxPricingMode: r.taxPricingMode,
      taxableValue,
      taxAmount: taxOnItem,
      cgstAmount,
      sgstAmount,
      igstAmount,
      lineTotal: round2(taxableValue + taxOnItem),
      orderItemId: item.id,
    };
  });

  const cgstItemsTotal = round2(items.reduce((sum, i) => sum + i.cgstAmount, 0));
  const sgstItemsTotal = round2(items.reduce((sum, i) => sum + i.sgstAmount, 0));
  const igstItemsTotal = round2(items.reduce((sum, i) => sum + i.igstAmount, 0));

  const shippingAmount = num(order.shippingAmount);
  const shippingTaxRate = Boolean(settings.gstEnabled) ? num(settings.shippingTaxRate) : 0;
  let shippingTaxAmount = 0;
  let shippingCgst = 0;
  let shippingSgst = 0;
  let shippingIgst = 0;
  if (shippingTaxRate > 0 && shippingAmount > 0) {
    shippingTaxAmount = round2((shippingAmount * shippingTaxRate) / 100);
    if (interState) {
      shippingIgst = shippingTaxAmount;
    } else {
      shippingCgst = round2(shippingTaxAmount / 2);
      shippingSgst = round2(shippingTaxAmount / 2);
    }
  }

  const cgstAmount = round2(cgstItemsTotal + shippingCgst);
  const sgstAmount = round2(sgstItemsTotal + shippingSgst);
  const igstAmount = round2(igstItemsTotal + shippingIgst);
  const taxAmount = round2(cgstAmount + sgstAmount + igstAmount);

  const computedTotal = round2(subtotal - discountTotal + taxAmount + shippingAmount);
  // Reconcile exactly against the order's authoritative total (rounding is
  // typically 0 or +/-0.01 from per-item round2 accumulation).
  const rounding = round2(num(order.totalAmount) - computedTotal);
  const totalAmount = round2(computedTotal + rounding);

  return {
    items,
    tax: {
      enabled: true,
      rate: null, // per-item rates vary; no single flat rate applies
      gstin: settings.gstin || "",
      pan: settings.pan || "",
      state: settings.state || "",
      stateCode: settings.stateCode || "",
      cgstAmount,
      sgstAmount,
      igstAmount,
      shippingTaxRate,
      shippingHsnCode: settings.shippingHsnCode || null,
      shippingTaxAmount,
      rounding,
      hasIncompleteTaxData: false,
    },
    totalAmount,
    hasIncompleteTaxData: false,
  };
}

function calculate(order, settings) {
  const enabled = Boolean(settings.gstEnabled);
  if (!enabled) return calculateFlat(order, settings, { hasIncompleteTaxData: false });

  const resolved = order.items.map((item) => ({ item, ...resolveItemTax(item, settings) }));
  const anyIncomplete = resolved.some((r) => !r.complete);
  if (anyIncomplete) return calculateFlat(order, settings, { hasIncompleteTaxData: true });

  return calculatePerItem(order, settings, resolved);
}

export async function ensureInvoiceForOrder(orderId, { forceCod = false } = {}) {
  const existing = await prisma.invoice.findUnique({ where: { orderId } });
  if (existing) return existing;
  const settings = await getInvoiceSettings();
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: { include: { product: true, variant: true } }, address: true, billingAddress: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!order) throw ApiError.notFound("Order not found");
  const ready = order.paymentStatus === "PAID" || (order.paymentMethod === "cod" && (forceCod || order.status === settings.codInvoiceAt));
  if (!ready) return null;
  const calculated = calculate(order, settings);
  let invoice;
  try {
    invoice = await prisma.$transaction(
      async (tx) => {
        const duplicate = await tx.invoice.findUnique({ where: { orderId } });
        if (duplicate) return duplicate;
        // Two concurrent first-ever invoice creations can both find no
        // InvoiceSequence row and race to create it. A plain Prisma
        // upsert/create there can throw P2002 on the sequence's own `id` —
        // and in Postgres a failed statement aborts the rest of this
        // transaction, so even catching the JS error still leaves every
        // later statement erroring with "current transaction is aborted".
        // Worse, the outer catch below treats any P2002 as "duplicate
        // invoice for this order" and returns null, silently dropping
        // invoice creation for the order that lost the race. A raw
        // INSERT ... ON CONFLICT DO NOTHING sidesteps all of that: it never
        // errors, so the transaction stays healthy either way.
        const { invoiceNumber, date } = await allocateInvoiceNumber(tx, settings);
        const createdInvoice = await tx.invoice.create({ data: { orderId, invoiceNumber, invoiceDate: date, customerName: order.customerName, customerEmail: order.customerEmail, customerPhone: order.customerPhone || null, billingAddress: addressSnapshot(order.billingAddress || order.address, order), shippingAddress: order.address ? addressSnapshot(order.address, order) : undefined, subtotal: order.subtotal, discountAmount: order.discountAmount, shippingAmount: order.shippingAmount, taxAmount: calculated.tax.enabled ? round2(calculated.tax.cgstAmount + calculated.tax.sgstAmount + calculated.tax.igstAmount) : order.taxAmount, totalAmount: calculated.totalAmount, currency: order.currency, companySnapshot: { legalName: settings.legalName, address: settings.address, email: settings.email, phone: settings.phone, gstin: settings.gstin || null, pan: settings.pan || null, footer: settings.footer, terms: settings.terms, logoUrl: settings.logoUrl || null, signatoryName: settings.signatoryName || "", signatureUrl: settings.signatureUrl || null, bank: { bankName: settings.bankName || "", accountHolder: settings.bankAccountHolder || "", accountNumber: settings.bankAccountNumber || "", ifsc: settings.bankIfsc || "", branch: settings.bankBranch || "", upiId: settings.upiId || "" } }, taxSnapshot: calculated.tax, itemsSnapshot: calculated.items } });

        // Mirror the per-item tax breakdown onto OrderItem itself, so the
        // order retains it even though Invoice is the immutable snapshot of
        // record. Only meaningful when calculate() actually resolved a rate.
        for (const item of calculated.items) {
          if (!item.orderItemId) continue;
          await tx.orderItem.update({
            where: { id: item.orderItemId },
            data: {
              hsnCodeSnapshot: item.hsnCode ?? null,
              gstRateSnapshot: item.gstRate ?? null,
              unitSnapshot: item.unit ?? null,
              cgstAmount: item.cgstAmount ?? null,
              sgstAmount: item.sgstAmount ?? null,
              igstAmount: item.igstAmount ?? null,
              taxableValueSnapshot: item.taxableValue ?? null,
            },
          });
        }

        return createdInvoice;
      },
      // The InvoiceSequence row is a single global row, so concurrent
      // ensureInvoiceForOrder calls (different orders paid at the same time,
      // or duplicate webhook/verify races for the same order) serialize on
      // it. The default 2s maxWait is too tight once more than a couple of
      // callers queue up behind that row lock — widen it so a burst of
      // concurrent invoice creation doesn't spuriously fail to even start.
      { maxWait: 15000, timeout: 15000 }
    );
  } catch (error) {
    if (error.code === "P2002") return prisma.invoice.findUnique({ where: { orderId } });
    throw error;
  }
  await regenerateInvoicePdf(invoice.id);
  return prisma.invoice.findUnique({ where: { id: invoice.id } });
}

export async function regenerateInvoicePdf(invoiceId) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { order: { select: { orderNumber: true, paymentMethod: true, paymentStatus: true } } } });
  if (!invoice) throw ApiError.notFound("Invoice not found");
  const key = `invoice-${invoice.id}.pdf`;
  await writeInvoicePdf(key, renderInvoicePdf(invoice));
  return prisma.invoice.update({ where: { id: invoice.id }, data: { pdfStorageKey: key } });
}
export async function getInvoiceFile(invoiceId) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice?.pdfStorageKey) throw ApiError.notFound("Invoice PDF not found");
  const file = await readInvoicePdf(invoice.pdfStorageKey);
  if (!file) throw ApiError.notFound("Invoice PDF not found");
  return { ...file, filename: `${invoice.invoiceNumber.replace(/[^A-Za-z0-9._-]/g, "-")}.pdf` };
}
export async function listCustomerInvoices(customerId) { return prisma.invoice.findMany({ where: { order: { customerId } }, select: { id: true, invoiceNumber: true, invoiceDate: true, totalAmount: true, currency: true, order: { select: { orderNumber: true, paymentStatus: true } } }, orderBy: { createdAt: "desc" } }); }

export async function listAdminInvoices({ page = 1, limit = 20, search, invoiceNumber, orderNumber, customer, dateFrom, dateTo, paymentMethod, status } = {}) {
  const and = [];
  if (search) {
    and.push({
      OR: [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { order: { orderNumber: { contains: search, mode: "insensitive" } } },
      ],
    });
  }
  if (invoiceNumber) and.push({ invoiceNumber: { contains: invoiceNumber, mode: "insensitive" } });
  if (orderNumber) and.push({ order: { orderNumber: { contains: orderNumber, mode: "insensitive" } } });
  if (customer) and.push({ OR: [{ customerName: { contains: customer, mode: "insensitive" } }, { customerEmail: { contains: customer, mode: "insensitive" } }] });
  if (paymentMethod) and.push({ order: { paymentMethod } });
  if (status) and.push({ order: { paymentStatus: status } });
  if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) range.gte = new Date(dateFrom);
    if (dateTo) range.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
    and.push({ invoiceDate: range });
  }
  const where = and.length ? { AND: and } : {};
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        subtotal: true,
        taxAmount: true,
        totalAmount: true,
        currency: true,
        customerName: true,
        customerEmail: true,
        emailedAt: true,
        createdAt: true,
        taxSnapshot: true,
        order: { select: { id: true, orderNumber: true, paymentMethod: true, paymentStatus: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ]);
  return {
    items: items.map((inv) => ({
      ...inv,
      subtotal: Number(inv.subtotal),
      taxAmount: Number(inv.taxAmount),
      totalAmount: Number(inv.totalAmount),
      gstin: inv.taxSnapshot?.gstin || null,
      // Model fields for MANUAL/ONLINE source and invoice-level status don't
      // exist yet at the time this endpoint was extended (a sibling agent
      // is adding them to the Invoice model in parallel) — default so the
      // admin UI has something sensible either way, and the real values
      // take over automatically once those columns land.
      source: inv.source ?? "ONLINE",
      status: inv.status ?? "ISSUED",
    })),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function getInvoiceDetail(invoiceId) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { order: { select: { id: true, orderNumber: true, paymentMethod: true, paymentStatus: true, status: true, payments: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, provider: true, providerPaymentId: true, status: true } } } } },
  });
  if (!invoice) throw ApiError.notFound("Invoice not found");
  const auditLogs = await prisma.adminAuditLog.findMany({
    where: {
      OR: [
        { metadata: { path: ["invoiceId"], equals: invoice.id } },
        { metadata: { path: ["orderId"], equals: invoice.orderId } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return { ...invoice, auditLogs };
}
export async function assertCustomerInvoice(customerId, invoiceId) { const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, order: { customerId } } }); if (!invoice) throw ApiError.notFound("Invoice not found"); return invoice; }
export async function assertGuestInvoice(orderNumber, token, invoiceId) { const { hashToken, safeCompareHex } = await import("../../utils/secureToken.js"); const order = await prisma.order.findUnique({ where: { orderNumber } }); if (!order || !safeCompareHex(hashToken(token), order.accessTokenHash)) throw ApiError.notFound("Invoice not found"); const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, orderId: order.id } }); if (!invoice) throw ApiError.notFound("Invoice not found"); return invoice; }
