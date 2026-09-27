import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok, created, noContent } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as bookFormatService from "./bookFormat.service.js";

const formatParam = z.enum(["PHYSICAL", "PDF"]);

const upsertSchema = z.object({
  price: z.number().nonnegative(),
  salePrice: z.number().nonnegative().nullable().optional(),
  mrp: z.number().nonnegative().nullable().optional(),
  sku: z.string().trim().max(64).nullable().optional(),
  isActive: z.boolean().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  trackInventory: z.boolean().optional(),
  lowStockThreshold: z.number().int().min(0).nullable().optional(),
  weightGrams: z.number().int().min(0).nullable().optional(),
  maxDownloads: z.number().int().min(1).nullable().optional(),
  expiryDays: z.number().int().min(1).nullable().optional(),
});

export const listBookFormats = asyncHandler(async (req, res) => {
  ok(res, await bookFormatService.listBookFormats(req.params.id));
});

export const getPublicBookFormats = asyncHandler(async (req, res) => {
  ok(res, await bookFormatService.getPublicBookFormats(req.params.id));
});

export const upsertBookFormat = asyncHandler(async (req, res) => {
  const format = formatParam.parse(req.params.format);
  const input = upsertSchema.parse(req.body);
  created(res, await bookFormatService.upsertBookFormat(req.params.id, format, input));
});

export const deleteBookFormat = asyncHandler(async (req, res) => {
  const format = formatParam.parse(req.params.format);
  await bookFormatService.deleteBookFormat(req.params.id, format);
  noContent(res);
});

export const uploadBookFormatPdf = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("A PDF file is required");
  ok(res, await bookFormatService.uploadBookFormatPdf(req.params.id, req.file.buffer, req.file.originalname));
});

export const removeBookFormatPdf = asyncHandler(async (req, res) => {
  ok(res, await bookFormatService.removeBookFormatPdf(req.params.id));
});
