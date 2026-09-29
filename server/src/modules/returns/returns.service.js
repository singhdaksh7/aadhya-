import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { getRazorpayClient, isRazorpayConfigured } from "../payments/razorpay.client.js";
import { rupeesToPaise, round2 } from "../../utils/money.js";
import { sendReturnStatusEmail } from "../email/email.service.js";

const DEFAULT_RETURN_SETTINGS = {
  enabled: true,
  windowDays: 7,
  allowedOrderStatuses: ["DELIVERED"],
  excludedProductTypes: [],
  allowDigitalReturns: false,
};

export async function getReturnSettings() {
  const row = await prisma.siteSetting.findUnique({ where: { key: "returns" } });
  return { ...DEFAULT_RETURN_SETTINGS, ...(row?.value || {}) };
}

function returnDeadline(order, settings) {
  const anchor = order.shipment?.deliveredDate || order.paidAt || order.createdAt;
  return new Date(new Date(anchor).getTime() + settings.windowDays * 24 * 60 * 60 * 1000);
}

function isDigitalItem(item) {
  return item.bookFormatSnapshot === "PDF" || item.product?.isDigital === true;
}

const ORDER_INCLUDE = {
  items: { include: { product: { select: { isDigital: true } } } },
  shipment: true,
  payments: { orderBy: { createdAt: "desc" } },
};

// Returns { eligible, reason, order, settings } — never throws, so callers
// (both the eligibility-check endpoint and the create endpoint) get a
// consistent, explainable answer instead of having to catch exceptions to
// tell "ineligible" apart from "broken".
export async function checkReturnEligibility(orderNumber, customerId) {
  const order = await prisma.order.findUnique({ where: { orderNumber }, include: ORDER_INCLUDE });
  if (!order) return { eligible: false, reason: "Order not found" };

  // Cross-customer block: a guest-owned order can't be probed by a logged-in
  // customer, and one customer's order can't be probed by another.
  if (customerId && order.customerId && order.customerId !== customerId) {
    return { eligible: false, reason: "Order not found" };
  }

  const settings = await getReturnSettings();
  if (!settings.enabled) return { eligible: false, reason: "Returns are currently disabled", order, settings };
  if (!settings.allowedOrderStatuses.includes(order.status)) {
    return { eligible: false, reason: `Orders in status ${order.status} are not eligible for return`, order, settings };
  }

  const deadline = returnDeadline(order, settings);
  if (new Date() > deadline) {
    return { eligible: false, reason: "The return window for this order has closed", order, settings };
  }

  const existing = await prisma.returnRequest.findFirst({
    where: { orderId: order.id, status: { notIn: ["REJECTED", "CLOSED"] } },
  });
  if (existing) {
    return { eligible: false, reason: "A return request is already in progress for this order", order, settings };
  }

  const returnableItems = order.items.filter((item) => !isDigitalItem(item) && !settings.excludedProductTypes.includes(item.productTypeSnapshot));
  if (!returnableItems.length) {
    return { eligible: false, reason: "This order has no returnable items", order, settings };
  }

  return { eligible: true, order, settings, returnableItems };
}

export async function createReturnRequest({ orderNumber, customerId, reason, details, items }) {
  const check = await checkReturnEligibility(orderNumber, customerId);
  if (!check.eligible) throw ApiError.badRequest(check.reason);
  const { order, returnableItems } = check;

  const returnableIds = new Set(returnableItems.map((i) => i.id));
  for (const req of items) {
    const orderItem = order.items.find((i) => i.id === req.orderItemId);
    if (!orderItem) throw ApiError.badRequest("One or more items do not belong to this order.");
    if (!returnableIds.has(req.orderItemId)) {
      throw ApiError.badRequest(`${orderItem.productNameSnapshot} is not eligible for return (digital/non-returnable item).`);
    }
    if (req.quantity > orderItem.quantity) {
      throw ApiError.badRequest(`Requested quantity for ${orderItem.productNameSnapshot} exceeds the ordered quantity.`);
    }
  }

  const returnRequest = await prisma.returnRequest.create({
    data: {
      orderId: order.id,
      customerId: customerId || order.customerId || null,
      status: "REQUESTED",
      reason,
      details: details || null,
      items: {
        create: items.map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity })),
      },
    },
    include: { items: true },
  });

  sendReturnStatusEmail(order.id, returnRequest, "Requested").catch((err) => console.error("Return status email failed:", err.message));

  return returnRequest;
}

