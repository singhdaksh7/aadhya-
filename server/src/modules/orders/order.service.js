import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { priceCartItemsOrThrow, computeTotals, isDigitalOnly } from "./checkout.service.js";
import { generateToken, hashToken, safeCompareHex } from "../../utils/secureToken.js";
import { assertTransition } from "./orderStatus.js";
import { assertCodEligible } from "../shipping/shipping.service.js";
import { decrementStockForOrder, restoreStockForOrder, runPendingLowStockChecks } from "./stock.js";
import { round2 } from "../../utils/money.js";
import crypto from "node:crypto";
import { ensureInvoiceForOrder } from "../invoices/invoice.service.js";
import { sendInvoiceEmail } from "../email/email.service.js";
import { getShippingProvider } from "../shipping/provider.service.js";
import { attemptAutomaticShipment } from "../shipping/fulfilment.service.js";

const ADMIN_INCLUDE = {
  items: true,
  address: true,
  billingAddress: true,
  payments: { orderBy: { createdAt: "desc" } },
  statusHistory: { orderBy: { changedAt: "asc" } },
  shipment: true,
  invoice: true,
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
export async function createOrder({
  customer,
  shippingAddress,
  billingAddress,
  billingSameAsShipping = true,
  items,
  notes,
  couponCode,
  customerId,
  savedAddressId,
  billingSavedAddressId,
  paymentMethod = "razorpay",
  utmSource,
  utmMedium,
  utmCampaign,
  utmContent,
  utmTerm,
}) {
  const paymentSettingRow = await prisma.siteSetting.findUnique({ where: { key: "payments" } });
  const paymentSettings = paymentSettingRow?.value || {};
  const razorpayEnabled = paymentSettings.razorpayEnabled ?? true;
  const codEnabled = paymentSettings.codEnabled ?? true;

  if (!razorpayEnabled && !codEnabled) {
    throw ApiError.badRequest("No payment methods are currently available for checkout.");
  }
  if (paymentMethod === "cod" && !codEnabled) {
    throw ApiError.badRequest("Cash on Delivery is currently disabled.");
  }
  if (paymentMethod === "razorpay" && !razorpayEnabled) {
    throw ApiError.badRequest("Online payment via Razorpay is currently disabled.");
  }

  const pricedItems = await priceCartItemsOrThrow(items);
  const digitalOnly = isDigitalOnly(pricedItems);

  // Mixed/physical carts still require a real address; a PDF-only cart has
  // nothing to ship, so no address (shipping or billing) is collected or
  // persisted for it.
  let resolvedBillingAddress = null;
  if (!digitalOnly) {
    if (savedAddressId) {
      if (!customerId) throw ApiError.forbidden("Sign in to use a saved address.");
      const address = await prisma.address.findFirst({ where: { id: savedAddressId, customerId } });
      if (!address) throw ApiError.notFound("Address not found");
      shippingAddress = address;
    }
    if (!shippingAddress) throw ApiError.badRequest("A shipping address is required for this order.");

    if (!billingSameAsShipping) {
      if (billingSavedAddressId) {
        if (!customerId) throw ApiError.forbidden("Sign in to use a saved address.");
        const address = await prisma.address.findFirst({ where: { id: billingSavedAddressId, customerId } });
        if (!address) throw ApiError.notFound("Billing address not found");
        resolvedBillingAddress = address;
      } else if (billingAddress) {
        resolvedBillingAddress = billingAddress;
      } else {
        throw ApiError.badRequest("Provide a billing address or set billing same as shipping.");
      }
    }
    if (billingSameAsShipping) resolvedBillingAddress = shippingAddress;
  }

  let couponDiscount = 0;
  let validatedCouponCode = null;

  if (couponCode) {
    const { validateCoupon } = await import("../coupons/coupon.service.js");
    const couponResult = await validateCoupon({
      code: couponCode,
      customerId,
      customerEmail: customer.email,
      items,
    });
    couponDiscount = couponResult.discountAmount;
    validatedCouponCode = couponResult.code;
  }

  const totals = await computeTotals(
    pricedItems,
    couponDiscount,
    digitalOnly ? null : { state: shippingAddress.state, postalCode: shippingAddress.postalCode }
  );

  let codFee = 0;
  if (paymentMethod === "cod") {
    // A PDF-only cart has nothing to ship and no address to resolve a
    // shipping zone from, so it's never COD-eligible — reject it outright
    // rather than falling through to assertCodEligible, which needs a
    // real address. (Also covered defense-in-depth by shipping.service's
    // own per-item isDigital check for mixed carts.)
    if (digitalOnly) {
      throw ApiError.badRequest("Cash on Delivery is not available for digital (PDF) orders.");
    }
    // Every COD rejection reason lives in shipping.service — the client
    // can never smuggle a COD order past digital items, min/max value, a
    // disabled COD flag, or an unsupported shipping zone.
    const codCheck = await assertCodEligible({
      items: pricedItems.filter((i) => i.ok),
      totalAmount: totals.total,
      state: shippingAddress.state,
      postalCode: shippingAddress.postalCode,
    });
    codFee = codCheck.codFee || 0;
  }

  const grandTotal = round2(totals.total + codFee);
  if (grandTotal <= 0) {
    throw ApiError.badRequest("Order total must be greater than zero.");
  }

  const rawToken = generateToken();
  const accessTokenHash = hashToken(rawToken);

  let pendingLowStockChecks = [];
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: `PENDING-${crypto.randomUUID()}`, // placeholder, overwritten below once orderSeq exists
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        customerAlternatePhone: customer.alternatePhone || null,
        customerId: customerId || null,
        subtotal: totals.subtotal,
        shippingAmount: totals.shipping,
        discountAmount: totals.discount,
        taxAmount: totals.tax,
        totalAmount: grandTotal,
        currency: totals.currency,
        couponCode: validatedCouponCode,
        notes: notes || null,
        accessTokenHash,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        utmContent: utmContent || null,
        utmTerm: utmTerm || null,
        paymentMethod,
        codFeeAmount: codFee,
        shippingZoneId: totals.shippingZoneId,
        billingSameAsShipping,
        // COD orders skip the online-payment step entirely, so they go
        // straight to CONFIRMED; Razorpay orders wait in PENDING until the
        // signature/webhook path finalizes them (payment.service.js).
        status: paymentMethod === "cod" ? "CONFIRMED" : "PENDING",
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
          bookFormatSnapshot: item.bookFormat ?? null,
          bookFormatSkuSnapshot: item.bookFormatSku ?? null,
          bookFormatPriceSnapshot: item.bookFormat ? item.unitPrice : null,
          bookFormatPdfNameSnapshot: item.bookFormatPdfName ?? null,
        })),
      }),
      ...(digitalOnly
        ? []
        : [
            tx.orderAddress.create({
              data: {
                orderId: created.id,
                fullName: shippingAddress.fullName,
                phone: shippingAddress.phone,
                alternatePhone: shippingAddress.alternatePhone || null,
                email: shippingAddress.email || customer.email,
                landmark: shippingAddress.landmark || null,
                addressLine1: shippingAddress.addressLine1,
                addressLine2: shippingAddress.addressLine2 || null,
                city: shippingAddress.city,
                state: shippingAddress.state,
                postalCode: shippingAddress.postalCode,
                country: shippingAddress.country || "India",
              },
            }),
            resolvedBillingAddress
              ? tx.orderBillingAddress.create({
                  data: {
                    orderId: created.id,
                    fullName: resolvedBillingAddress.fullName,
                    phone: resolvedBillingAddress.phone,
                    alternatePhone: resolvedBillingAddress.alternatePhone || null,
                    email: resolvedBillingAddress.email || customer.email,
                    landmark: resolvedBillingAddress.landmark || null,
                    addressLine1: resolvedBillingAddress.addressLine1,
                    addressLine2: resolvedBillingAddress.addressLine2 || null,
                    city: resolvedBillingAddress.city,
                    state: resolvedBillingAddress.state,
                    postalCode: resolvedBillingAddress.postalCode,
                    country: resolvedBillingAddress.country || "India",
                  },
                })
              : Promise.resolve(null),
          ]),
      tx.payment.create({
        data: {
          orderId: created.id,
          provider: paymentMethod === "cod" ? "cod" : "razorpay",
          status: "PENDING",
          amount: grandTotal,
          currency: totals.currency,
        },
      }),
      tx.orderStatusHistory.create({
        data: {
          orderId: created.id,
          fromStatus: null,
          toStatus: paymentMethod === "cod" ? "CONFIRMED" : "PENDING",
          note: paymentMethod === "cod" ? "COD order confirmed at checkout" : "Order created, awaiting payment",
        },
      }),
    ]);

    // COD orders have no online-payment finalize step to hang stock
    // decrement off of, so it happens here — once, guarded by the same
    // exactly-once helper used by the Razorpay payment path.
    if (paymentMethod === "cod") {
      const full = await tx.order.findUnique({ where: { id: updated.id }, include: { items: true } });
      if (!full.stockDecrementedAt) {
        pendingLowStockChecks = await decrementStockForOrder(tx, full);
      }
    }

    return updated;
  });

  if (pendingLowStockChecks.length) await runPendingLowStockChecks(pendingLowStockChecks);

  if (paymentMethod === "cod") {
    try {
      const invoice = await ensureInvoiceForOrder(order.id);
      if (invoice) sendInvoiceEmail(invoice.id).catch((err) => console.error("Invoice email failed:", err.message));
    } catch (err) {
      console.error("Invoice generation failed:", err.message);
    }
    // Awaited (not fire-and-forget) — see the matching call in
    // payment.service.js for why a detached promise here is unsafe.
    await attemptAutomaticShipment(order.id).catch((err) => console.error("Automatic shipment failed:", err.message));
  }
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
      include: {
        items: true,
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
        shipment: { select: { carrier: true, trackingNumber: true, status: true } },
        invoice: { select: { id: true, invoiceNumber: true, emailedAt: true } },
      },
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

