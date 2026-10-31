import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { getOrderPackageContext, confirmOrderPackage, confirmPackageSchema, checkOrderServiceability } from "../shipping/package.service.js";
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
  upsertOrderShipment,
  createOrderShipment,
  generateOrderShipmentAwb,
  scheduleOrderShipmentPickup,
  getOrderShipmentLabel,
  refreshOrderShipmentTracking,
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
adminOrderRouter.get("/:id/package", asyncHandler(async (req, res) => ok(res, await getOrderPackageContext(req.params.id))));
adminOrderRouter.put("/:id/package", asyncHandler(async (req, res) => ok(res, await confirmOrderPackage(req.params.id, confirmPackageSchema.parse(req.body), req.admin?.id))));
adminOrderRouter.post("/:id/shipment/serviceability", asyncHandler(async (req, res) => ok(res, await checkOrderServiceability(req.params.id))));
adminOrderRouter.put("/:id/shipment", upsertOrderShipment);
adminOrderRouter.post("/:id/shipment/create", createOrderShipment);
adminOrderRouter.post("/:id/shipment/awb", generateOrderShipmentAwb);
adminOrderRouter.post("/:id/shipment/pickup", scheduleOrderShipmentPickup);
adminOrderRouter.get("/:id/shipment/label", getOrderShipmentLabel);
adminOrderRouter.post("/:id/shipment/refresh-tracking", refreshOrderShipmentTracking);

function requireCustomerOptional(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return next();
  return requireCustomer(req, res, next);
}
