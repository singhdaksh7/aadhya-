// A deliberately small server-side PDF writer. It keeps invoice rendering out
// of the browser and has no filesystem paths or external URLs in its output.
function esc(value) {
  return String(value ?? "").replace(/([\\()])/g, "\\$1").replace(/[\r\n]+/g, " ");
}
const money = (amount, currency = "INR") => `${currency === "INR" ? "₹" : `${currency} `}${Number(amount || 0).toFixed(2)}`;

export function renderInvoicePdf(invoice) {
  const company = invoice.companySnapshot || {};
  const tax = invoice.taxSnapshot || {};
  const items = invoice.itemsSnapshot || [];
  const lines = [
    `AADYA | TAX INVOICE`,
    company.legalName || "Aadya Society",
    company.address || "",
    company.email || "",
    `Invoice: ${invoice.invoiceNumber}    Date: ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}`,
    `Order: ${invoice.order?.orderNumber || ""}`,
    "",
    `Bill To: ${invoice.customerName} | ${invoice.customerEmail}`,
    invoice.billingAddress?.addressLine1 || "",
    `${invoice.billingAddress?.city || ""}, ${invoice.billingAddress?.state || ""} ${invoice.billingAddress?.postalCode || ""}`,
    invoice.shippingAddress ? `Ship To: ${invoice.shippingAddress.fullName || invoice.customerName}, ${invoice.shippingAddress.addressLine1 || ""}, ${invoice.shippingAddress.city || ""}` : "",
    "",
    "PRODUCT                                      QTY       UNIT       TAX       TOTAL",
    ...items.map((i) => `${i.productName}${i.sku ? ` (${i.sku})` : ""}`.slice(0, 42).padEnd(44) + String(i.quantity).padStart(3) + money(i.unitPrice, invoice.currency).padStart(12) + money(i.taxAmount, invoice.currency).padStart(12) + money(i.lineTotal, invoice.currency).padStart(12)),
    "",
    `Subtotal: ${money(invoice.subtotal, invoice.currency)}`,
    `Discount: ${money(invoice.discountAmount, invoice.currency)}`,
    `Shipping: ${money(invoice.shippingAmount, invoice.currency)}`,
    `Tax: ${money(invoice.taxAmount, invoice.currency)}`,
    `Grand Total: ${money(invoice.totalAmount, invoice.currency)}`,
    `Payment: ${invoice.order?.paymentMethod || ""} · ${invoice.order?.paymentStatus || ""}`,
    tax.enabled ? `GSTIN: ${tax.gstin || ""} | CGST: ${money(tax.cgstAmount, invoice.currency)} | SGST: ${money(tax.sgstAmount, invoice.currency)} | IGST: ${money(tax.igstAmount, invoice.currency)}` : "",
    "",
    company.terms || "Thank you for shopping with Aadya.",
    company.footer || "This is a computer-generated invoice.",
  ].filter(Boolean);

  const content = ["BT", "/F1 10 Tf", "45 790 Td", "13 TL", ...lines.flatMap((line, index) => [index ? "T*" : "", `(${esc(line)}) Tj`]).filter(Boolean), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(output)); output += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(output, "utf8");
}
