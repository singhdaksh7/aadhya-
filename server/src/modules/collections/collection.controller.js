import { asyncHandler } from "../../utils/asyncHandler.js";
import { created, noContent, ok } from "../../utils/apiResponse.js";
import * as collectionService from "./collection.service.js";
import {
  createCollectionSchema,
  updateCollectionSchema,
  collectionProductsMembershipSchema,
} from "./collection.validators.js";

export const listPublicCollections = asyncHandler(async (req, res) => {
  const result = await collectionService.listPublicCollections();
  ok(res, result);
});

export const getPublicCollectionBySlug = asyncHandler(async (req, res) => {
  const result = await collectionService.getPublicCollectionBySlug(req.params.slug, req.query);
  ok(res, result);
});

export const listAdminCollections = asyncHandler(async (req, res) => {
  const result = await collectionService.listAdminCollections();
  ok(res, result);
});

export const getAdminCollectionById = asyncHandler(async (req, res) => {
  const result = await collectionService.getAdminCollectionById(req.params.id);
  ok(res, result);
});

export const createCollection = asyncHandler(async (req, res) => {
  const input = createCollectionSchema.parse(req.body);
  const result = await collectionService.createCollection(input);
  created(res, result);
});

export const updateCollection = asyncHandler(async (req, res) => {
  const input = updateCollectionSchema.parse(req.body);
  const result = await collectionService.updateCollection(req.params.id, input);
  ok(res, result);
});

export const updateCollectionProducts = asyncHandler(async (req, res) => {
  const { productIds } = collectionProductsMembershipSchema.parse(req.body);
  const result = await collectionService.updateCollectionProducts(req.params.id, productIds);
  ok(res, result);
});

export const deleteCollection = asyncHandler(async (req, res) => {
  await collectionService.deleteCollection(req.params.id);
  noContent(res);
});
