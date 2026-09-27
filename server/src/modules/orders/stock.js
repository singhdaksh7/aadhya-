import { ApiError } from "../../utils/ApiError.js";

// Decrements stock for every item on an order, exactly once. Guarded two
// ways: (1) the CAS `updateMany` with a `stockQuantity: { gte: quantity }`
// filter never lets stock go negative even under concurrent callers, and
// (2) the caller (payment finalize / COD order creation) must gate this
// behind `order.stockDecrementedAt == null` inside the same transaction so a
// retried webhook or duplicate call is a no-op instead of decrementing twice.
export async function decrementStockForOrder(tx, order) {
  for (const item of order.items) {
    if (item.variantId) {
      const changed = await tx.productVariant.updateMany({
        where: { id: item.variantId, stockQuantity: { gte: item.quantity } },
        data: { stockQuantity: { decrement: item.quantity } },
      });
      if (!changed.count) throw ApiError.conflict("Variant stock changed before the order could be finalized.");
    } else if (item.productId) {
      const product = await tx.product.findUnique({ where: { id: item.productId }, select: { trackInventory: true } });
      if (!product?.trackInventory) continue;
      const changed = await tx.product.updateMany({
        where: { id: item.productId, trackInventory: true, stockQuantity: { gte: item.quantity } },
        data: { stockQuantity: { decrement: item.quantity } },
      });
      if (!changed.count) throw ApiError.conflict("Product stock changed before the order could be finalized.");
    }
  }
  await tx.order.update({ where: { id: order.id }, data: { stockDecrementedAt: new Date() } });
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
