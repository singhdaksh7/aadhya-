import { describe, it, expect } from "vitest";
import { renderInvoicePdf, formatMoney } from "../src/modules/invoices/invoice.pdf.js";
import { extractPdfText } from "./pdf-text.js";

// Layout behaviour of the redesigned invoice. Numbers are never recalculated by the renderer, so these
// tests feed frozen snapshots and read back what a customer would read on the PDF.
const addr = { fullName: "Asha Verma", phone: "9876543210", addressLine1: "12 MG Road", addressLine2: "Indiranagar", city: "Bengaluru", state: "Karnataka", postalCode: "560038", country: "India" };
const item = (n, name, qty, price, extra = {}) => ({ productName: name, sku: `S${n}`, quantity: qty, unitPrice: price, discountAmount: 0, taxableValue: qty * price, lineTotal: qty * price, gstRate: null, ...extra });
const base = (over = {}) => ({
  invoiceNumber: "TUS/2026-27/000123",
  invoiceDate: new Date("2026-10-24T08:00:00Z"),
  currency: "INR",
  customerName: "Asha Verma",
  customerEmail: "asha@example.com",
  customerPhone: "9876543210",
  billingAddress: addr,
  shippingAddress: addr,
  order: { orderNumber: "TUS-2026-000123", paymentMethod: "cod", paymentStatus: "PENDING", status: "CONFIRMED" },
  subtotal: 598,
  discountAmount: 0,
  shippingAmount: 0,
  totalAmount: 598,
  companySnapshot: { legalName: "Tushaqsa Home Living", address: "Jaipur, Rajasthan", email: "support@aadyavocational.com", phone: "+91 98765 43210" },
  taxSnapshot: { enabled: false },
  itemsSnapshot: [item(1, "Handwoven Jute Mat", 2, 299)],
  ...over,
});
const pdf = (inv, opts) => renderInvoicePdf(inv, opts);

