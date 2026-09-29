import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { resetDb, seedTestProduct, seedTestAdmin } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";
import { renderInvoicePdf } from "../src/modules/invoices/invoice.pdf.js";
import { decodeImageForPdf, decodePngForPdf, decodeJpegForPdf } from "../src/modules/invoices/invoice.image.js";
import { uploadRootDir, PUBLIC_UPLOAD_PREFIX } from "../src/modules/uploads/storage.js";

const { createApp } = await import("../src/app.js");
const app = createApp();

// Minimal valid 1x1 PNG (grayscale+alpha, 8-bit) — same fixture used by
// media_branding.test.js to exercise the real upload pipeline.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

// A hand-built minimal baseline JPEG: SOI, a SOF0 segment carrying
// width/height, and EOI. This is enough to exercise
// decodeJpegForPdf/embedding without needing a real photographic JPEG —
// the writer never re-decodes the compressed scan data, only the
// width/height header.
function buildFakeJpeg(width, height) {
  const soi = Buffer.from([0xff, 0xd8]);
  const sof0 = Buffer.concat([
    Buffer.from([0xff, 0xc0]),
    Buffer.from([0x00, 0x11]), // length = 17
    Buffer.from([0x08]), // precision
    Buffer.from([(height >> 8) & 0xff, height & 0xff]),
    Buffer.from([(width >> 8) & 0xff, width & 0xff]),
    Buffer.from([0x01]), // 1 component
    Buffer.from([0x01, 0x11, 0x00]),
  ]);
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([soi, sof0, eoi]);
}

