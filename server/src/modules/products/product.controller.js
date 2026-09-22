import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok, created, noContent } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  reorderImagesSchema,
} from "./product.validators.js";
import * as productService from "./product.service.js";
import { saveBuffer } from "../uploads/storage.js";
import { z } from "zod";

const variantSchema = z.object({ name: z.string().trim().min(1).max(120), sku: z.string().trim().min(1).max(64), priceOverride: z.number().nonnegative().nullable().optional(), stockQuantity: z.number().int().min(0), isActive: z.boolean().optional(), attributes: z.record(z.string().max(80), z.string().max(500)).nullable().optional() });

export const listPublicProducts = asyncHandler(async (req, res) => {
  const query = listProductsQuerySchema.parse(req.query);
  const { items, meta } = await productService.listPublicProducts(query);
  ok(res, items, meta);
});

export const getPublicProductBySlug = asyncHandler(async (req, res) => {
  const product = await productService.getPublicProductBySlug(req.params.slug);
  const related = await productService.listRelatedProducts(product);
  ok(res, { ...product, relatedProducts: related });
});

export const listAdminProducts = asyncHandler(async (req, res) => {
  const query = listProductsQuerySchema.parse(req.query);
  const { items, meta } = await productService.listAdminProducts(query);
  ok(res, items, meta);
});

export const getAdminProduct = asyncHandler(async (req, res) => {
  const product = await productService.getAdminProductById(req.params.id);
  ok(res, product);
});

export const createAdminProduct = asyncHandler(async (req, res) => {
  const input = createProductSchema.parse(req.body);
  const product = await productService.createProduct(input);
  created(res, product);
});

export const updateAdminProduct = asyncHandler(async (req, res) => {
  const input = updateProductSchema.parse(req.body);
  const product = await productService.updateProduct(req.params.id, input);
  ok(res, product);
});

export const deleteAdminProduct = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.params.id);
  noContent(res);
});

export const uploadProductImage = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("An image file is required");
  const url = await saveBuffer(req.file.buffer, req.file.mimetype);
  const image = await productService.addProductImage(req.params.id, {
    url,
    altText: req.body.altText,
    isPrimary: req.body.isPrimary === "true" || req.body.isPrimary === true,
  });
  created(res, image);
});

export const deleteProductImage = asyncHandler(async (req, res) => {
  await productService.deleteProductImage(req.params.id, req.params.imageId);
  noContent(res);
});

export const setPrimaryProductImage = asyncHandler(async (req, res) => {
  await productService.setPrimaryImage(req.params.id, req.params.imageId);
  const product = await productService.getAdminProductById(req.params.id);
  ok(res, product);
});

export const reorderProductImages = asyncHandler(async (req, res) => {
  const { order } = reorderImagesSchema.parse(req.body);
  await productService.reorderProductImages(req.params.id, order);
  const product = await productService.getAdminProductById(req.params.id);
  ok(res, product);
});

export const listAdminVariants = asyncHandler(async (req, res) => ok(res, await productService.listVariants(req.params.id)));
export const createAdminVariant = asyncHandler(async (req, res) => created(res, await productService.createVariant(req.params.id, variantSchema.parse(req.body))));
export const updateAdminVariant = asyncHandler(async (req, res) => ok(res, await productService.updateVariant(req.params.id, req.params.variantId, variantSchema.partial().parse(req.body))));
export const deleteAdminVariant = asyncHandler(async (req, res) => { await productService.deleteVariant(req.params.id, req.params.variantId); noContent(res); });
