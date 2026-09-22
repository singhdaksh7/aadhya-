import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import {
  listPublicCategories,
  listAdminCategories,
  getAdminCategory,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
} from "./category.controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import * as categoryService from "./category.service.js";
import * as productService from "../products/product.service.js";
import { listProductsQuerySchema } from "../products/product.validators.js";

export const publicCategoryRouter = Router();
publicCategoryRouter.get("/", listPublicCategories);
publicCategoryRouter.get(
  "/:slug/products",
  asyncHandler(async (req, res) => {
    const category = await categoryService.getCategoryBySlug(req.params.slug);
    const query = listProductsQuerySchema.parse({ ...req.query, category: category.slug });
    const result = await productService.listPublicProducts(query);
    ok(res, result.items, result.meta);
  })
);

export const adminCategoryRouter = Router();
adminCategoryRouter.use(requireAdmin);
adminCategoryRouter.get("/", listAdminCategories);
adminCategoryRouter.post("/", createAdminCategory);
adminCategoryRouter.get("/:id", getAdminCategory);
adminCategoryRouter.patch("/:id", updateAdminCategory);
adminCategoryRouter.delete("/:id", deleteAdminCategory);
