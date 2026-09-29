// A deliberately small server-side PDF writer (hand-rolled PDF-1.4, no
// external library). It keeps invoice rendering out of the browser and has
// no filesystem paths or external URLs in its output. This file was
// extended (rather than replaced with a library like pdfkit) to render a
// proper A4 tabular GST invoice layout: a fixed-width monospace grid gives
// us aligned columns without needing real table-drawing primitives, and
// PDF's `re`/`f`/`S` operators draw the rule lines around it.
//
// Logo/signature images: rendered as real PDF Image XObjects (JPEG via
// /DCTDecode, PNG via a hand-rolled decoder + /FlateDecode — see
// invoice.image.js) when the stored branding URL resolves to a local,
// decodable file; otherwise this falls back to the original text-only
// rendering, so a missing/corrupt image can never break invoice creation.
import { amountInWords } from "../../utils/amountInWords.js";
import { loadEmbeddableImage } from "./invoice.image.js";

function esc(value) {
  return String(value ?? "").replace(/([\\()])/g, "\\$1").replace(/[\r\n]+/g, " ");
}
const money = (amount, currency = "INR") => `${currency === "INR" ? "Rs. " : `${currency} `}${Number(amount || 0).toFixed(2)}`;

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Computes a draw box (x, y-bottom, w, h) for an image at a given top-left
// anchor, preserving aspect ratio and capped to maxH/maxW.
function fitBox(imgWidth, imgHeight, maxW, maxH) {
  const scale = Math.min(maxW / imgWidth, maxH / imgHeight, 1);
  return { w: imgWidth * scale, h: imgHeight * scale };
}

