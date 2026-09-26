import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import {
  getPublicFaqs,
  listAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  reorderAdminCategories,
  listAdminItems,
  createAdminItem,
  updateAdminItem,
  deleteAdminItem,
  reorderAdminItems
} from "./faq.controller.js";

export const publicFaqRouter = Router();
publicFaqRouter.get("/", getPublicFaqs);

export const adminFaqRouter = Router();
adminFaqRouter.use(requireAdmin);

// Category routes
adminFaqRouter.get("/categories", listAdminCategories);
adminFaqRouter.post("/categories", createAdminCategory);
adminFaqRouter.put("/categories/:id", updateAdminCategory);
adminFaqRouter.patch("/categories/:id", updateAdminCategory);
adminFaqRouter.delete("/categories/:id", deleteAdminCategory);
adminFaqRouter.post("/categories/reorder", reorderAdminCategories);

// Item routes
adminFaqRouter.get("/items", listAdminItems);
adminFaqRouter.post("/items", createAdminItem);
adminFaqRouter.put("/items/:id", updateAdminItem);
adminFaqRouter.patch("/items/:id", updateAdminItem);
adminFaqRouter.delete("/items/:id", deleteAdminItem);
adminFaqRouter.post("/items/reorder", reorderAdminItems);
