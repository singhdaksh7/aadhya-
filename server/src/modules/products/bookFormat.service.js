import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { savePdfBuffer, removePdfByKey } from "../uploads/storage.js";

// Only BOOK-type products may have BookFormatOption rows. Enforced here in
// the service layer (not the DB) since Prisma has no cross-table check
// constraint — every mutating path below goes through assertIsBookProduct.
async function assertIsBookProduct(productId) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw ApiError.notFound("Product not found");
  if (product.productType !== "BOOK") {
    throw ApiError.badRequest("Book formats can only be configured for BOOK-type products");
  }
  return product;
}

function serialize(option) {
  if (!option) return option;
  return {
    ...option,
    price: Number(option.price),
    salePrice: option.salePrice != null ? Number(option.salePrice) : null,
    mrp: option.mrp != null ? Number(option.mrp) : null,
    // pdfFileKey is the private storage key — never expose it to the client.
    pdfFileKey: undefined,
    hasPdfFile: Boolean(option.pdfFileKey),
  };
}

export async function listBookFormats(productId) {
  await assertIsBookProduct(productId);
  const options = await prisma.bookFormatOption.findMany({ where: { productId }, orderBy: { format: "asc" } });
  return options.map(serialize);
}

export async function getPublicBookFormats(productId) {
  const options = await prisma.bookFormatOption.findMany({ where: { productId, isActive: true }, orderBy: { format: "asc" } });
  return options.map((option) => ({
    format: option.format,
    price: Number(option.price),
    salePrice: option.salePrice != null ? Number(option.salePrice) : null,
    mrp: option.mrp != null ? Number(option.mrp) : null,
    effectivePrice: option.salePrice != null ? Number(option.salePrice) : Number(option.price),
    sku: option.sku,
    inStock: option.format === "PHYSICAL" ? (option.trackInventory === false ? true : (option.stockQuantity ?? 0) > 0) : true,
  }));
}

export async function upsertBookFormat(productId, format, input) {
  await assertIsBookProduct(productId);

  const data = {
    price: input.price,
    salePrice: input.salePrice ?? null,
    mrp: input.mrp ?? null,
    sku: input.sku ?? null,
    isActive: input.isActive ?? true,
    stockQuantity: format === "PHYSICAL" ? (input.stockQuantity ?? 0) : null,
    trackInventory: format === "PHYSICAL" ? (input.trackInventory ?? true) : null,
    lowStockThreshold: format === "PHYSICAL" ? (input.lowStockThreshold ?? null) : null,
    weightGrams: format === "PHYSICAL" ? (input.weightGrams ?? null) : null,
    maxDownloads: format === "PDF" ? (input.maxDownloads ?? null) : null,
    expiryDays: format === "PDF" ? (input.expiryDays ?? null) : null,
  };

  const existing = await prisma.bookFormatOption.findUnique({ where: { productId_format: { productId, format } } });

  try {
    if (existing) {
      return serialize(await prisma.bookFormatOption.update({ where: { id: existing.id }, data }));
    }
    return serialize(await prisma.bookFormatOption.create({ data: { productId, format, ...data } }));
  } catch (error) {
    if (error.code === "P2002") throw ApiError.conflict("SKU is already in use");
    throw error;
  }
}

export async function deleteBookFormat(productId, format) {
  await assertIsBookProduct(productId);
  const existing = await prisma.bookFormatOption.findUnique({ where: { productId_format: { productId, format } } });
  if (!existing) throw ApiError.notFound("Book format not found");
  if (existing.pdfFileKey) await removePdfByKey(existing.pdfFileKey);
  await prisma.bookFormatOption.delete({ where: { id: existing.id } });
}

export async function uploadBookFormatPdf(productId, buffer, originalName) {
  await assertIsBookProduct(productId);
  const existing = await prisma.bookFormatOption.findUnique({ where: { productId_format: { productId, format: "PDF" } } });
  if (!existing) throw ApiError.badRequest("Create the PDF format option (with a price) before uploading a file");

  const key = await savePdfBuffer(buffer);
  if (existing.pdfFileKey) await removePdfByKey(existing.pdfFileKey);

  return serialize(
    await prisma.bookFormatOption.update({
      where: { id: existing.id },
      data: { pdfFileKey: key, pdfOriginalName: originalName },
    })
  );
}

export async function removeBookFormatPdf(productId) {
  await assertIsBookProduct(productId);
  const existing = await prisma.bookFormatOption.findUnique({ where: { productId_format: { productId, format: "PDF" } } });
  if (!existing) throw ApiError.notFound("PDF format not found");
  if (existing.pdfFileKey) await removePdfByKey(existing.pdfFileKey);
  return serialize(
    await prisma.bookFormatOption.update({ where: { id: existing.id }, data: { pdfFileKey: null, pdfOriginalName: null } })
  );
}

// Used by cart/checkout pricing — resolves a requested (productId, bookFormat)
// pair to its authoritative priced option, or null if unavailable.
export async function resolveBookFormatForPricing(productId, format) {
  const option = await prisma.bookFormatOption.findUnique({ where: { productId_format: { productId, format } } });
  if (!option || !option.isActive) return null;
  return option;
}
