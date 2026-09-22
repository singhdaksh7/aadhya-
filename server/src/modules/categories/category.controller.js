import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok, created, noContent } from "../../utils/apiResponse.js";
import {
  createCategorySchema,
  updateCategorySchema,
  listCategoriesQuerySchema,
} from "./category.validators.js";
import * as categoryService from "./category.service.js";

export const listPublicCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.listCategories({ includeInactive: false });
  ok(res, categories);
});

export const listAdminCategories = asyncHandler(async (req, res) => {
  const { includeInactive } = listCategoriesQuerySchema.parse(req.query);
  const categories = await categoryService.listCategories({ includeInactive: includeInactive ?? true });
  ok(res, categories);
});

export const getAdminCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);
  ok(res, category);
});

export const createAdminCategory = asyncHandler(async (req, res) => {
  const input = createCategorySchema.parse(req.body);
  const category = await categoryService.createCategory(input);
  created(res, category);
});

export const updateAdminCategory = asyncHandler(async (req, res) => {
  const input = updateCategorySchema.parse(req.body);
  const category = await categoryService.updateCategory(req.params.id, input);
  ok(res, category);
});

export const deleteAdminCategory = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.params.id);
  noContent(res);
});
