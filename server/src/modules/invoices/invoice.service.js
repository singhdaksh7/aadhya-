import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { renderInvoicePdf } from "./invoice.pdf.js";
import { writeInvoicePdf, readInvoicePdf } from "./invoice.storage.js";

const DEFAULTS = { prefix: "AADYA", financialYearFormat: "YYYY-YY", nextInvoiceNumber: 1, legalName: "Aadya Society", address: "", email: "", phone: "", gstEnabled: false, defaultTaxRate: 0, footer: "This is a computer-generated invoice.", terms: "Thank you for shopping with Aadya.", codInvoiceAt: "CONFIRMED" };
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
function financialYear(date) {
  const year = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}
function addressSnapshot(address, fallback) { return address ? { ...address } : { fullName: fallback.customerName, phone: fallback.customerPhone, addressLine1: "", city: "", state: "", postalCode: "", country: "India" }; }
function calculate(order, settings) {
  const enabled = Boolean(settings.gstEnabled);
  const rate = enabled ? num(settings.defaultTaxRate) : 0;
  const items = order.items.map((item) => {
    const taxableValue = num(item.lineTotal);
    const taxAmount = Math.round(taxableValue * rate) / 100;
    return { productName: item.productNameSnapshot, sku: item.variantSkuSnapshot || item.bookFormatSkuSnapshot || item.skuSnapshot || null, format: item.bookFormatSnapshot || null, quantity: item.quantity, unitPrice: num(item.unitPrice), discountAmount: 0, taxableValue, taxAmount, lineTotal: taxableValue + taxAmount };
  });
  const itemTax = items.reduce((sum, item) => sum + item.taxAmount, 0);
  // Existing order totals are authoritative and normally already include tax.
  // Tax is separately shown only when a configured rate is used for a new invoice.
  const taxAmount = enabled ? itemTax : num(order.taxAmount);
  const totalAmount = num(order.subtotal) - num(order.discountAmount) + num(order.shippingAmount) + taxAmount;
  const interState = order.address?.state && settings.state && order.address.state.trim().toLowerCase() !== settings.state.trim().toLowerCase();
  return { items, tax: { enabled, rate, gstin: settings.gstin || "", pan: settings.pan || "", state: settings.state || "", stateCode: settings.stateCode || "", cgstAmount: enabled && !interState ? taxAmount / 2 : 0, sgstAmount: enabled && !interState ? taxAmount / 2 : 0, igstAmount: enabled && interState ? taxAmount : 0 }, totalAmount };
}

export async function ensureInvoiceForOrder(orderId, { forceCod = false } = {}) {
  const existing = await prisma.invoice.findUnique({ where: { orderId } });
  if (existing) return existing;
  const settings = await getInvoiceSettings();
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, address: true, billingAddress: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!order) throw ApiError.notFound("Order not found");
  const ready = order.paymentStatus === "PAID" || (order.paymentMethod === "cod" && (forceCod || order.status === settings.codInvoiceAt));
  if (!ready) return null;
  const calculated = calculate(order, settings);
  let invoice;
  try {
    invoice = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.invoice.findUnique({ where: { orderId } });
      if (duplicate) return duplicate;
      await tx.invoiceSequence.upsert({ where: { id: "default" }, create: { id: "default", nextNumber: Number(settings.nextInvoiceNumber || 1) }, update: {} });
      const sequence = await tx.invoiceSequence.update({ where: { id: "default" }, data: { nextNumber: { increment: 1 } }, select: { nextNumber: true } });
      const serial = sequence.nextNumber - 1;
      const date = new Date();
      const invoiceNumber = `${settings.prefix}/${financialYear(date)}/${String(serial).padStart(6, "0")}`;
      return tx.invoice.create({ data: { orderId, invoiceNumber, invoiceDate: date, customerName: order.customerName, customerEmail: order.customerEmail, customerPhone: order.customerPhone || null, billingAddress: addressSnapshot(order.billingAddress || order.address, order), shippingAddress: order.address ? addressSnapshot(order.address, order) : undefined, subtotal: order.subtotal, discountAmount: order.discountAmount, shippingAmount: order.shippingAmount, taxAmount: calculated.tax.enabled ? calculated.tax.cgstAmount + calculated.tax.sgstAmount + calculated.tax.igstAmount : order.taxAmount, totalAmount: calculated.totalAmount, currency: order.currency, companySnapshot: { legalName: settings.legalName, address: settings.address, email: settings.email, phone: settings.phone, gstin: settings.gstin || null, pan: settings.pan || null, footer: settings.footer, terms: settings.terms }, taxSnapshot: calculated.tax, itemsSnapshot: calculated.items } });
    });
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
export async function assertCustomerInvoice(customerId, invoiceId) { const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, order: { customerId } } }); if (!invoice) throw ApiError.notFound("Invoice not found"); return invoice; }
export async function assertGuestInvoice(orderNumber, token, invoiceId) { const { hashToken, safeCompareHex } = await import("../../utils/secureToken.js"); const order = await prisma.order.findUnique({ where: { orderNumber } }); if (!order || !safeCompareHex(hashToken(token), order.accessTokenHash)) throw ApiError.notFound("Invoice not found"); const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, orderId: order.id } }); if (!invoice) throw ApiError.notFound("Invoice not found"); return invoice; }
