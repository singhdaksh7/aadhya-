import { ApiError } from "../../utils/ApiError.js";
import { checkAndNotifyLowStock } from "../inventory/low-stock.service.js";

// Best-effort — a notification failure must never block order finalization.
async function notifyLowStockSafely(args) {
  try {
    await checkAndNotifyLowStock(args);
  } catch (err) {
    console.error("Low stock notification check failed:", err);
  }
}

// Runs the low-stock checks queued by decrementStockForOrder. Callers await
// this AFTER their transaction has committed — checkAndNotifyLowStock reads
// the just-decremented row via the global `prisma` client, not `tx`, so
// running it before commit risks reading stale data (or blocking on the
// still-open transaction's row lock). A `queueMicrotask`/fire-and-forget
// version of this used to run detached from the caller entirely, which let
// it race a *subsequent* caller's work (e.g. a test's next `resetDb()`)
// after the awaiting function had already returned.
export async function runPendingLowStockChecks(pending) {
  for (const args of pending) await notifyLowStockSafely(args);
}

// Decrements stock for every item on an order, exactly once. Guarded two
// ways: (1) the CAS `updateMany` with a `stockQuantity: { gte: quantity }`
// filter never lets stock go negative even under concurrent callers, and
// (2) the caller (payment finalize / COD order creation) must gate this
// behind `order.stockDecrementedAt == null` inside the same transaction so a
// retried webhook or duplicate call is a no-op instead of decrementing twice.
// Returns the low-stock checks the caller should run (via
// runPendingLowStockChecks) once its transaction has committed.
export async function decrementStockForOrder(tx, order) {
  const pendingLowStockChecks = [];
  for (const item of order.items) {
    if (item.variantId) {
      const changed = await tx.productVariant.updateMany({
        where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
        data: { stockQuantity: { decrement: item.quantity } },
      });
      if (!changed.count) throw ApiError.conflict("Variant stock changed before the order could be finalized.");
      pendingLowStockChecks.push({ variantId: item.variantId });
    } else if (item.productId) {
      const product = await tx.product.findUnique({ where: { id: item.productId }, select: { trackInventory: true } });
      if (!product?.trackInventory) continue;
      const changed = await tx.product.updateMany({
        where: { id: item.productId, trackInventory: true, stockQuantity: { gte: item.quantity } },
        data: { stockQuantity: { decrement: item.quantity } },
      });
      if (!changed.count) throw ApiError.conflict("Product stock changed before the order could be finalized.");
      pendingLowStockChecks.push({ productId: item.productId });
    }
  }
  await tx.order.update({ where: { id: order.id }, data: { stockDecrementedAt: new Date() } });
  return pendingLowStockChecks;
}

// Restores stock for a cancelled order, exactly once — guarded by
// stockRestoredAt so a duplicate cancel request (or any retry) is a no-op.
export async function restoreStockForOrder(tx, order) {
  for (const item of order.items) {
    if (item.variantId) {
      await tx.productVariant.updateMany({
        where: { id: item.variantId },
        data: { stockQuantity: { increment: item.quantity } },
      });
    } else if (item.productId) {
      const product = await tx.product.findUnique({ where: { id: item.productId }, select: { trackInventory: true } });
      if (!product?.trackInventory) continue;
      await tx.product.updateMany({
        where: { id: item.productId, trackInventory: true },
        data: { stockQuantity: { increment: item.quantity } },
      });
    }
  }
  await tx.order.update({ where: { id: order.id }, data: { stockRestoredAt: new Date() } });
}