async function placeSavedLocalImage(buffer, filename) {
  await fs.mkdir(uploadRootDir, { recursive: true });
  await fs.writeFile(path.join(uploadRootDir, filename), buffer);
  return `${PUBLIC_UPLOAD_PREFIX}/${filename}`;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

async function placeOrder() {
  const product = await seedTestProduct({ price: 500, stockQuantity: 10 });
  const res = await request(app)
    .post("/api/orders")
    .send({
      customer: { name: "Img Test", email: "imgtest@example.com", phone: "9876543210" },
      shippingAddress: { fullName: "Img Test", phone: "9876543210", addressLine1: "1 Test St", city: "Bengaluru", state: "Karnataka", postalCode: "560001", country: "India" },
      items: [{ slug: product.slug, quantity: 1 }],
    });
  return res.body.data.orderId;
}

async function markPaidAndInvoice(orderId) {
  await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID", status: "CONFIRMED", paidAt: new Date() } });
  const { ensureInvoiceForOrder } = await import("../src/modules/invoices/invoice.service.js");
  return ensureInvoiceForOrder(orderId);
}

describe("invoice.image.js: low-level decoders", () => {
  it("decodes an 8-bit PNG (grayscale+alpha) and returns FlateDecode RGB + SMask alpha data", () => {
    const decoded = decodePngForPdf(PNG_1X1);
    expect(decoded.type).toBe("png");
    expect(decoded.width).toBe(1);
    expect(decoded.height).toBe(1);
    expect(decoded.colorSpace).toBe("DeviceRGB");
    expect(decoded.filter).toBe("FlateDecode");
    expect(decoded.data.length).toBeGreaterThan(0);
    expect(decoded.smaskData).toBeTruthy(); // alpha channel preserved as SMask
  });

  it("decodes a baseline JPEG's width/height via the SOF0 marker", () => {
    const jpeg = buildFakeJpeg(200, 80);
    const decoded = decodeJpegForPdf(jpeg);
    expect(decoded.type).toBe("jpeg");
    expect(decoded.width).toBe(200);
    expect(decoded.height).toBe(80);
    expect(decoded.filter).toBe("DCTDecode");
    expect(decoded.data).toBe(jpeg); // JPEG bytes embedded as-is, no re-encode
  });

  it("throws (does not silently succeed) on an unsupported/corrupt image", () => {
    expect(() => decodeImageForPdf(Buffer.from("not an image"))).toThrow();
  });

  it("throws on an indexed-color (palette) PNG color type, a documented limitation", () => {
    // Reuse the real IHDR but flip colorType to 3 (palette) — decode should
    // refuse rather than produce a wrong-colored image.
    const forged = Buffer.from(PNG_1X1);
    forged[25] = 3; // IHDR colorType byte
    expect(() => decodePngForPdf(forged)).toThrow(/color type/i);
  });
});

describe("invoice PDF: logo/signature embedding", () => {
  it("embeds a real logo image XObject when companySnapshot.logoUrl resolves to a valid local PNG", async () => {
    const url = await placeSavedLocalImage(PNG_1X1, `test-logo-${Date.now()}.png`);
    const invoice = {
      invoiceNumber: "TEST/2025-26/000001",
      invoiceDate: new Date(),
      currency: "INR",
      subtotal: 100,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 100,
      customerName: "Test Buyer",
      customerEmail: "buyer@test.local",
      billingAddress: {},
      shippingAddress: {},
      companySnapshot: { legalName: "Test Co", logoUrl: url },
      taxSnapshot: {},
      itemsSnapshot: [{ productName: "Item", quantity: 1, unitPrice: 100, taxableValue: 100, lineTotal: 100 }],
      order: {},
    };
    const pdf = await renderInvoicePdf(invoice);
    const text = pdf.toString("latin1");
    expect(text).toContain("/Im1"); // logo XObject referenced in content stream
    expect(text).toContain("/Subtype /Image");
    expect(text).not.toContain("[Logo:"); // real image used, not the text fallback
  });

  it("falls back to text (no exception, invoice creation still succeeds) when logoUrl is missing/unresolvable", async () => {
    const invoice = {
      invoiceNumber: "TEST/2025-26/000002",
      invoiceDate: new Date(),
      currency: "INR",
      subtotal: 100,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 100,
      customerName: "Test Buyer",
      customerEmail: "buyer@test.local",
      billingAddress: {},
      shippingAddress: {},
      companySnapshot: { legalName: "Test Co", logoUrl: "/uploads/products/does-not-exist.png" },
      taxSnapshot: {},
      itemsSnapshot: [{ productName: "Item", quantity: 1, unitPrice: 100, taxableValue: 100, lineTotal: 100 }],
      order: {},
    };
    await expect(renderInvoicePdf(invoice)).resolves.toBeTruthy();
    const pdf = await renderInvoicePdf(invoice);
    const text = pdf.toString("latin1");
    expect(text).toContain("[Logo: /uploads/products/does-not-exist.png]");
    expect(text).not.toContain("/Subtype /Image");
  });

  it("falls back to text when the logo file exists but is corrupt/undecodable", async () => {
    const url = await placeSavedLocalImage(Buffer.from("this is not a real png"), `corrupt-logo-${Date.now()}.png`);
    const invoice = {
      invoiceNumber: "TEST/2025-26/000003",
      invoiceDate: new Date(),
      currency: "INR",
      subtotal: 100,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 100,
      customerName: "Test Buyer",
      customerEmail: "buyer@test.local",
      billingAddress: {},
      shippingAddress: {},
      companySnapshot: { legalName: "Test Co", logoUrl: url },
      taxSnapshot: {},
      itemsSnapshot: [{ productName: "Item", quantity: 1, unitPrice: 100, taxableValue: 100, lineTotal: 100 }],
      order: {},
    };
    const pdf = await renderInvoicePdf(invoice);
    const text = pdf.toString("latin1");
    expect(text).toContain(`[Logo: ${url}]`);
    expect(text).not.toContain("/Subtype /Image");
  });

  it("embeds a real signature image XObject when companySnapshot.signatureUrl resolves, falls back to signatoryName text when missing", async () => {
    const url = await placeSavedLocalImage(PNG_1X1, `test-sig-${Date.now()}.png`);
    const base = {
      invoiceNumber: "TEST/2025-26/000004",
      invoiceDate: new Date(),
      currency: "INR",
      subtotal: 100,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 100,
      customerName: "Test Buyer",
      customerEmail: "buyer@test.local",
      billingAddress: {},
      shippingAddress: {},
      taxSnapshot: {},
      itemsSnapshot: [{ productName: "Item", quantity: 1, unitPrice: 100, taxableValue: 100, lineTotal: 100 }],
      order: {},
    };

    const withSig = await renderInvoicePdf({ ...base, companySnapshot: { legalName: "Test Co", signatureUrl: url, signatoryName: "Jane Doe" } });
    const withSigText = withSig.toString("latin1");
    expect(withSigText).toContain("/Im2"); // signature XObject (Im1 slot reserved for logo)
    expect(withSigText).not.toContain("[Signature:");

    const withoutSig = await renderInvoicePdf({ ...base, companySnapshot: { legalName: "Test Co", signatureUrl: null, signatoryName: "Jane Doe" } });
    const withoutSigText = withoutSig.toString("latin1");
    expect(withoutSigText).toContain("Jane Doe"); // fallback text (signatoryName)
    expect(withoutSigText).not.toContain("/Subtype /Image");
  });

  it("end-to-end: an order-based invoice with a real logo embeds without throwing and produces a larger PDF than the no-logo case", async () => {
    const url = await placeSavedLocalImage(PNG_1X1, `e2e-logo-${Date.now()}.png`);
    const invoiceService = await import("../src/modules/invoices/invoice.service.js");
    await invoiceService.updateInvoiceSettings({ ...(await invoiceService.getInvoiceSettings()), logoUrl: url });

    const orderId = await placeOrder();
    const invoice = await markPaidAndInvoice(orderId);
    expect(invoice.companySnapshot.logoUrl).toBe(url);

    const { readInvoicePdf } = await import("../src/modules/invoices/invoice.storage.js");
    const file = await readInvoicePdf(invoice.pdfStorageKey);
    expect(file.size).toBeGreaterThan(0);
  });
});

describe("invoice PDF: GST summary grouped by rate", () => {
  it("renders one row-group per distinct gstRate present in itemsSnapshot", async () => {
    const invoice = {
      invoiceNumber: "TEST/2025-26/000005",
      invoiceDate: new Date(),
      currency: "INR",
      subtotal: 1000,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 1180,
      customerName: "Test Buyer",
      customerEmail: "buyer@test.local",
      billingAddress: {},
      shippingAddress: {},
      companySnapshot: { legalName: "Test Co" },
      taxSnapshot: { cgstAmount: 51.5, sgstAmount: 51.5, igstAmount: 0 },
      itemsSnapshot: [
        { productName: "Item A", hsnCode: "1001", quantity: 1, unitPrice: 500, taxableValue: 500, gstRate: 5, cgstAmount: 12.5, sgstAmount: 12.5, igstAmount: 0, lineTotal: 525 },
        { productName: "Item B", hsnCode: "2002", quantity: 1, unitPrice: 500, taxableValue: 500, gstRate: 18, cgstAmount: 45, sgstAmount: 45, igstAmount: 0, lineTotal: 590 },
      ],
      order: {},
    };
    const pdf = await renderInvoicePdf(invoice);
    const text = pdf.toString("latin1");
    expect(text).toContain("5%");
    expect(text).toContain("18%");
  });

  it("uses IGST columns (not CGST/SGST) when the frozen taxSnapshot indicates an inter-state invoice", async () => {
    const invoice = {
      invoiceNumber: "TEST/2025-26/000006",
      invoiceDate: new Date(),
      currency: "INR",
      subtotal: 500,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 590,
      customerName: "Test Buyer",
      customerEmail: "buyer@test.local",
      billingAddress: {},
      shippingAddress: {},
      companySnapshot: { legalName: "Test Co" },
      taxSnapshot: { enabled: true, cgstAmount: 0, sgstAmount: 0, igstAmount: 90 },
      itemsSnapshot: [{ productName: "Item A", hsnCode: "1001", quantity: 1, unitPrice: 500, taxableValue: 500, gstRate: 18, cgstAmount: 0, sgstAmount: 0, igstAmount: 90, lineTotal: 590 }],
      order: {},
    };
    const pdf = await renderInvoicePdf(invoice);
    const text = pdf.toString("latin1");
    expect(text).toContain("Inter-state supply");
    expect(text).toContain("IGST");
  });
});

describe("invoice PDF: historical immutability with images", () => {
  it("regenerating a PDF for an existing invoice does not change if Product/Settings are mutated afterwards, including branding", async () => {
    const url = await placeSavedLocalImage(PNG_1X1, `immut-logo-${Date.now()}.png`);
    const invoiceService = await import("../src/modules/invoices/invoice.service.js");
    await invoiceService.updateInvoiceSettings({ ...(await invoiceService.getInvoiceSettings()), logoUrl: url, legalName: "Original Co" });

    const orderId = await placeOrder();
    const invoice = await markPaidAndInvoice(orderId);
    const originalCompanySnapshot = JSON.parse(JSON.stringify(invoice.companySnapshot));

    // Mutate settings (including branding) after issuance.
    const url2 = await placeSavedLocalImage(PNG_1X1, `immut-logo2-${Date.now()}.png`);
    await invoiceService.updateInvoiceSettings({ ...(await invoiceService.getInvoiceSettings()), logoUrl: url2, legalName: "Changed Co" });

    const regenerated = await invoiceService.regenerateInvoicePdf(invoice.id);
    const reloaded = await prisma.invoice.findUnique({ where: { id: regenerated.id } });
    expect(JSON.parse(JSON.stringify(reloaded.companySnapshot))).toEqual(originalCompanySnapshot);
    expect(reloaded.companySnapshot.logoUrl).toBe(url); // NOT url2
    expect(reloaded.companySnapshot.legalName).toBe("Original Co");
  });
});