// Operational status only — paymentStatus is never writable here, so the
// admin UI has no path to "mark PAID" outside the real payment workflow.
// Every transition is validated against orderStatus.js's state machine and
// recorded in OrderStatusHistory; cancelling restores stock exactly once.
export async function updateOrderStatus(id, nextStatus, note) {
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) throw ApiError.notFound("Order not found");

  assertTransition(order.status, nextStatus);

  const data = { status: nextStatus };
  if (nextStatus === "CANCELLED") data.cancelledAt = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.order.update({ where: { id }, data, include: ADMIN_INCLUDE });
    await tx.orderStatusHistory.create({
      data: { orderId: id, fromStatus: order.status, toStatus: nextStatus, note: note || null },
    });

    if (nextStatus === "CANCELLED" && order.stockDecrementedAt && !order.stockRestoredAt) {
      await restoreStockForOrder(tx, order);
    }

    return saved;
  });

  if (order.customerId && nextStatus !== order.status) {
    try {
      const existingNotif = await prisma.customerNotification.findFirst({
        where: {
          customerId: order.customerId,
          type: `ORDER_${nextStatus}`,
          link: `/account/orders/${order.orderNumber}`,
        },
      });
      if (!existingNotif) {
        await prisma.customerNotification.create({
          data: {
            customerId: order.customerId,
            type: `ORDER_${nextStatus}`,
            title: `Order ${nextStatus.charAt(0) + nextStatus.slice(1).toLowerCase()}`,
            message: `Your order ${order.orderNumber} is now ${nextStatus.toLowerCase()}.`,
            link: `/account/orders/${order.orderNumber}`,
          },
        });
      }
    } catch (err) {
      console.error("Failed to create customer notification for order status update:", err);
    }
  }

  if (updated.paymentMethod === "cod") {
    try {
      const invoice = await ensureInvoiceForOrder(updated.id);
      if (invoice) sendInvoiceEmail(invoice.id).catch((err) => console.error("Invoice email failed:", err.message));
    } catch (err) {
      console.error("Invoice generation failed:", err.message);
    }
  }

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

