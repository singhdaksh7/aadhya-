import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { priceCartItemsOrThrow, computeTotals } from "./checkout.service.js";
import { generateToken, hashToken, safeCompareHex } from "../../utils/secureToken.js";
import crypto from "node:crypto";

const ADMIN_INCLUDE = {
  items: true,
  address: true,
  payments: { orderBy: { createdAt: "desc" } },
};

// accessTokenHash must never leave the server — it's the secret the
// confirmation token is checked against, not customer-facing data.
function sanitizeOrder(order) {
  if (!order) return order;
  // eslint-disable-next-line no-unused-vars
  const { accessTokenHash: _accessTokenHash, ...safe } = order;
  return safe;
}

function formatOrderNumber(orderSeq) {
  const year = new Date().getFullYear();
  return `AAD-${year}-${String(orderSeq).padStart(6, "0")}`;
}

// Creates Order + OrderItems (price/name/sku/image snapshots) + OrderAddress
// + a PENDING Payment row, all inside one transaction — an order is either
// fully created or not created at all. Stock is NOT touched here; it's only
// ever decremented after a verified successful payment (payment.service.js).
export async function createOrder({ customer, shippingAddress, items, notes, customerId, savedAddressId }) {
  if (savedAddressId) {
    if (!customerId) throw ApiError.forbidden("Sign in to use a saved address.");
    const address = await prisma.address.findFirst({ where: { id: savedAddressId, customerId } });
    if (!address) throw ApiError.notFound("Address not found");
    shippingAddress = address;
  }
  const pricedItems = await priceCartItemsOrThrow(items);
  const totals = computeTotals(pricedItems);

  if (totals.total <= 0) {
    throw ApiError.badRequest("Order total must be greater than zero.");
  }

  const rawToken = generateToken();
  const accessTokenHash = hashToken(rawToken);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: `PENDING-${crypto.randomUUID()}`, // placeholder, overwritten below once orderSeq exists
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        customerId: customerId || null,
        subtotal: totals.subtotal,
        shippingAmount: totals.shipping,
        discountAmount: totals.discount,
        taxAmount: totals.tax,
        totalAmount: totals.total,
        currency: totals.currency,
        notes: notes || null,
        accessTokenHash,
      },
    });

    const orderNumber = formatOrderNumber(created.orderSeq);

    const [updated] = await Promise.all([
      tx.order.update({ where: { id: created.id }, data: { orderNumber } }),
      tx.orderItem.createMany({
        data: pricedItems.map((item) => ({
          orderId: created.id,
          productId: item.productId,
          variantId: item.variantId,
          productNameSnapshot: item.product.name,
          productSlugSnapshot: item.product.slug,
          skuSnapshot: item.product.sku,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
          productTypeSnapshot: item.productType,
          imageSnapshot: item.product.image,
          variantNameSnapshot: item.variant?.name ?? null,
          variantSkuSnapshot: item.variant?.sku ?? null,
          variantAttributesSnapshot: item.variant?.attributes ?? undefined,
          variantPriceSnapshot: item.variant ? item.unitPrice : null,
        })),
      }),
      tx.orderAddress.create({
        data: {
          orderId: created.id,
          fullName: shippingAddress.fullName,
          phone: shippingAddress.phone,
          addressLine1: shippingAddress.addressLine1,
          addressLine2: shippingAddress.addressLine2 || null,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country || "India",
        },
      }),
      tx.payment.create({
        data: {
          orderId: created.id,
          provider: "razorpay",
          status: "PENDING",
          amount: totals.total,
          currency: totals.currency,
        },
      }),
    ]);

    return updated;
  });

  return { order, accessToken: rawToken };
}

export async function getOrderForConfirmation(orderNumber, token) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: ADMIN_INCLUDE,
  });
  if (!order) throw ApiError.notFound("Order not found");

  const providedHash = hashToken(token);
  if (!safeCompareHex(providedHash, order.accessTokenHash)) {
    // Same response as "not found" — never confirm an order number is real
    // to a caller who doesn't already hold its token.
    throw ApiError.notFound("Order not found");
  }

  return sanitizeOrder(order);
}

export async function trackOrder({ orderNumber, email }) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: ADMIN_INCLUDE,
  });

  // Deliberately generic: whether the order number doesn't exist or the
  // email doesn't match it, the caller gets the same message either way.
  if (!order || order.customerEmail.toLowerCase() !== email.toLowerCase()) {
    throw ApiError.notFound("No matching order was found. Check your order number and email and try again.");
  }

  return sanitizeOrder(order);
}

export async function listAdminOrders({ page, limit, status, paymentStatus, search }) {
  const where = {
    ...(status ? { status } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: "insensitive" } },
            { customerEmail: { contains: search, mode: "insensitive" } },
            { customerPhone: { contains: search, mode: "insensitive" } },
            { customerName: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items: items.map(sanitizeOrder),
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

export async function getAdminOrderById(id) {
  const order = await prisma.order.findUnique({ where: { id }, include: ADMIN_INCLUDE });
  if (!order) throw ApiError.notFound("Order not found");
  return sanitizeOrder(order);
}

const TERMINAL_STATUSES = new Set(["CANCELLED", "DELIVERED"]);

// Operational status only — paymentStatus is never writable here, so the
// admin UI has no path to "mark PAID" outside the real payment workflow.
export async function updateOrderStatus(id, nextStatus) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw ApiError.notFound("Order not found");

  if (TERMINAL_STATUSES.has(order.status)) {
    throw ApiError.conflict(`This order is already ${order.status.toLowerCase()} and cannot be changed further.`);
  }

  const data = { status: nextStatus };
  if (nextStatus === "CANCELLED") data.cancelledAt = new Date();

  const updated = await prisma.order.update({ where: { id }, data, include: ADMIN_INCLUDE });
  return sanitizeOrder(updated);
}

export async function getOrderDashboardStats() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalOrders, pendingOrders, ordersToday, paidAgg] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.order.aggregate({ where: { paymentStatus: "PAID" }, _sum: { totalAmount: true } }),
  ]);

  return {
    totalOrders,
    pendingOrders,
    ordersToday,
    paidRevenue: Number(paidAgg._sum.totalAmount || 0),
  };
}