describe("invoice layout", () => {
  it("produces a valid single-page A4 PDF with the brand, rupee amounts and the required footer", async () => {
    const buf = await pdf(base());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.toString("latin1")).toMatch(/\/MediaBox \[\s*0 0 595\.28 841\.89\s*\]/);
    const { text, pageCount } = await extractPdfText(buf);
    expect(pageCount).toBe(1);
    for (const needle of ["Tushaqsa", "Home Decor and Lifestyle Products", "INVOICE", "TUS/2026-27/000123", "24 Oct 2026", "TUS-2026-000123", "Handwoven Jute Mat", "₹299.00", "₹598.00", "Grand total", "Thank you for shopping with Tushaqsa.", "aadyavocational.com", "Page 1 of 1", "Cash on Delivery", "Pending", "Confirmed", "support@aadyavocational.com"]) expect(text).toContain(needle);
    expect(text).not.toMatch(/demo|lorem|sample|Rs\./i);
    expect(text).not.toContain("TAX INVOICE");
  });

  it("formats rupees with Indian grouping and keeps other currencies readable", () => {
    expect(formatMoney(1234567.5)).toBe("₹12,34,567.50");
    expect(formatMoney(0)).toBe("₹0.00");
    expect(formatMoney(-469)).toBe("-₹469.00");
    expect(formatMoney(1234.5, "USD")).toBe("USD 1,234.50");
  });

  it("shows only fields that exist: no empty Seller block, PAN, bank, terms or signature labels", async () => {
    const { text } = await extractPdfText(await pdf(base({ order: {}, companySnapshot: { legalName: "", address: "" } })));
    for (const absent of ["PAN", "GSTIN", "BANK", "S E L L E R", "T E R M S", "Authorized", "Payment method", "Order no."]) expect(text).not.toContain(absent);
    expect(text).toContain("B I L L E D"); // customer blocks remain
  });

  it("shows seller GSTIN/PAN and bank details only when configured", async () => {
    const inv = base({ companySnapshot: { legalName: "Tushaqsa Home Living", gstin: "08ABCDE1234F1Z5", pan: "ABCDE1234F", bank: { bankName: "HDFC Bank", accountNumber: "50100123456789", ifsc: "HDFC0001234", upiId: "tushaqsa@hdfcbank" }, signatoryName: "R. Sharma" } });
    const { text } = await extractPdfText(await pdf(inv));
    for (const needle of ["GSTIN: 08ABCDE1234F1Z5", "PAN: ABCDE1234F", "HDFC Bank", "A/c no: 50100123456789", "IFSC: HDFC0001234", "UPI: tushaqsa@hdfcbank", "R. Sharma"]) expect(text).toContain(needle);
  });

  it("GST off prints no tax columns; GST on prints tax columns, the supply type and a TAX INVOICE heading", async () => {
    const off = (await extractPdfText(await pdf(base()))).text;
    expect(off).not.toContain("GST");
    expect(off).not.toMatch(/CGST|SGST|IGST/);
    const on = base({
      subtotal: 1000,
      totalAmount: 1115,
      companySnapshot: { legalName: "Tushaqsa Home Living", gstin: "08ABCDE1234F1Z5" },
      taxSnapshot: { enabled: true, cgstAmount: 57.5, sgstAmount: 57.5, igstAmount: 0 },
      itemsSnapshot: [item(1, "Item A", 1, 500, { hsnCode: "1001", gstRate: 5, cgstAmount: 12.5, sgstAmount: 12.5, igstAmount: 0, lineTotal: 525 }), item(2, "Item B", 1, 500, { hsnCode: "2002", gstRate: 18, cgstAmount: 45, sgstAmount: 45, igstAmount: 0, lineTotal: 590 })],
    });
    const { text: raw } = await extractPdfText(await pdf(on));
    const text = raw.replace(/ \./g, "."); // text extraction can split kerned digits ("57 .50")
    for (const needle of ["TAX INVOICE", "Intra-state supply", "HSN 1001", "5%", "18%", "CGST", "SGST", "₹57.50", "₹1,115.00"]) expect(text).toContain(needle);
  });

  it("totals show discount, shipping and rounding only when they exist, and the grand total matches the snapshot", async () => {
    const inv = base({ subtotal: 4690, discountAmount: 469, shippingAmount: 99, totalAmount: 4320, taxSnapshot: { enabled: false, rounding: 0.4 } });
    const { text } = await extractPdfText(await pdf(inv));
    for (const needle of ["Subtotal", "₹4,690.00", "Discount", "-₹469.00", "Shipping", "₹99.00", "Rounding", "₹0.40", "₹4,320.00"]) expect(text).toContain(needle);
    const plain = (await extractPdfText(await pdf(base()))).text;
    expect(plain).not.toContain("Discount");
    expect(plain).not.toContain("Rounding");
    expect(plain).toContain("Free");
  });

  it("wraps long product names and long addresses without dropping any of the text", async () => {
    const longName = "Hand-Block Printed Organic Cotton Reversible Quilted Bedspread with Matching Pillow Covers King Size Indigo and Ochre Heritage Collection";
    const longAddress = "Flat 1204, Tower C, Prestige Shantiniketan Apartments Complex, Whitefield Main Road, Opposite Big Bazaar";
    const a = { ...addr, addressLine1: longAddress, addressLine2: "Behind the Community Hall and Near the Old Water Tank, Ward 84" };
    const { text } = await extractPdfText(await pdf(base({ billingAddress: a, shippingAddress: a, itemsSnapshot: [item(1, longName, 1, 500)] })));
    const flat = text.replace(/\s+/g, " ");
    expect(flat).toContain(longName);
    expect(flat).toContain(longAddress);
    expect(flat).toContain("Behind the Community Hall and Near the Old Water Tank, Ward 84");
  });

  it("flows many items over several pages: every page has the footer and page count, later pages repeat the table header, totals are not split off", async () => {
    const items = Array.from({ length: 60 }, (_, i) => item(i + 1, `Decor product number ${i + 1} with a moderately long descriptive name`, (i % 3) + 1, 249 + i));
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const { pages, pageCount } = await extractPdfText(await pdf(base({ itemsSnapshot: items, subtotal, totalAmount: subtotal })));
    expect(pageCount).toBeGreaterThan(2);
    pages.forEach((p, i) => {
      expect(p).toContain(`Page ${i + 1} of ${pageCount}`);
      expect(p).toContain("Thank you for shopping with Tushaqsa.");
      expect(p).toContain("aadyavocational.com");
    });
    for (const p of pages.slice(1)) {
      expect(p).toContain("(continued)");
      expect(p).toMatch(/U N I T P R I C E/); // repeated table header
    }
    expect(pages.at(-1)).toContain("Grand total");
    expect(pages.slice(0, -1).some((p) => p.includes("Grand total"))).toBe(false);
    for (let n = 1; n <= 60; n += 1) expect(pages.join(" ")).toContain(`Decor product number ${n} `);
  });

  it("prints custom terms but not the default thank-you as terms; tolerates missing snapshots", async () => {
    const custom = (await extractPdfText(await pdf(base({ companySnapshot: { legalName: "Tushaqsa", terms: "Returns accepted within 7 days of delivery." } })))).text;
    expect(custom).toContain("Returns accepted within 7 days of delivery.");
    const dflt = (await extractPdfText(await pdf(base({ companySnapshot: { legalName: "Tushaqsa", terms: "Thank you for shopping with Tushaqsa." } })))).text;
    expect(dflt.match(/Thank you for shopping with Tushaqsa\./g)).toHaveLength(1); // footer only, not repeated as terms
    await expect(pdf({ invoiceNumber: "X/1", invoiceDate: new Date(), subtotal: 0, discountAmount: 0, shippingAmount: 0, totalAmount: 0 })).resolves.toBeTruthy();
  });
});
