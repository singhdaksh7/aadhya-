import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { optionalCustomer } from "../../middleware/customerAuth.js";
import { analyticsLimiter } from "../../middleware/rateLimiters.js";
import * as controller from "./analytics.controller.js";

export const publicAnalyticsRouter = Router();
publicAnalyticsRouter.post("/events", analyticsLimiter, optionalCustomer, controller.trackEvents);

export const adminAnalyticsRouter = Router();
adminAnalyticsRouter.use(requireAdmin);
adminAnalyticsRouter.get("/overview", controller.getOverview);
adminAnalyticsRouter.get("/revenue", controller.getRevenue);
adminAnalyticsRouter.get("/products", controller.getProducts);
adminAnalyticsRouter.get("/categories", controller.getCategories);
adminAnalyticsRouter.get("/collections", controller.getCollections);
adminAnalyticsRouter.get("/coupons", controller.getCoupons);
adminAnalyticsRouter.get("/inventory", controller.getInventory);
adminAnalyticsRouter.get("/searches", controller.getSearches);
adminAnalyticsRouter.get("/abandoned-carts", controller.getAbandonedCarts);
adminAnalyticsRouter.post("/abandoned-carts/:cartId/recovery-email", controller.sendAbandonedCartRecovery);
