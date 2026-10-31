// Invoice PDF renderer (A4). Built on pdfkit so the layout gets real text measuring and wrapping, repeating
// table headers across pages, and an embedded Inter font: the standard PDF fonts have no rupee sign, Inter
// does, so amounts print as ₹1,234.00 and stay selectable/searchable text.
//
// This file only lays out numbers that were already frozen into the invoice snapshots at issue time
// (itemsSnapshot / taxSnapshot / companySnapshot / totals). It never recalculates tax, totals or rounding.
//
// Logo/signature: only this app's own local media files are ever read (see invoice.image.js
// readLocalMediaFile). A missing or undecodable image is skipped silently, so it can never break invoicing.
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { amountInWords } from "../../utils/amountInWords.js";
import { readLocalMediaFile } from "./invoice.image.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(here, "fonts");
const FONTS = {
  regular: path.join(FONT_DIR, "Inter_400Regular.ttf"),
  semibold: path.join(FONT_DIR, "Inter_600SemiBold.ttf"),
  bold: path.join(FONT_DIR, "Inter_700Bold.ttf"),
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 44; // page margin (left/right)
const CONTENT_W = PAGE_W - M * 2;
const FOOTER_TOP = PAGE_H - 74; // content never runs below this; the footer lives under it
const CONTENT_BOTTOM = FOOTER_TOP - 14;

const C = { ink: "#1c1917", muted: "#78716c", line: "#e7e5e4", tint: "#f5f5f4", accent: "#b8674a", white: "#ffffff" };

const DEFAULT_BRAND = "Tushaqsa";
const DESCRIPTOR = "Home Decor and Lifestyle Products";
const DEFAULT_WEBSITE = "aadyavocational.com";
const THANK_YOU = (brand) => `Thank you for shopping with ${brand}.`;

// ---- formatting -------------------------------------------------------------------------------------
function groupIndian(intDigits) {
  if (intDigits.length <= 3) return intDigits;
  const last3 = intDigits.slice(-3);
  return `${intDigits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
}
export function formatMoney(amount, currency = "INR") {
  const n = Number(amount || 0);
  const [whole, frac] = Math.abs(n).toFixed(2).split(".");
  const body = currency === "INR" ? groupIndian(whole) : whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : ""}${currency === "INR" ? "₹" : `${currency} `}${body}.${frac}`;
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const ist = new Date(d.getTime() + 330 * 60_000); // invoices are dated in Indian time
  return `${String(ist.getUTCDate()).padStart(2, "0")} ${MONTHS[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
}
const titleCase = (s) => String(s || "").toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const paymentMethodLabel = (m) => (!m ? "" : String(m).toLowerCase() === "cod" ? "Cash on Delivery" : "Online payment");
const clean = (v) => String(v ?? "").replace(/[\r\t]+/g, " ").trim();
const round2sum = (nums) => Math.round(nums.reduce((s, n) => s + n, 0) * 100) / 100;

function addressLines(a, fallbackName) {
  if (!a) return fallbackName ? [fallbackName] : [];
  const cityLine = [a.city, [a.state, a.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [a.fullName || fallbackName, a.addressLine1, a.addressLine2, a.landmark, cityLine, a.country && a.country !== "India" ? a.country : "India"].map(clean).filter(Boolean);
}

async function loadImage(doc, url) {
  try {
    const buffer = await readLocalMediaFile(url || null);
    if (!buffer?.length) return null;
    const img = doc.openImage(buffer);
    return img?.width && img?.height ? { buffer, width: img.width, height: img.height } : null;
  } catch {
    return null;
  }
}

// ---- renderer ---------------------------------------------------------------------------------------
export async function renderInvoicePdf(invoice, options = {}) {
  const company = invoice.companySnapshot || {};
  const tax = invoice.taxSnapshot || {};
  const items = invoice.itemsSnapshot || [];
  const currency = invoice.currency || "INR";
  const brand = clean(options.brandName) || DEFAULT_BRAND;
  const website = clean(options.website) || DEFAULT_WEBSITE;
  const money = (n) => formatMoney(n, currency);

  const doc = new PDFDocument({
    size: "A4",
    margin: 0, // every position is explicit, so pdfkit never inserts its own page breaks
    autoFirstPage: false,
    bufferPages: true,
    info: { Title: `Invoice ${invoice.invoiceNumber}`, Author: brand, Subject: `Invoice ${invoice.invoiceNumber}`, Producer: brand, Creator: brand },
  });
  doc.registerFont("R", FONTS.regular);
  doc.registerFont("S", FONTS.semibold);
  doc.registerFont("B", FONTS.bold);
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const finished = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // The invoice-settings logo wins; when it is blank (or unusable) fall back to the storefront brand logo so every invoice carries one.
  const [ownLogo, signature] = await Promise.all([loadImage(doc, company.logoUrl), loadImage(doc, company.signatureUrl)]);
  const logo = ownLogo || (options.fallbackLogoUrl ? await loadImage(doc, options.fallbackLogoUrl) : null);

  // Tax columns/summary appear whenever the frozen snapshot carries GST (the flag, or any tax amount).
  const taxOn = Boolean(tax.enabled) || Number(tax.cgstAmount || 0) + Number(tax.sgstAmount || 0) + Number(tax.igstAmount || 0) > 0;
  const taxInvoice = Boolean(tax.enabled) && Boolean(company.gstin); // "TAX INVOICE" only when GST is on and a GSTIN is set (unchanged rule)
  const interState = Number(tax.igstAmount || 0) > 0;

  // measure / draw helpers ----------------------------------------------------------------------------
  const setFont = (font, size) => doc.font(font).fontSize(size);
  const heightOf = (text, width, font = "R", size = 9, extra = {}) => {
    setFont(font, size);
    return doc.heightOfString(String(text), { width, lineGap: 1.5, ...extra });
  };
  const put = (text, x, y, { width, font = "R", size = 9, color = C.ink, align = "left", spacing, lineGap = 1.5 } = {}) => {
    setFont(font, size).fillColor(color);
    doc.text(String(text), x, y, { width, align, lineGap, ...(spacing ? { characterSpacing: spacing } : {}), lineBreak: width != null });
  };
  const hr = (y, x1 = M, x2 = PAGE_W - M, color = C.line, w = 0.6) => doc.save().lineWidth(w).strokeColor(color).moveTo(x1, y).lineTo(x2, y).stroke().restore();
  const label = (text, x, y, width) => put(String(text).toUpperCase(), x, y, { width, font: "S", size: 6.8, color: C.muted, spacing: 0.9 });

  let y = 0;
  const newPage = () => {
    doc.addPage({ size: "A4", margin: 0 });
    doc.save().rect(0, 0, PAGE_W, 5).fill(C.accent).restore();
    y = 40;
  };

  // ---- first page header -------------------------------------------------------------------------------
  newPage();
  y = 34;
  let leftBottom = y;
  if (logo) {
    const scale = Math.min(150 / logo.width, 46 / logo.height, 1);
    const w = logo.width * scale;
    const h = logo.height * scale;
    doc.image(logo.buffer, M, y, { width: w, height: h });
    const tx = M + w + 12;
    put(brand, tx, y + 3, { width: 200, font: "B", size: 15 });
    put(DESCRIPTOR, tx, y + 23, { width: 200, size: 7.5, color: C.muted });
    leftBottom = y + Math.max(h, 38);
  } else {
    put(brand, M, y, { width: 290, font: "B", size: 22 });
    put(DESCRIPTOR, M, y + 29, { width: 290, size: 8, color: C.muted });
    leftBottom = y + 44;
  }

  const RIGHT_X = PAGE_W - M - 210;
  put(taxInvoice ? "TAX INVOICE" : "INVOICE", RIGHT_X, y - 2, { width: 210, font: "B", size: 20, color: C.accent, align: "right", spacing: 1 });
  let my = y + 28;
  const meta = [
    ["Invoice no.", invoice.invoiceNumber],
    ["Invoice date", formatDate(invoice.invoiceDate)],
    invoice.order?.orderNumber ? ["Order no.", invoice.order.orderNumber] : null,
    taxOn ? ["Supply", tax.placeOfSupplyKnown === false ? "Not determined" : interState ? "Inter-state supply" : "Intra-state supply"] : null,
  ].filter((r) => r && clean(r[1]));
  for (const [k, v] of meta) {
    put(k, RIGHT_X, my, { width: 80, size: 8, color: C.muted });
    const h = heightOf(v, 126, "S", 8.5);
    put(v, RIGHT_X + 84, my, { width: 126, font: "S", size: 8.5, align: "right" });
    my += Math.max(13, h + 3);
  }
  y = Math.max(leftBottom, my) + 14;
  hr(y, M, PAGE_W - M, C.ink, 0.9);
  y += 16;

  // ---- parties: Seller | Billed to | Ship to ------------------------------------------------------------
  const sellerLines = [
    company.legalName && { t: clean(company.legalName), f: "S", s: 9 },
    ...(company.address ? [{ t: clean(company.address), f: "R", s: 8.2 }] : []),
    company.gstin && { t: `GSTIN: ${clean(company.gstin)}`, f: "R", s: 8.2 },
    company.pan && { t: `PAN: ${clean(company.pan)}`, f: "R", s: 8.2 },
    company.email && { t: clean(company.email), f: "R", s: 8.2 },
    company.phone && { t: clean(company.phone), f: "R", s: 8.2 },
  ].filter(Boolean);
  const bill = invoice.billingAddress && Object.keys(invoice.billingAddress).length ? invoice.billingAddress : null;
  const ship = invoice.shippingAddress && Object.keys(invoice.shippingAddress).length ? invoice.shippingAddress : bill;
  const billLines = [
    ...addressLines(bill, invoice.customerName).map((t, i) => ({ t, f: i === 0 ? "S" : "R", s: i === 0 ? 9 : 8.2 })),
    invoice.customerPhone && { t: `Phone: ${clean(invoice.customerPhone)}`, f: "R", s: 8.2 },
    invoice.customerEmail && { t: clean(invoice.customerEmail), f: "R", s: 8.2 },
  ].filter(Boolean);
  const shipLines = [
    ...addressLines(ship, invoice.customerName).map((t, i) => ({ t, f: i === 0 ? "S" : "R", s: i === 0 ? 9 : 8.2 })),
    (ship?.phone || invoice.customerPhone) && { t: `Phone: ${clean(ship?.phone || invoice.customerPhone)}`, f: "R", s: 8.2 },
  ].filter(Boolean);

  const blocks = [
    sellerLines.length ? { title: "Seller", lines: sellerLines } : null,
    billLines.length ? { title: "Billed to", lines: billLines } : null,
    shipLines.length ? { title: "Ship to", lines: shipLines } : null,
  ].filter(Boolean);
  const gap = 18;
  const colW = (CONTENT_W - gap * (blocks.length - 1)) / Math.max(blocks.length, 1);
  const heightOfBlock = (b) => b.lines.reduce((h, l) => h + heightOf(l.t, colW, l.f, l.s) + 2.5, 0);
  const blocksH = blocks.length ? 16 + Math.max(...blocks.map(heightOfBlock)) : 0;
  blocks.forEach((b, i) => {
    const x = M + i * (colW + gap);
    label(b.title, x, y, colW);
    let by = y + 14;
    for (const l of b.lines) {
      put(l.t, x, by, { width: colW, font: l.f, size: l.s, color: l.f === "S" ? C.ink : "#44403c" });
      by += heightOf(l.t, colW, l.f, l.s) + 2.5;
    }
  });
  y += blocksH + 10;

  // ---- items table ---------------------------------------------------------------------------------------
  const showDisc = items.some((i) => Number(i.discountAmount || 0) > 0);
  const cols = [{ key: "item", title: "Item", align: "left" }];
  cols.push({ key: "qty", title: "Qty", w: 34, align: "right" });
  cols.push({ key: "unit", title: "Unit price", w: 66, align: "right" });
  if (showDisc) cols.push({ key: "disc", title: "Discount", w: 56, align: "right" });
  if (taxOn) {
    cols.push({ key: "taxable", title: "Taxable", w: 64, align: "right" });
    cols.push({ key: "gst", title: "GST", w: 40, align: "right" });
  }
  cols.push({ key: "amount", title: "Amount", w: 72, align: "right" });
  const fixed = cols.reduce((s, c) => s + (c.w || 0), 0);
  cols[0].w = CONTENT_W - fixed;
  const PAD = 6;
  let cx = M;
  cols.forEach((c) => {
    c.x = cx;
    cx += c.w;
  });

  const drawTableHeader = () => {
    doc.save().rect(M, y, CONTENT_W, 22).fill(C.tint).restore();
    cols.forEach((c) => put(c.title.toUpperCase(), c.x + PAD, y + 7.5, { width: c.w - PAD * 2, font: "S", size: 6.8, color: C.muted, align: c.align, spacing: 0.7 }));
    y += 22;
  };
  const continuationPage = () => {
    newPage();
    y = 30;
    put(brand, M, y, { width: 240, font: "B", size: 12 });
    put(`${taxInvoice ? "Tax invoice" : "Invoice"} ${invoice.invoiceNumber} (continued)`, PAGE_W - M - 280, y + 2, { width: 280, size: 8.5, color: C.muted, align: "right" });
    y += 24;
    hr(y, M, PAGE_W - M, C.ink, 0.9);
    y += 12;
    drawTableHeader();
  };

  drawTableHeader();
  for (const item of items) {
    const nameW = cols[0].w - PAD * 2;
    const name = clean(item.productName) || "Item";
    const sub = [item.format, item.sku && `SKU ${clean(item.sku)}`, taxOn && item.hsnCode && `HSN ${clean(item.hsnCode)}`].filter(Boolean).join("  ·  ");
    const nameH = heightOf(name, nameW, "S", 8.8);
    const subH = sub ? heightOf(sub, nameW, "R", 7.2) + 1 : 0;
    const rowH = Math.max(nameH + subH + 14, 28);
    if (y + rowH > CONTENT_BOTTOM) continuationPage();
    put(name, cols[0].x + PAD, y + 7, { width: nameW, font: "S", size: 8.8 });
    if (sub) put(sub, cols[0].x + PAD, y + 7 + nameH + 1.5, { width: nameW, size: 7.2, color: C.muted });
    const cell = (key, text, font = "R") => {
      const c = cols.find((x) => x.key === key);
      if (c) put(text, c.x + PAD, y + 7.5, { width: c.w - PAD * 2, font, size: 8.6, align: "right" });
    };
    cell("qty", String(item.quantity ?? ""));
    cell("unit", money(item.unitPrice));
    cell("disc", Number(item.discountAmount || 0) > 0 ? `-${money(item.discountAmount)}` : "-");
    cell("taxable", money(item.taxableValue ?? item.lineTotal ?? 0));
    cell("gst", item.gstRate != null ? `${item.gstRate}%` : "N/A");
    cell("amount", money(item.lineTotal), "S");
    y += rowH;
    hr(y, M, PAGE_W - M);
  }
  y += 18;

  // ---- lower section: payment / tax summary / bank (left) and totals (right) --------------------------------
  const LEFT_W = CONTENT_W - 230;
  const TOT_X = PAGE_W - M - 210;
  const TOT_W = 210;

  const totalRows = [["Subtotal", money(invoice.subtotal)]];
  if (Number(invoice.discountAmount || 0) > 0) totalRows.push(["Discount", `-${money(invoice.discountAmount)}`]);
  totalRows.push(["Shipping", Number(invoice.shippingAmount || 0) === 0 ? "Free" : money(invoice.shippingAmount)]);
  if (Number(tax.cgstAmount || 0) > 0) totalRows.push(["CGST", money(tax.cgstAmount)]);
  if (Number(tax.sgstAmount || 0) > 0) totalRows.push(["SGST", money(tax.sgstAmount)]);
  if (Number(tax.igstAmount || 0) > 0) totalRows.push(["IGST", money(tax.igstAmount)]);
  if (Number(tax.codFeeAmount || 0) > 0) totalRows.push(["COD fee", money(tax.codFeeAmount)]);
  if (Number(tax.rounding || 0) !== 0) totalRows.push(["Rounding", money(tax.rounding)]);
  const totalsH = totalRows.length * 17 + 8 + 34;

  // GST summary per rate (frozen item snapshots; whether the supply is inter/intra-state comes from taxSnapshot).
  const rateGroups = new Map();
  for (const item of items) {
    const key = item.gstRate != null ? Number(item.gstRate) : "unrated";
    if (!rateGroups.has(key)) rateGroups.set(key, { taxable: 0, cgst: 0, sgst: 0, igst: 0 });
    const g = rateGroups.get(key);
    g.taxable += Number(item.taxableValue ?? 0);
    g.cgst += Number(item.cgstAmount ?? 0);
    g.sgst += Number(item.sgstAmount ?? 0);
    g.igst += Number(item.igstAmount ?? 0);
  }
  const rates = [...rateGroups.keys()].sort((a, b) => (a === "unrated" ? 1 : b === "unrated" ? -1 : a - b));
  let taxSummary = [];
  if (taxOn) {
    if (rates.length) {
      taxSummary = rates.map((k) => {
        const g = rateGroups.get(k);
        return { rate: k === "unrated" ? "N/A" : `${k}%`, taxable: round2sum([g.taxable]), a: interState ? g.igst : g.cgst, b: interState ? null : g.sgst };
      });
    } else if (interState || Number(tax.cgstAmount || 0) > 0 || Number(tax.sgstAmount || 0) > 0) {
      const taxable = round2sum(items.map((i) => Number(i.taxableValue ?? 0)));
      taxSummary = [{ rate: tax.rate != null ? `${tax.rate}%` : "varies", taxable, a: interState ? tax.igstAmount : tax.cgstAmount, b: interState ? null : tax.sgstAmount }];
    }
  }

  const bank = company.bank || {};
  const bankLines = [
    bank.bankName && clean(bank.bankName),
    bank.accountHolder && `A/c name: ${clean(bank.accountHolder)}`,
    bank.accountNumber && `A/c no: ${clean(bank.accountNumber)}`,
    bank.ifsc && `IFSC: ${clean(bank.ifsc)}`,
    bank.branch && `Branch: ${clean(bank.branch)}`,
    bank.upiId && `UPI: ${clean(bank.upiId)}`,
  ].filter(Boolean);

  const payRows = [
    ["Payment method", paymentMethodLabel(invoice.order?.paymentMethod)],
    ["Payment status", invoice.order?.paymentStatus ? titleCase(invoice.order.paymentStatus) : ""],
    ["Order status", invoice.order?.status ? titleCase(invoice.order.status) : ""],
  ].filter((r) => r[1]);
  const wordsText = `Amount in words: ${amountInWords(invoice.totalAmount)}`;

  // Explicit tax caveats: never leave the reader guessing why tax is missing or how the supply type was chosen.
  const taxNotes = [];
  if (taxOn && tax.hasIncompleteTaxData) taxNotes.push(`GST not configured for ${tax.unratedItemCount ? `${tax.unratedItemCount} item(s)` : "this invoice"}: no tax rate is set, so tax is not calculated for them.`);
  if (taxOn && !taxNotes.length && !Number(tax.cgstAmount || 0) && !Number(tax.sgstAmount || 0) && !Number(tax.igstAmount || 0) && tax.enabled) taxNotes.push("GST not configured: no tax amount was calculated.");
  if (taxOn && tax.placeOfSupplyKnown === false) taxNotes.push("Place of supply could not be determined (company or delivery state missing); intra-state split shown.");
  if (taxOn && tax.pricingNote) taxNotes.push(tax.pricingNote);
  const notesText = taxNotes.join(" ");
  const notesH = notesText ? 16 + heightOf(notesText, LEFT_W, "R", 7.6) + 8 : 0;

  const leftH =
    (payRows.length ? 16 + payRows.length * 14 + 8 : 0) +
    (taxSummary.length ? 16 + 14 + taxSummary.length * 13 + 8 : 0) +
    notesH +
    (bankLines.length ? 16 + bankLines.reduce((h, l) => h + heightOf(l, LEFT_W, "R", 8) + 2, 0) + 8 : 0);
  const wordsH = heightOf(wordsText, CONTENT_W, "R", 8) + 10;
  if (y + Math.max(leftH, totalsH) + wordsH > CONTENT_BOTTOM) {
    continuationPage();
    y += 14;
  }

  // totals
  let ty = y;
  for (const [k, v] of totalRows) {
    put(k, TOT_X, ty, { width: 110, size: 9, color: C.muted });
    put(v, TOT_X + 110, ty, { width: TOT_W - 110, size: 9, align: "right" });
    ty += 17;
  }
  ty += 4;
  doc.save().roundedRect(TOT_X - 10, ty, TOT_W + 10, 32, 3).fill(C.ink).restore();
  put("Grand total", TOT_X, ty + 11, { width: 90, font: "S", size: 9, color: C.white });
  put(money(invoice.totalAmount), TOT_X + 70, ty + 8, { width: TOT_W - 70 - 8, font: "B", size: 14, color: C.white, align: "right" });
  ty += 32;

  // left column
  let ly = y;
  if (payRows.length) {
    label("Payment", M, ly, LEFT_W);
    ly += 14;
    for (const [k, v] of payRows) {
      put(k, M, ly, { width: 90, size: 8.2, color: C.muted });
      put(v, M + 92, ly, { width: LEFT_W - 92, font: "S", size: 8.4 });
      ly += 14;
    }
    ly += 8;
  }
  if (taxSummary.length) {
    label("GST summary", M, ly, LEFT_W);
    ly += 14;
    const tc = [M, M + 52, M + 130, M + 200];
    const heads = interState ? ["Rate", "Taxable", "IGST", ""] : ["Rate", "Taxable", "CGST", "SGST"];
    heads.forEach((h, i) => h && put(h, tc[i], ly, { width: 70, font: "S", size: 7.2, color: C.muted }));
    ly += 13;
    for (const r of taxSummary) {
      put(r.rate, tc[0], ly, { width: 48, size: 8 });
      put(money(r.taxable), tc[1], ly, { width: 76, size: 8 });
      put(money(r.a), tc[2], ly, { width: 66, size: 8 });
      if (r.b != null) put(money(r.b), tc[3], ly, { width: 66, size: 8 });
      ly += 13;
    }
    ly += 8;
  }
  if (notesText) {
    label("Tax notes", M, ly, LEFT_W);
    ly += 14;
    put(notesText, M, ly, { width: LEFT_W, size: 7.6, color: "#44403c" });
    ly += heightOf(notesText, LEFT_W, "R", 7.6) + 8;
  }
  if (bankLines.length) {
    label("Bank details", M, ly, LEFT_W);
    ly += 14;
    for (const l of bankLines) {
      put(l, M, ly, { width: LEFT_W, size: 8, color: "#44403c" });
      ly += heightOf(l, LEFT_W, "R", 8) + 2;
    }
    ly += 8;
  }
  y = Math.max(ly, ty) + 6;
  put(wordsText, M, y, { width: CONTENT_W, size: 8, color: C.muted });
  y += wordsH;

  // ---- terms + signature ---------------------------------------------------------------------------------
  const terms = clean(company.terms);
  const termsDiffer = terms && terms.toLowerCase() !== THANK_YOU(brand).toLowerCase() && terms !== "Thank you for shopping with Tushaqsa.";
  const showSignature = Boolean(signature || clean(company.signatoryName));
  const termsH = termsDiffer ? 16 + heightOf(terms, CONTENT_W - 190, "R", 8) + 6 : 0;
  const sigH = showSignature ? 64 : 0;
  if (termsDiffer || showSignature) {
    if (y + Math.max(termsH, sigH) > CONTENT_BOTTOM) continuationPage();
    if (termsDiffer) {
      label("Terms", M, y, CONTENT_W - 190);
      put(terms, M, y + 14, { width: CONTENT_W - 190, size: 8, color: "#44403c" });
    }
    if (showSignature) {
      const sx = PAGE_W - M - 160;
      if (signature) {
        const scale = Math.min(130 / signature.width, 40 / signature.height, 1);
        doc.image(signature.buffer, sx, y, { width: signature.width * scale, height: signature.height * scale });
      }
      hr(y + 46, sx, PAGE_W - M, C.muted, 0.6);
      put(clean(company.signatoryName) || "Authorized signatory", sx, y + 51, { width: 160, size: 8, color: C.muted });
    }
  }

  // ---- footer on every page ------------------------------------------------------------------------------
  const range = doc.bufferedPageRange();
  const contact = [clean(company.email), clean(company.phone)].filter(Boolean).join("  ·  ");
  const footNote = clean(company.footer);
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    hr(FOOTER_TOP, M, PAGE_W - M, C.line, 0.8);
    put(THANK_YOU(brand), M, FOOTER_TOP + 10, { width: 300, font: "S", size: 8.6 });
    put([contact, website].filter(Boolean).join("  ·  "), M, FOOTER_TOP + 24, { width: 380, size: 7.6, color: C.muted });
    if (footNote) put(footNote, M, FOOTER_TOP + 37, { width: 380, size: 7, color: C.muted });
    put(`Page ${i + 1} of ${range.count}`, PAGE_W - M - 100, FOOTER_TOP + 10, { width: 100, size: 7.6, color: C.muted, align: "right" });
  }

  doc.end();
  return finished;
}
