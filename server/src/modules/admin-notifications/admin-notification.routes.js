import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import * as adminNotificationService from "./admin-notification.service.js";

const listQuerySchema = z.object({
  isRead: z.enum(["true", "false"]).optional(),
  type: z.string().optional(),
  severity: z.string().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

export const adminNotificationRouter = Router();
adminNotificationRouter.use(requireAdmin);

adminNotificationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const result = await adminNotificationService.listAdminNotifications({
      isRead: query.isRead === undefined ? undefined : query.isRead === "true",
      type: query.type,
      severity: query.severity,
      take: query.take ?? 50,
      skip: query.skip ?? 0,
    });
    ok(res, result.items, { unreadCount: result.unreadCount, total: result.total });
  })
);

adminNotificationRouter.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const updated = await adminNotificationService.markAdminNotificationRead(req.params.id);
    ok(res, updated);
  })
);

adminNotificationRouter.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    const result = await adminNotificationService.markAllAdminNotificationsRead();
    ok(res, result);
  })
);

export default adminNotificationRouter;
