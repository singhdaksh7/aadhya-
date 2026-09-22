import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { productImageUpload } from "../uploads/upload.middleware.js";
import {
  listPublicProducts,
  getPublicProductBySlug,
  listAdminProducts,
  getAdminProduct,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  uploadProductImage,
  deleteProductImage,
  setPrimaryProductImage,
  reorderProductImages,
  listAdminVariants, createAdminVariant, updateAdminVariant, deleteAdminVariant,
} from "./product.controller.js";

export const publicProductRouter = Router();
publicProductRouter.get("/", listPublicProducts);
publicProductRouter.get("/:slug", getPublicProductBySlug);

export const adminProductRouter = Router();
adminProductRouter.use(requireAdmin);
adminProductRouter.get("/", listAdminProducts);
adminProductRouter.post("/", createAdminProduct);
adminProductRouter.get("/:id", getAdminProduct);
adminProductRouter.patch("/:id", updateAdminProduct);
adminProductRouter.delete("/:id", deleteAdminProduct);
adminProductRouter.get("/:id/variants", listAdminVariants);
adminProductRouter.post("/:id/variants", createAdminVariant);
adminProductRouter.patch("/:id/variants/:variantId", updateAdminVariant);
adminProductRouter.delete("/:id/variants/:variantId", deleteAdminVariant);

adminProductRouter.post("/:id/images", productImageUpload.single("image"), uploadProductImage);
adminProductRouter.delete("/:id/images/:imageId", deleteProductImage);
adminProductRouter.post("/:id/images/:imageId/primary", setPrimaryProductImage);
adminProductRouter.post("/:id/images/reorder", reorderProductImages);
