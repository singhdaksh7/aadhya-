import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { resetDb, seedTestAdmin, seedTestProduct } from "./helpers.js";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";
import { createAdminNotification } from "../src/modules/admin-notifications/admin-notification.service.js";
import { checkAndNotifyLowStock, runLowStockSweep } from "../src/modules/inventory/low-stock.service.js";

const app = createApp();

async function getToken() {
  await seedTestAdmin();
  const res = await request(app)
    .post("/api/admin/auth/login")
    .send({ email: env.admin.email, password: env.admin.password });
  return res.body.data.accessToken;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("admin notifications", () => {
  it("creates an admin notification via the internal helper", async () => {
    const notif = await createAdminNotification({
      type: "EMAIL_FAILED",
      title: "Email failed",
      message: "Order confirmation email could not be sent.",
      severity: "WARNING",
      entityType: "Order",
      entityId: "order-123",
    });
    expect(notif.id).toBeDefined();
    expect(notif.type).toBe("EMAIL_FAILED");
    expect(notif.isRead).toBe(false);
  });

  it("lists notifications and unread count via the admin API", async () => {
    const token = await getToken();
    await createAdminNotification({ type: "SYSTEM_WARNING", title: "t", message: "m" });

    const res = await request(app)
      .get("/api/admin/notifications")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.meta.unreadCount).toBe(1);
  });

  it("marks a single notification read", async () => {
    const token = await getToken();
    const notif = await createAdminNotification({ type: "SYSTEM_WARNING", title: "t", message: "m" });

    const res = await request(app)
      .patch(`/api/admin/notifications/${notif.id}/read`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isRead).toBe(true);
  });

  it("marks all notifications read", async () => {
    const token = await getToken();
    await createAdminNotification({ type: "SYSTEM_WARNING", title: "a", message: "m" });
    await createAdminNotification({ type: "SYSTEM_WARNING", title: "b", message: "m" });

    const res = await request(app)
      .patch("/api/admin/notifications/read-all")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const unread = await prisma.adminNotification.count({ where: { isRead: false } });
    expect(unread).toBe(0);
  });

  it("rejects notification access without admin auth", async () => {
    const res = await request(app).get("/api/admin/notifications");
    expect(res.status).toBe(401);
  });
});

describe("low stock notifications", () => {
  it("creates a LOW_STOCK notification when stock falls at/below threshold", async () => {
    const product = await seedTestProduct({ stockQuantity: 10 });
    await prisma.product.update({ where: { id: product.id }, data: { lowStockThreshold: 5, stockQuantity: 3 } });

    const notif = await checkAndNotifyLowStock({ productId: product.id });
    expect(notif).not.toBeNull();
    expect(notif.type).toBe("LOW_STOCK");

    const count = await prisma.adminNotification.count({ where: { entityType: "Product", entityId: product.id } });
    expect(count).toBe(1);
  });

  it("creates OUT_OF_STOCK when stock hits zero", async () => {
    const product = await seedTestProduct({ stockQuantity: 0 });
    await prisma.product.update({ where: { id: product.id }, data: { lowStockThreshold: 5 } });

    const notif = await checkAndNotifyLowStock({ productId: product.id });
    expect(notif.type).toBe("OUT_OF_STOCK");
  });

  it("does not duplicate notifications on repeated checks while still below threshold", async () => {
    const product = await seedTestProduct({ stockQuantity: 3 });
    await prisma.product.update({ where: { id: product.id }, data: { lowStockThreshold: 5 } });

    const first = await checkAndNotifyLowStock({ productId: product.id });
    const second = await checkAndNotifyLowStock({ productId: product.id });

    expect(first).not.toBeNull();
    expect(second).toBeNull();

    const count = await prisma.adminNotification.count({ where: { entityType: "Product", entityId: product.id } });
    expect(count).toBe(1);
  });

  it("notifies again after stock recovers above threshold and falls below again", async () => {
    const product = await seedTestProduct({ stockQuantity: 3 });
    await prisma.product.update({ where: { id: product.id }, data: { lowStockThreshold: 5 } });

    await checkAndNotifyLowStock({ productId: product.id });

    // Recover above threshold — should clear the dedupe flag, no new notification.
    await prisma.product.update({ where: { id: product.id }, data: { stockQuantity: 20 } });
    const duringRecovery = await checkAndNotifyLowStock({ productId: product.id });
    expect(duringRecovery).toBeNull();

    // Fall below threshold again — should notify a second time.
    await prisma.product.update({ where: { id: product.id }, data: { stockQuantity: 2 } });
    const second = await checkAndNotifyLowStock({ productId: product.id });
    expect(second).not.toBeNull();

    const count = await prisma.adminNotification.count({ where: { entityType: "Product", entityId: product.id } });
    expect(count).toBe(2);
  });

  it("runLowStockSweep checks all tracked active products and dedupes", async () => {
    const low = await seedTestProduct({ stockQuantity: 1 });
    await prisma.product.update({ where: { id: low.id }, data: { lowStockThreshold: 5 } });
    const ok = await seedTestProduct({ stockQuantity: 50 });
    await prisma.product.update({ where: { id: ok.id }, data: { lowStockThreshold: 5 } });

    const result = await runLowStockSweep();
    expect(result.notified).toBe(1);

    const result2 = await runLowStockSweep();
    expect(result2.notified).toBe(0);
  });
});