// Admin fulfilment: create or update tracking info for an order. Upsert
// rather than create-only, since the admin may add the carrier first and
// fill in the tracking number/estimated delivery afterwards.
export async function upsertShipment(orderId, data) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw ApiError.notFound("Order not found");

  const physicalItems = await prisma.orderItem.count({ where: { orderId, OR: [{ bookFormatSnapshot: null }, { NOT: { bookFormatSnapshot: "PDF" } }] } });
  if (!physicalItems) throw ApiError.badRequest("Digital-only orders cannot have a shipment.");
  const shipment = await prisma.shipment.upsert({
    where: { orderId },
    create: { orderId, ...data },
    update: data,
  });

  return shipment;
}

export async function createOrderShipment(orderId, data) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, address: true } });
  if (!order) throw ApiError.notFound("Order not found");
  if (!order.items.some((item) => item.bookFormatSnapshot !== "PDF")) throw ApiError.badRequest("Digital-only orders cannot have a shipment.");
  const setting = await prisma.siteSetting.findUnique({ where: { key: "shippingBusiness" } });
  const providerName = setting?.value?.provider || "MANUAL";
  try {
    const result = await getShippingProvider(providerName).createShipment({ order, input: data, settings: setting?.value || {} });
    return await prisma.shipment.upsert({ where: { orderId }, create: { orderId, ...result, shippedDate: data.shippedDate || null }, update: { ...result, shippedDate: data.shippedDate || undefined, lastError: null } });
  } catch (error) {
    await prisma.shipment.upsert({ where: { orderId }, create: { orderId, provider: providerName, status: "FAILED", lastError: "Shipment creation failed" }, update: { status: "FAILED", lastError: "Shipment creation failed" } });
    throw error;
  }
}