// Builds the text/graphics content stream for a single page's worth of
// invoice body. `ops` accumulates raw PDF content-stream operators.
// `images` maps a logical slot ("logo"/"signature") to a decoded image
// (see invoice.image.js) or null. Returns the content stream text plus the
// list of image slots that were actually placed (so the caller knows which
// XObjects to embed and reference in Resources).
function buildContent(invoice, images) {
  const company = invoice.companySnapshot || {};
  const tax = invoice.taxSnapshot || {};
  const items = invoice.itemsSnapshot || [];
  const currency = invoice.currency || "INR";
  const ops = [];
  const placedImages = [];
  let y = PAGE_H - MARGIN;

  const rects = []; // border/fill rectangles, drawn first (behind text)
  const lines = []; // ruled lines

  function text(x, ty, str, { size = 9, font = "F1" } = {}) {
    ops.push(`BT /${font} ${size} Tf 1 0 0 1 ${x} ${ty} Tm (${esc(str)}) Tj ET`);
  }
  function rule(x1, ty, x2, ty2) {
    lines.push(`${x1} ${ty} m ${x2} ${ty2} l S`);
  }
  // Places an image XObject with its top-left corner at (x, topY), scaled
  // to fit within maxW x maxH while preserving aspect ratio. PDF images are
  // drawn in a unit square scaled by the `cm` matrix with origin at the
  // bottom-left, so we translate down by the box height.
  function image(slot, x, topY, maxW, maxH) {
    const img = images[slot];
    if (!img) return null;
    const { w, h } = fitBox(img.width, img.height, maxW, maxH);
    if (!w || !h) return null;
    ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(topY - h).toFixed(2)} cm /${slot === "logo" ? "Im1" : "Im2"} Do Q`);
    placedImages.push(slot);
    return { w, h };
  }

  // --- Header ---
  const logoBox = company.logoUrl ? image("logo", MARGIN, y + 6, 140, 60) : null;
  if (company.logoUrl && !logoBox) text(MARGIN, y, `[Logo: ${company.logoUrl}]`, { size: 7 });
  text(PAGE_W - MARGIN - 120, y, "TAX INVOICE", { size: 16, font: "F2" });
  y -= 20;
  text(MARGIN, y, company.legalName || "Registered Business", { size: 13, font: "F2" });
  y -= 14;
  if (company.address) { text(MARGIN, y, company.address, { size: 9 }); y -= 12; }
  const contactBits = [company.email, company.phone].filter(Boolean).join("  |  ");
  if (contactBits) { text(MARGIN, y, contactBits, { size: 9 }); y -= 12; }
  if (company.gstin) { text(MARGIN, y, `GSTIN: ${company.gstin}`, { size: 9 }); y -= 12; }
  if (company.pan) { text(MARGIN, y, `PAN: ${company.pan}`, { size: 9 }); y -= 12; }

  text(PAGE_W - MARGIN - 220, y + 46, `Invoice No: ${invoice.invoiceNumber}`, { size: 9 });
  text(PAGE_W - MARGIN - 220, y + 34, `Invoice Date: ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}`, { size: 9 });
  text(PAGE_W - MARGIN - 220, y + 22, `Order No: ${invoice.order?.orderNumber || ""}`, { size: 9 });

  // Supply type (intra-state vs inter-state), driven purely by the frozen
  // taxSnapshot (never recomputed from live order/settings state).
  const interState = Number(tax.igstAmount || 0) > 0;
  if (tax.enabled) {
    text(PAGE_W - MARGIN - 220, y + 10, interState ? "Inter-state supply" : "Intra-state supply", { size: 8, font: "F2" });
  }

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

  // --- Tax summary table, grouped by GST rate ---
  // Multi-rate invoices (e.g. some items at 5%, others at 18%) print one
  // row-group per distinct gstRate found in itemsSnapshot, rather than a
  // single blended rate. Whether the invoice as a whole is intra- or
  // inter-state is still taken from taxSnapshot (frozen at issue time), not
  // recomputed here.
  text(MARGIN, y, "Tax Summary", { size: 9.5, font: "F2" });
  y -= 12;
  const taxColX = [MARGIN, MARGIN + 110, MARGIN + 210, MARGIN + 290, MARGIN + 380];
  const headers = interState ? ["GST Rate", "Taxable Amount", "IGST", "", ""] : ["GST Rate", "Taxable Amount", "CGST", "SGST", ""];
  headers.forEach((h, i) => { if (h) text(taxColX[i], y, h, { size: 7.5, font: "F2" }); });
  y -= 11;

  const rateGroups = new Map();
  for (const item of items) {
    const rateKey = item.gstRate != null ? Number(item.gstRate) : "unrated";
    if (!rateGroups.has(rateKey)) rateGroups.set(rateKey, { taxable: 0, cgst: 0, sgst: 0, igst: 0 });
    const group = rateGroups.get(rateKey);
    group.taxable += Number(item.taxableValue ?? 0);
    group.cgst += Number(item.cgstAmount ?? 0);
    group.sgst += Number(item.sgstAmount ?? 0);
    group.igst += Number(item.igstAmount ?? 0);
  }
  const sortedRates = [...rateGroups.keys()].sort((a, b) => (a === "unrated" ? 1 : b === "unrated" ? -1 : a - b));
  if (sortedRates.length) {
    for (const rateKey of sortedRates) {
      const group = rateGroups.get(rateKey);
      const label = rateKey === "unrated" ? "-" : `${rateKey}%`;
      text(taxColX[0], y, label, { size: 7.5 });
      text(taxColX[1], y, round2sum([group.taxable]).toFixed(2), { size: 7.5 });
      if (interState) {
        text(taxColX[2], y, money(group.igst, currency), { size: 7.5 });
      } else {
        text(taxColX[2], y, money(group.cgst, currency), { size: 7.5 });
        text(taxColX[3], y, money(group.sgst, currency), { size: 7.5 });
      }
      y -= 11;
    }
  } else {
    // No per-item breakdown available (legacy/flat-rate snapshot) — fall
    // back to the single blended-rate row this table originally rendered.
    const taxableTotal = round2sum(items.map((i) => Number(i.taxableValue ?? 0)));
    if (interState) {
      text(taxColX[0], y, tax.rate != null ? `${tax.rate}%` : "varies", { size: 7.5 });
      text(taxColX[1], y, taxableTotal.toFixed(2), { size: 7.5 });
      text(taxColX[2], y, money(tax.igstAmount, currency), { size: 7.5 });
      y -= 11;
    } else if (Number(tax.cgstAmount || 0) > 0 || Number(tax.sgstAmount || 0) > 0) {
      text(taxColX[0], y, tax.rate != null ? `${tax.rate}%` : "varies", { size: 7.5 });
      text(taxColX[1], y, taxableTotal.toFixed(2), { size: 7.5 });
      text(taxColX[2], y, money(tax.cgstAmount, currency), { size: 7.5 });
      text(taxColX[3], y, money(tax.sgstAmount, currency), { size: 7.5 });
      y -= 11;
    }
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
  const sigBox = company.signatureUrl ? image("signature", sigX, y + 24, 120, 40) : null;
  if (company.signatureUrl && !sigBox) text(sigX, y + 20, `[Signature: ${company.signatureUrl}]`, { size: 7 });
  rule(sigX, y, PAGE_W - MARGIN, y);
  text(sigX, y - 10, company.signatoryName || "Authorized Signatory", { size: 8 });
  y -= 24;

  text(MARGIN, MARGIN, company.footer || "This is a computer-generated invoice.", { size: 7 });

  return { ops: [...rects, "0.5 w", ...(lines.length ? [lines.join(" ")] : []), ...ops].join("\n"), placedImages };
}

function round2sum(nums) {
  return Math.round(nums.reduce((s, n) => s + n, 0) * 100) / 100;
}

// Builds the PDF object body (a string or a Buffer) plus optional extra
// binary stream bytes for one Image XObject (and, when the source had
// alpha, its SMask XObject). obj() below assembles the full object list;
// image objects are appended after the fixed base objects so their object
// numbers are known before Resources is written.
function imageXObjectStrings(img, smaskObjNum) {
  const smaskEntry = smaskObjNum ? ` /SMask ${smaskObjNum} 0 R` : "";
  const dictHead = `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /${img.colorSpace} /BitsPerComponent ${img.bitsPerComponent} /Filter /${img.filter} /Length ${img.data.length}${smaskEntry} >>\nstream\n`;
  return { head: Buffer.from(dictHead, "latin1"), data: img.data, tail: Buffer.from("\nendstream", "latin1") };
}
function smaskXObjectStrings(alphaDeflated, width, height) {
  const dictHead = `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${alphaDeflated.length} >>\nstream\n`;
  return { head: Buffer.from(dictHead, "latin1"), data: alphaDeflated, tail: Buffer.from("\nendstream", "latin1") };
}

export async function renderInvoicePdf(invoice) {
  const company = invoice.companySnapshot || {};

  // Resolve + decode logo/signature up front. loadEmbeddableImage never
  // throws (see invoice.image.js) — a null result here means "fall back to
  // text", which buildContent already handles.
  const [logoImg, signatureImg] = await Promise.all([
    loadEmbeddableImage(company.logoUrl || null),
    loadEmbeddableImage(company.signatureUrl || null),
  ]);
  const images = { logo: logoImg, signature: signatureImg };

  const { ops, placedImages } = buildContent(invoice, images);

  // --- Base (always-present) objects, as strings ---
  const baseObjects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    null, // placeholder for Page, filled in below once Resources/XObject dict is known
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(ops)} >>\nstream\n${ops}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];

  // --- Optional image XObjects (only for images actually placed) ---
  // Each entry is either a plain string object or { head, data, tail } for
  // a binary stream object; both are handled uniformly by the writer below.
  const extraObjects = [];
  const xobjectRefs = {}; // slot -> object number (1-indexed, filled once positions are known)
  const usesLogo = placedImages.includes("logo") && logoImg;
  const usesSignature = placedImages.includes("signature") && signatureImg;

  // Object numbering: 1-6 are the base objects above (Page is #3). Extra
  // objects start at 7. Each image may consume 1 or 2 object slots (image +
  // optional smask), assigned in order: logo (+smask), then signature
  // (+smask).
  let nextObjNum = baseObjects.length + 1;
  function pushImage(slot, img) {
    let smaskObjNum = null;
    if (img.smaskData) {
      // Reserve the smask's object number first so the image dict can
      // reference it, but the smask object itself is appended after the
      // image object in the file (order in extraObjects doesn't need to
      // match object numbers, only correctness of the numbers referenced).
      smaskObjNum = nextObjNum + 1;
    }
    const imgObjNum = nextObjNum;
    xobjectRefs[slot] = imgObjNum;
    extraObjects.push(imageXObjectStrings(img, smaskObjNum));
    nextObjNum += 1;
    if (img.smaskData) {
      extraObjects.push(smaskXObjectStrings(img.smaskData, img.width, img.height));
      nextObjNum += 1;
    }
  }
  if (usesLogo) pushImage("logo", logoImg);
  if (usesSignature) pushImage("signature", signatureImg);

  const xobjectDictEntries = [
    usesLogo ? `/Im1 ${xobjectRefs.logo} 0 R` : null,
    usesSignature ? `/Im2 ${xobjectRefs.signature} 0 R` : null,
  ].filter(Boolean).join(" ");
  const resources = `/Resources << /Font << /F1 4 0 R /F2 6 0 R >>${xobjectDictEntries ? ` /XObject << ${xobjectDictEntries} >>` : ""} >>`;
  baseObjects[2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ${resources} /Contents 5 0 R >>`;

  const allObjects = [...baseObjects, ...extraObjects];

  // --- Assemble the file as a single Buffer (mixed text/binary objects) ---
  // Text objects are encoded as utf8 (matching the original writer's
  // Buffer.byteLength(ops) /Length calculation, itself utf8-based); binary
  // image stream bytes (head/tail dict strings aside) are copied through
  // untouched.
  const chunks = [Buffer.from("%PDF-1.4\n", "utf8")];
  const offsets = [0];
  let runningLength = chunks[0].length;
  allObjects.forEach((object, i) => {
    offsets.push(runningLength);
    const head = Buffer.from(`${i + 1} 0 obj\n`, "utf8");
    let body;
    if (typeof object === "string") {
      body = Buffer.concat([head, Buffer.from(object, "utf8"), Buffer.from("\nendobj\n", "utf8")]);
    } else {
      body = Buffer.concat([head, Buffer.from(object.head, "utf8" ), object.data, Buffer.from(object.tail, "utf8"), Buffer.from("\nendobj\n", "utf8")]);
    }
    chunks.push(body);
    runningLength += body.length;
  });
  const xrefStart = runningLength;
  const xrefLines = [`xref\n0 ${allObjects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${allObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`];
  chunks.push(Buffer.from(xrefLines.join(""), "utf8"));

  return Buffer.concat(chunks);
}
