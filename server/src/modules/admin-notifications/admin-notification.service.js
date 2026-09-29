import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";

// Internal helper other modules can call to raise an admin-facing
// notification (e.g. email ops, returns/refunds, backup/monitoring,
// shipment failures). Import from server/src/modules/admin-notifications/admin-notification.service.js.
//
// createAdminNotification({
//   type: "LOW_STOCK" | "OUT_OF_STOCK" | "NEW_ORDER" | "PAYMENT_FAILED" |
//         "SHIPMENT_FAILED" | "RETURN_REQUESTED" | "REFUND_FAILED" |
//         "EMAIL_FAILED" | "WEBHOOK_FAILED" | "BACKUP_FAILED" | "SYSTEM_WARNING",
//   title: string,
//   message: string,
//   severity?: "INFO" | "WARNING" | "CRITICAL" (default INFO),
//   entityType?: string,
//   entityId?: string,
// })
export async function createAdminNotification({ type, title, message, severity = "INFO", entityType = null, entityId = null }) {
  if (!type || !title || !message) {
    throw new Error("createAdminNotification requires type, title, and message.");
  }
  return prisma.adminNotification.create({
    data: { type, title, message, severity, entityType, entityId },
  });
}

export async function listAdminNotifications({ isRead, type, severity, take = 50, skip = 0 } = {}) {
  const where = {};
  if (isRead !== undefined) where.isRead = isRead;
  if (type) where.type = type;
  if (severity) where.severity = severity;

  const [items, unreadCount, total] = await Promise.all([
    prisma.adminNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.adminNotification.count({ where: { isRead: false } }),
    prisma.adminNotification.count({ where }),
  ]);

  return { items, unreadCount, total };
}

export async function markAdminNotificationRead(notificationId) {
  const notif = await prisma.adminNotification.findUnique({ where: { id: notificationId } });
  if (!notif) throw ApiError.notFound("Notification not found.");
  return prisma.adminNotification.update({ where: { id: notificationId }, data: { isRead: true } });
}

export async function markAllAdminNotificationsRead() {
  await prisma.adminNotification.updateMany({ where: { isRead: false }, data: { isRead: true } });
  return { success: true };
}
