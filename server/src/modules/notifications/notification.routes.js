import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { requireCustomer } from "../../middleware/customerAuth.js";
import * as notificationService from "./notification.service.js";

const notificationRouter = Router();

notificationRouter.get(
  "/",
  requireCustomer,
  asyncHandler(async (req, res) => {
    const result = await notificationService.listCustomerNotifications(req.customer.id);
    ok(res, result.items, { unreadCount: result.unreadCount });
  })
);

notificationRouter.patch(
  "/:id/read",
  requireCustomer,
  asyncHandler(async (req, res) => {
    const updated = await notificationService.markNotificationRead(req.customer.id, req.params.id);
    ok(res, updated);
  })
);

notificationRouter.patch(
  "/read-all",
  requireCustomer,
  asyncHandler(async (req, res) => {
    const result = await notificationService.markAllNotificationsRead(req.customer.id);
    ok(res, result);
  })
);

export default notificationRouter;
