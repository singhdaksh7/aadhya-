import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { requireCustomer } from "../../middleware/customerAuth.js";
import { checkoutLimiter, trackOrderLimiter } from "../../middleware/rateLimiters.js";
import {
  checkoutPreview,
  createOrder,
  getOrderConfirmation,
  trackOrder,
  listAdminOrders,
  getAdminOrder,
  updateAdminOrderStatus,
} from "./order.controller.js";

export const checkoutRouter = Router();
checkoutRouter.post("/preview", checkoutLimiter, checkoutPreview);

export const publicOrderRouter = Router();
publicOrderRouter.post("/", checkoutLimiter, requireCustomerOptional, createOrder);
publicOrderRouter.get("/:orderNumber/confirmation", getOrderConfirmation);
publicOrderRouter.post("/track", trackOrderLimiter, trackOrder);

export const adminOrderRouter = Router();
adminOrderRouter.use(requireAdmin);
adminOrderRouter.get("/", listAdminOrders);
adminOrderRouter.get("/:id", getAdminOrder);
adminOrderRouter.patch("/:id/status", updateAdminOrderStatus);

function requireCustomerOptional(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return next();
  return requireCustomer(req, res, next);
}
