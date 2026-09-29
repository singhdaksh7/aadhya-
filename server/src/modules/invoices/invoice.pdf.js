// A deliberately small server-side PDF writer (hand-rolled PDF-1.4, no
// external library). It keeps invoice rendering out of the browser and has
// no filesystem paths or external URLs in its output. This file was
// extended (rather than replaced with a library like pdfkit) to render a
// proper A4 tabular GST invoice layout: a fixed-width monospace grid gives
// us aligned columns without needing real table-drawing primitives, and
// PDF's `re`/`f`/`S` operators draw the rule lines around it. Embedding a
// raster logo/signature image (PDF image XObjects) was left out of this
// pass to keep the writer small; `companySnapshot.logoUrl`/`signatureUrl`
// are rendered as a text reference line instead until that's worth adding.
import { amountInWords } from "../../utils/amountInWords.js";

function esc(value) {
  return String(value ?? "").replace(/([\\()])/g, "\\$1").replace(/[\r\n]+/g, " ");
}
const money = (amount, currency = "INR") => `${currency === "INR" ? "Rs. " : `${currency} `}${Number(amount || 0).toFixed(2)}`;

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Builds the text/graphics content stream for a single page's worth of
// invoice body. `ops` accumulates raw PDF content-stream operators.
function buildContent(invoice) {
  const company = invoice.companySnapshot || {};
  const tax = invoice.taxSnapshot || {};
  const items = invoice.itemsSnapshot || [];
  const currency = invoice.currency || "INR";
  const ops = [];
  let y = PAGE_H - MARGIN;

  const rects = []; // border/fill rectangles, drawn first (behind text)
  const lines = []; // ruled lines

  function text(x, ty, str, { size = 9, font = "F1" } = {}) {
    ops.push(`BT /${font} ${size} Tf 1 0 0 1 ${x} ${ty} Tm (${esc(str)}) Tj ET`);
  }
  function rule(x1, ty, x2, ty2) {
    lines.push(`${x1} ${ty} m ${x2} ${ty2} l S`);
  }

  // --- Header ---
  if (company.logoUrl) text(MARGIN, y, `[Logo: ${company.logoUrl}]`, { size: 7 });
  text(PAGE_W - MARGIN - 120, y, "TAX INVOICE", { size: 16, font: "F2" });
  y -= 20;
  text(MARGIN, y, company.legalName || "Aadya Society", { size: 13, font: "F2" });
  y -= 14;
  if (company.address) { text(MARGIN, y, company.address, { size: 9 }); y -= 12; }
  const contactBits = [company.email, company.phone].filter(Boolean).join("  |  ");
  if (contactBits) { text(MARGIN, y, contactBits, { size: 9 }); y -= 12; }
  if (company.gstin) { text(MARGIN, y, `GSTIN: ${company.gstin}`, { size: 9 }); y -= 12; }
  if (company.pan) { text(MARGIN, y, `PAN: ${company.pan}`, { size: 9 }); y -= 12; }

  text(PAGE_W - MARGIN - 220, y + 46, `Invoice No: ${invoice.invoiceNumber}`, { size: 9 });
  text(PAGE_W - MARGIN - 220, y + 34, `Invoice Date: ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}`, { size: 9 });
  text(PAGE_W - MARGIN - 220, y + 22, `Order No: ${invoice.order?.orderNumber || ""}`, { size: 9 });

  y -= 8;
  rule(MARGIN, y, PAGE_W - MARGIN, y);
  y -= 16;

  // --- Bill To / Ship To ---
  const colW = CONTENT_W / 2 - 8;
  const billX = MARGIN;
  const shipX = MARGIN + colW + 16;
  const topY = y;
  text(billX, y, "Bill To", { size: 10, font: "F2" });
  text(shipX, y, "Ship To", { size: 10, font: "F2" });
  y -= 13;
  const bill = invoice.billingAddress || {};
  const ship = invoice.shippingAddress || bill;
  const billLines = [invoice.customerName, invoice.customerEmail, invoice.customerPhone, bill.addressLine1, [bill.city, bill.state, bill.postalCode].filter(Boolean).join(", ")].filter(Boolean);
  const shipLines = [ship.fullName || invoice.customerName, ship.phone || invoice.customerPhone, ship.addressLine1, [ship.city, ship.state, ship.postalCode].filter(Boolean).join(", ")].filter(Boolean);
  const maxLines = Math.max(billLines.length, shipLines.length);
  for (let i = 0; i < maxLines; i += 1) {
    if (billLines[i]) text(billX, y, billLines[i], { size: 8.5 });
    if (shipLines[i]) text(shipX, y, shipLines[i], { size: 8.5 });
    y -= 11;
  }
  y = Math.min(y, topY - 13 - maxLines * 11) - 6;

  rule(MARGIN, y, PAGE_W - MARGIN, y);
  y -= 16;

  // --- Items table ---
  // Column layout (x offsets from MARGIN), tuned to sum to CONTENT_W.
  const cols = [
    { key: "#", w: 18 },
    { key: "Description", w: 118 },
    { key: "HSN", w: 42 },
    { key: "Qty", w: 26 },
    { key: "Unit", w: 32 },
    { key: "Rate", w: 46 },
    { key: "Disc", w: 40 },
    { key: "Taxable", w: 52 },
    { key: "GST%", w: 30 },
    { key: "Amount", w: 63 },
  ];
  let cx = MARGIN;
  const colX = cols.map((c) => { const x = cx; cx += c.w; return x; });
  const headerY = y;
  cols.forEach((c, i) => text(colX[i] + 2, headerY, c.key, { size: 7.5, font: "F2" }));
  y -= 4;
  rule(MARGIN, y, PAGE_W - MARGIN, y);
  y -= 11;

  items.forEach((item, idx) => {
    const gstPct = item.gstRate != null ? `${item.gstRate}%` : "-";
    const row = [
      String(idx + 1),
      `${item.productName || ""}${item.sku ? ` (${item.sku})` : ""}`.slice(0, 26),
      item.hsnCode || "-",
      String(item.quantity ?? ""),
      item.unit || "-",
      Number(item.unitPrice || 0).toFixed(2),
      Number(item.discountAmount || 0).toFixed(2),
      Number(item.taxableValue ?? item.lineTotal ?? 0).toFixed(2),
      gstPct,
      Number(item.lineTotal || 0).toFixed(2),
    ];
    row.forEach((val, i) => text(colX[i] + 2, y, val, { size: 7.5 }));
    y -= 12;
    if (y < 140) { y -= 4; } // guard: single-page writer, dense rows fit typical orders
  });
  rule(MARGIN, y + 4, PAGE_W - MARGIN, y + 4);
  y -= 10;

  // --- Tax summary table ---
  text(MARGIN, y, "Tax Summary", { size: 9.5, font: "F2" });
  y -= 12;
  const taxColX = [MARGIN, MARGIN + 150, MARGIN + 260, MARGIN + 340];
  ["Tax Type", "Taxable Amount", "Rate", "Tax Amount"].forEach((h, i) => text(taxColX[i], y, h, { size: 7.5, font: "F2" }));
  y -= 11;
  const taxableTotal = round2sum(items.map((i) => Number(i.taxableValue ?? 0)));
  const interState = Number(tax.igstAmount || 0) > 0;
  if (interState) {
    text(taxColX[0], y, "IGST", { size: 7.5 });
    text(taxColX[1], y, taxableTotal.toFixed(2), { size: 7.5 });
    text(taxColX[2], y, tax.rate != null ? `${tax.rate}%` : "varies", { size: 7.5 });
    text(taxColX[3], y, money(tax.igstAmount, currency), { size: 7.5 });
    y -= 11;
  } else if (Number(tax.cgstAmount || 0) > 0 || Number(tax.sgstAmount || 0) > 0) {
    text(taxColX[0], y, "CGST", { size: 7.5 });
    text(taxColX[1], y, taxableTotal.toFixed(2), { size: 7.5 });
    text(taxColX[2], y, tax.rate != null ? `${tax.rate / 2}%` : "varies", { size: 7.5 });
    text(taxColX[3], y, money(tax.cgstAmount, currency), { size: 7.5 });
    y -= 11;
    text(taxColX[0], y, "SGST", { size: 7.5 });
    text(taxColX[1], y, taxableTotal.toFixed(2), { size: 7.5 });
    text(taxColX[2], y, tax.rate != null ? `${tax.rate / 2}%` : "varies", { size: 7.5 });
    text(taxColX[3], y, money(tax.sgstAmount, currency), { size: 7.5 });
    y -= 11;
  }
  y -= 6;
  rule(MARGIN, y, PAGE_W - MARGIN, y);
  y -= 14;

  // --- Totals block (right-aligned column) ---
  const totalsX = PAGE_W - MARGIN - 200;
  const totalsValX = PAGE_W - MARGIN - 70;
  const totalRows = [
    ["Subtotal", money(invoice.subtotal, currency)],
    ["Discount", money(invoice.discountAmount, currency)],
    ["Shipping", money(invoice.shippingAmount, currency)],
  ];
  if (Number(tax.cgstAmount || 0) > 0) totalRows.push(["CGST", money(tax.cgstAmount, currency)]);
  if (Number(tax.sgstAmount || 0) > 0) totalRows.push(["SGST", money(tax.sgstAmount, currency)]);
  if (Number(tax.igstAmount || 0) > 0) totalRows.push(["IGST", money(tax.igstAmount, currency)]);
  if (tax.rounding) totalRows.push(["Rounding", money(tax.rounding, currency)]);
  totalRows.forEach(([label, val]) => { text(totalsX, y, label, { size: 8.5 }); text(totalsValX, y, val, { size: 8.5 }); y -= 12; });
  rule(totalsX, y + 4, PAGE_W - MARGIN, y + 4);
  y -= 4;
  text(totalsX, y, "Grand Total", { size: 10, font: "F2" });
  text(totalsValX, y, money(invoice.totalAmount, currency), { size: 10, font: "F2" });
  y -= 18;

  text(MARGIN, y, `Amount in words: ${amountInWords(invoice.totalAmount)}`, { size: 8.5 });
  y -= 16;

  // --- Payment / bank details ---
  const paymentBits = [invoice.order?.paymentMethod ? `Mode: ${invoice.order.paymentMethod}` : null, invoice.order?.paymentStatus ? `Status: ${invoice.order.paymentStatus}` : null].filter(Boolean);
  if (paymentBits.length) { text(MARGIN, y, `Payment - ${paymentBits.join("  ")}`, { size: 8.5 }); y -= 12; }
  const bank = company.bank || {};
  if (bank.accountNumber || bank.upiId) {
    text(MARGIN, y, "Bank Details", { size: 9, font: "F2" });
    y -= 11;
    const bankLine = [bank.bankName, bank.accountHolder, bank.accountNumber ? `A/C ${bank.accountNumber}` : null, bank.ifsc ? `IFSC ${bank.ifsc}` : null, bank.branch].filter(Boolean).join("  |  ");
    if (bankLine) { text(MARGIN, y, bankLine, { size: 8 }); y -= 11; }
    if (bank.upiId) { text(MARGIN, y, `UPI: ${bank.upiId}`, { size: 8 }); y -= 11; }
  }
  y -= 6;

  // --- Declaration / terms + signatory ---
  text(MARGIN, y, "Declaration", { size: 8.5, font: "F2" });
  y -= 11;
  text(MARGIN, y, (company.terms || "Thank you for shopping with Aadya.").slice(0, 130), { size: 8 });
  y -= 24;
  const sigX = PAGE_W - MARGIN - 160;
  if (company.signatureUrl) text(sigX, y + 20, `[Signature: ${company.signatureUrl}]`, { size: 7 });
  rule(sigX, y, PAGE_W - MARGIN, y);
  text(sigX, y - 10, company.signatoryName || "Authorized Signatory", { size: 8 });
  y -= 24;

  text(MARGIN, MARGIN, company.footer || "This is a computer-generated invoice.", { size: 7 });

  return { ops: [...rects, "0.5 w", ...(lines.length ? [lines.join(" ")] : []), ...ops].join("\n") };
}

function round2sum(nums) {
  return Math.round(nums.reduce((s, n) => s + n, 0) * 100) / 100;
}

export function renderInvoicePdf(invoice) {
  const { ops } = buildContent(invoice);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 6 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(ops)} >>\nstream\n${ops}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(output)); output += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(output, "utf8");
}
