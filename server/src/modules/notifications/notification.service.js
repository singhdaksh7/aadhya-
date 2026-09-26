import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";

export async function listCustomerNotifications(customerId) {
  const notifications = await prisma.customerNotification.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = await prisma.customerNotification.count({
    where: { customerId, isRead: false },
  });

  return {
    items: notifications,
    unreadCount,
  };
}

export async function markNotificationRead(customerId, notificationId) {
  const notif = await prisma.customerNotification.findUnique({
    where: { id: notificationId },
  });

  if (!notif || notif.customerId !== customerId) {
    throw ApiError.notFound("Notification not found.");
  }

  const updated = await prisma.customerNotification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return updated;
}

export async function markAllNotificationsRead(customerId) {
  await prisma.customerNotification.updateMany({
    where: { customerId, isRead: false },
    data: { isRead: true },
  });

  return { success: true };
}
