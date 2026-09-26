import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { optionalCustomer } from "../../middleware/customerAuth.js";
import * as controller from "./coupon.controller.js";

export const publicCouponRouter = Router();
publicCouponRouter.get("/active", controller.listPublicActiveCoupons);
publicCouponRouter.post("/validate", optionalCustomer, controller.validateCoupon);

export const adminCouponRouter = Router();
adminCouponRouter.use(requireAdmin);
adminCouponRouter.get("/", controller.listAdminCoupons);
adminCouponRouter.get("/:id", controller.getAdminCouponById);
adminCouponRouter.post("/", controller.createCoupon);
adminCouponRouter.patch("/:id", controller.updateCoupon);
adminCouponRouter.delete("/:id", controller.deleteCoupon);