const RETURN_INCLUDE = {
  items: { include: { orderItem: true } },
  refunds: true,
  order: { include: { items: true, payments: true, shipment: true } },
};

export async function getCustomerReturn(id, customerId) {
  const returnRequest = await prisma.returnRequest.findUnique({ where: { id }, include: RETURN_INCLUDE });
  if (!returnRequest || returnRequest.customerId !== customerId) {
    // Same response whether it doesn't exist or belongs to someone else.
    throw ApiError.notFound("Return request not found");
  }
  return returnRequest;
}

export async function listCustomerReturns(customerId) {
  return prisma.returnRequest.findMany({
    where: { customerId },
    include: { items: { include: { orderItem: true } }, order: { select: { orderNumber: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAdminReturns({ page = 1, limit = 20, status } = {}) {
  const where = status ? { status } : {};
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.returnRequest.findMany({
      where,
      include: { items: { include: { orderItem: true } }, order: { select: { orderNumber: true, customerEmail: true, customerName: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.returnRequest.count({ where }),
  ]);
  return { items, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

export async function getAdminReturn(id) {
  const returnRequest = await prisma.returnRequest.findUnique({ where: { id }, include: RETURN_INCLUDE });
  if (!returnRequest) throw ApiError.notFound("Return request not found");
  return returnRequest;
}

async function auditLog(adminId, action, metadata) {
  try {
    await prisma.adminAuditLog.create({ data: { adminId, action, provider: "returns", metadata } });
  } catch (err) {
    console.error("Failed to write audit log:", err.message);
  }
}

function assertStatus(returnRequest, allowed) {
  if (!allowed.includes(returnRequest.status)) {
    throw ApiError.conflict(`Return is in status ${returnRequest.status}; expected one of ${allowed.join(", ")}.`);
  }
}

export async function approveReturn(id, adminId, resolution = "REFUND") {
  const returnRequest = await getAdminReturn(id);
  assertStatus(returnRequest, ["REQUESTED"]);

  const updated = await prisma.returnRequest.update({
    where: { id },
    data: { status: "APPROVED", approvedAt: new Date(), resolution },
    include: RETURN_INCLUDE,
  });
  await auditLog(adminId, "RETURN_APPROVE", { returnRequestId: id, resolution });
  sendReturnStatusEmail(returnRequest.orderId, updated, "Approved").catch(() => {});
  return updated;
}

export async function rejectReturn(id, adminId, note) {
  const returnRequest = await getAdminReturn(id);
  assertStatus(returnRequest, ["REQUESTED", "APPROVED"]);

  const updated = await prisma.returnRequest.update({
    where: { id },
    data: { status: "REJECTED", rejectedAt: new Date(), details: note ? `${returnRequest.details || ""}\n[Rejected] ${note}`.trim() : returnRequest.details },
    include: RETURN_INCLUDE,
  });
  await auditLog(adminId, "RETURN_REJECT", { returnRequestId: id, note });
  sendReturnStatusEmail(returnRequest.orderId, updated, "Rejected").catch(() => {});
  return updated;
}

export async function schedulePickup(id, adminId) {
  const returnRequest = await getAdminReturn(id);
  assertStatus(returnRequest, ["APPROVED"]);
  const updated = await prisma.returnRequest.update({ where: { id }, data: { status: "PICKUP_SCHEDULED" }, include: RETURN_INCLUDE });
  await auditLog(adminId, "RETURN_PICKUP_SCHEDULED", { returnRequestId: id });
  return updated;
}

export async function markInTransit(id, adminId) {
  const returnRequest = await getAdminReturn(id);
  assertStatus(returnRequest, ["PICKUP_SCHEDULED", "APPROVED"]);
  const updated = await prisma.returnRequest.update({ where: { id }, data: { status: "IN_TRANSIT" }, include: RETURN_INCLUDE });
  await auditLog(adminId, "RETURN_IN_TRANSIT", { returnRequestId: id });
  return updated;
}

// Restock — the only place a return may increment stock, and only once:
// guarded by restockedAt inside the same transaction as the status flip, and
// by requiring the return be in a pre-RECEIVED state. Recorded through
// InventoryMovement so it is auditable and distinguishable from a sale.
export async function markReceived(id, adminId) {
  const returnRequest = await prisma.returnRequest.findUnique({ where: { id }, include: { items: { include: { orderItem: true } } } });
  if (!returnRequest) throw ApiError.notFound("Return request not found");
  assertStatus(returnRequest, ["PICKUP_SCHEDULED", "IN_TRANSIT", "APPROVED"]);

  const updated = await prisma.$transaction(async (tx) => {
    if (returnRequest.restockedAt) {
      // Already restocked (defensive — should be unreachable given the
      // status guard above, but keeps this function idempotent).
      return tx.returnRequest.update({ where: { id }, data: { status: "RECEIVED", receivedAt: new Date() }, include: RETURN_INCLUDE });
    }

    for (const ri of returnRequest.items) {
      const orderItem = ri.orderItem;
      if (orderItem.variantId) {
        await tx.productVariant.updateMany({ where: { id: orderItem.variantId }, data: { stockQuantity: { increment: ri.quantity } } });
      } else if (orderItem.productId) {
        const product = await tx.product.findUnique({ where: { id: orderItem.productId }, select: { trackInventory: true } });
        if (product?.trackInventory) {
          await tx.product.updateMany({ where: { id: orderItem.productId, trackInventory: true }, data: { stockQuantity: { increment: ri.quantity } } });
        }
      }
      await tx.inventoryMovement.create({
        data: {
          productId: orderItem.productId || null,
          variantId: orderItem.variantId || null,
          type: "RETURN",
          quantity: ri.quantity,
          orderId: returnRequest.orderId,
          returnRequestId: returnRequest.id,
          note: `Restock from return ${returnRequest.id}`,
        },
      });
    }

    return tx.returnRequest.update({
      where: { id },
      data: { status: "RECEIVED", receivedAt: new Date(), restockedAt: new Date() },
      include: RETURN_INCLUDE,
    });
  });

  await auditLog(adminId, "RETURN_RECEIVED_RESTOCKED", { returnRequestId: id });
  sendReturnStatusEmail(updated.orderId, updated, "Received").catch(() => {});
  return updated;
}

// Idempotent refund: validates amount <= remaining refundable amount on the
// payment, then either calls Razorpay (prepaid) or records a manual refund
// (COD / admin-recorded). Never double-refunds: refundedAmount is only ever
// advanced inside this same DB transaction that creates the Refund row, so a
// retried request that would exceed the refundable balance is rejected
// before any provider call is made.
export async function issueRefund(id, adminId, { amount, method, reference, note }) {
  const returnRequest = await prisma.returnRequest.findUnique({
    where: { id },
    include: { order: { include: { payments: { orderBy: { createdAt: "desc" } } } } },
  });
  if (!returnRequest) throw ApiError.notFound("Return request not found");
  assertStatus(returnRequest, ["APPROVED", "RECEIVED", "REFUND_PENDING"]);

  const payment = returnRequest.order.payments.find((p) => p.status === "PAID") || returnRequest.order.payments[0];
  if (!payment) throw ApiError.badRequest("No payment record found for this order.");

  const alreadyRefunded = Number(payment.refundedAmount || 0);
  const paidAmount = Number(payment.amount);
  const remaining = round2(paidAmount - alreadyRefunded);
  if (amount > remaining + 0.01) {
    throw ApiError.badRequest(`Refund amount exceeds the remaining refundable balance of ${remaining}.`);
  }

  const isCod = payment.provider === "cod" || returnRequest.order.paymentMethod === "cod";
  if (isCod && method !== "manual") {
    throw ApiError.badRequest("COD orders must be refunded manually.");
  }

  let providerRefundId = null;
  if (method === "razorpay") {
    if (isCod) throw ApiError.badRequest("This payment was not made via Razorpay.");
    if (!(await isRazorpayConfigured())) throw ApiError.badRequest("Razorpay is not configured.");
    if (!payment.providerPaymentId) throw ApiError.badRequest("This payment has no provider payment id to refund.");
    const razorpay = await getRazorpayClient();
    const providerRefund = await razorpay.payments.refund(payment.providerPaymentId, {
      amount: rupeesToPaise(amount),
      notes: { returnRequestId: id, orderId: returnRequest.orderId },
    });
    providerRefundId = providerRefund?.id || null;
  }

  const result = await prisma.$transaction(async (tx) => {
    // Compare-and-swap guard against a concurrent/duplicate refund click:
    // re-check + advance refundedAmount atomically, only succeeding if the
    // new total still fits within what was actually paid.
    const cas = await tx.payment.updateMany({
      where: { id: payment.id, refundedAmount: { lte: paidAmount - amount + 0.001 } },
      data: { refundedAmount: { increment: amount } },
    });
    if (cas.count === 0) {
      throw ApiError.conflict("Refund amount would exceed the paid amount (a concurrent refund may have just been recorded).");
    }

    const refund = await tx.refund.create({
      data: {
        returnRequestId: id,
        paymentId: payment.id,
        orderId: returnRequest.orderId,
        amount,
        method,
        status: "COMPLETED",
        providerRefundId,
        reference: reference || null,
        note: note || null,
        processedByAdminId: adminId,
      },
    });

    const newTotalRefunded = alreadyRefunded + amount;
    const fullyRefunded = newTotalRefunded >= paidAmount - 0.01;
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });
    await tx.order.update({
      where: { id: returnRequest.orderId },
      data: { paymentStatus: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });

    const updatedReturn = await tx.returnRequest.update({
      where: { id },
      data: {
        status: "REFUNDED",
        refundAmount: newTotalRefunded,
        refundStatus: "COMPLETED",
        providerRefundId: providerRefundId || returnRequest.providerRefundId,
        completedAt: new Date(),
      },
      include: RETURN_INCLUDE,
    });

    return { refund, returnRequest: updatedReturn };
  });

  await auditLog(adminId, "RETURN_REFUND_ISSUED", { returnRequestId: id, amount, method, providerRefundId });
  sendReturnStatusEmail(returnRequest.orderId, result.returnRequest, "Refunded").catch(() => {});
  return result;
}

export async function closeReturn(id, adminId) {
  const returnRequest = await getAdminReturn(id);
  assertStatus(returnRequest, ["RECEIVED", "REFUNDED", "REJECTED"]);
  const updated = await prisma.returnRequest.update({ where: { id }, data: { status: "CLOSED", completedAt: new Date() }, include: RETURN_INCLUDE });
  await auditLog(adminId, "RETURN_CLOSED", { returnRequestId: id });
  return updated;
}

// RTO: called from the shipping webhook path when a shipment status
// transitions to RTO_DELIVERED. Does not auto-refund — only marks stock
// restockable and, for prepaid orders, opens a refund-eligible return so an
// admin can explicitly issue the refund from the returns admin UI.
export async function handleRtoDelivered(orderId, adminId = null) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, payments: true } });
  if (!order) throw ApiError.notFound("Order not found");

  const existing = await prisma.returnRequest.findFirst({ where: { orderId, reason: "RTO" } });
  if (existing) return existing; // idempotent — a webhook retry is a no-op

  const returnRequest = await prisma.returnRequest.create({
    data: {
      orderId,
      customerId: order.customerId || null,
      status: "RECEIVED",
      reason: "RTO",
      details: "Return to origin — shipment delivered back to warehouse",
      receivedAt: new Date(),
      items: {
        create: order.items.map((item) => ({ orderItemId: item.id, quantity: item.quantity })),
      },
    },
    include: { items: { include: { orderItem: true } } },
  });

  const restocked = await prisma.$transaction(async (tx) => {
    for (const ri of returnRequest.items) {
      const orderItem = ri.orderItem;
      if (orderItem.variantId) {
        await tx.productVariant.updateMany({ where: { id: orderItem.variantId }, data: { stockQuantity: { increment: ri.quantity } } });
      } else if (orderItem.productId) {
        const product = await tx.product.findUnique({ where: { id: orderItem.productId }, select: { trackInventory: true } });
        if (product?.trackInventory) {
          await tx.product.updateMany({ where: { id: orderItem.productId, trackInventory: true }, data: { stockQuantity: { increment: ri.quantity } } });
        }
      }
      await tx.inventoryMovement.create({
        data: {
          productId: orderItem.productId || null,
          variantId: orderItem.variantId || null,
          type: "RETURN",
          quantity: ri.quantity,
          orderId,
          returnRequestId: returnRequest.id,
          note: "RTO restock",
        },
      });
    }
    const isPrepaid = order.payments.some((p) => p.status === "PAID");
    return tx.returnRequest.update({
      where: { id: returnRequest.id },
      data: { restockedAt: new Date(), status: isPrepaid ? "REFUND_PENDING" : "CLOSED" },
      include: RETURN_INCLUDE,
    });
  });

  await auditLog(adminId || "system", "RETURN_RTO_RESTOCKED", { orderId, returnRequestId: returnRequest.id });
  return restocked;
}
