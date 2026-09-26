import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";
import { rupeesToPaise } from "../../utils/money.js";
import { getRazorpayClient, isRazorpayConfigured } from "./razorpay.client.js";
import { sendOrderConfirmationEmail } from "../email/email.service.js";

// POST /api/orders/:orderId/payment — creates (or reuses) the Razorpay order
// for an internal order. Idempotent: calling it twice for the same pending
// order returns the same provider order id instead of creating a second one.
export async function createRazorpayOrderForOrder(orderId) {
  const paymentSettingRow = await prisma.siteSetting.findUnique({ where: { key: "payments" } });
  if (paymentSettingRow?.value?.razorpayEnabled === false) {
    throw ApiError.badRequest("Online payment via Razorpay is currently disabled.");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) throw ApiError.notFound("Order not found");

  const payment = order.payments[0];
  if (!payment) throw ApiError.badRequest("This order has no payment record.");

  if (order.paymentStatus === "PAID") {
    throw ApiError.conflict("This order has already been paid.");
  }
  if (payment.providerOrderId) {
    // Already has a live provider order — reuse it rather than mint another.
    return buildCheckoutOptions(order, payment);
  }

  if (!isRazorpayConfigured()) {
    throw ApiError.badRequest(
      "Payments are not configured on this server yet (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET missing)."
    );
  }

  const razorpay = getRazorpayClient();
  const amountPaise = rupeesToPaise(order.totalAmount);
  const providerOrder = await razorpay.orders.create({
    amount: amountPaise,
    currency: order.currency,
    receipt: order.orderNumber,
    notes: { orderId: order.id, orderNumber: order.orderNumber },
  });

  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: { providerOrderId: providerOrder.id },
  });

  return buildCheckoutOptions(order, updatedPayment);
}

function buildCheckoutOptions(order, payment) {
  return {
    keyId: env.razorpay.keyId,
    razorpayOrderId: payment.providerOrderId,
    amount: rupeesToPaise(order.totalAmount),
    currency: order.currency,
    orderNumber: order.orderNumber,
    name: "Aadya Society",
    description: `Aadya Society Order ${order.orderNumber}`,
    prefill: {
      name: order.customerName,
      email: order.customerEmail,
      contact: order.customerPhone,
    },
  };
}

export function verifyRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const expected = crypto
    .createHmac("sha256", env.razorpay.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return (
    expected.length === razorpaySignature.length &&
    crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(razorpaySignature, "hex"))
  );
}

export function verifyRazorpayWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const expected = crypto.createHmac("sha256", env.razorpay.webhookSecret).update(rawBody).digest("hex");
  if (expected.length !== signatureHeader.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signatureHeader, "hex"));
}

// The single idempotent path from "payment succeeded" to "order confirmed".
// Both the client-facing verify endpoint and the Razorpay webhook call this
// — whichever arrives first wins, the other becomes a safe no-op. The
// compare-and-swap is the `updateMany` with `status: { not: "PAID" }` below,
// which takes its row lock atomically inside the transaction.
export async function finalizePaidPayment({ providerOrderId, providerPaymentId, method, rawReference }) {
  const payment = await prisma.payment.findFirst({ where: { providerOrderId } });
  if (!payment) throw ApiError.notFound("No order matches this payment.");

  const result = await prisma.$transaction(async (tx) => {
    const cas = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: { status: "PAID", providerPaymentId, method: method || null, rawReference: rawReference || null },
    });

    if (cas.count === 0) {
      // Already finalized by a previous verify/webhook call — no-op.
      return { alreadyProcessed: true, order: await tx.order.findUnique({ where: { id: payment.orderId } }) };
    }

    const order = await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: "PAID", status: "CONFIRMED", paidAt: new Date() },
      include: { items: true, address: true },
    });

    // Variant stock is authoritative for variant lines; base-product stock is
    // authoritative only for non-variant lines. Each conditional update is an
    // atomic non-negative check, so a payment never creates negative stock.
    for (const item of order.items) {
      if (item.variantId) {
        const changed = await tx.productVariant.updateMany({ where: { id: item.variantId, stockQuantity: { gte: item.quantity } }, data: { stockQuantity: { decrement: item.quantity } } });
        if (!changed.count) throw ApiError.conflict("Variant stock changed before payment could be finalized.");
      } else if (item.productId) {
        const product = await tx.product.findUnique({ where: { id: item.productId }, select: { trackInventory: true } });
        if (!product?.trackInventory) continue;
        const changed = await tx.product.updateMany({ where: { id: item.productId, trackInventory: true, stockQuantity: { gte: item.quantity } }, data: { stockQuantity: { decrement: item.quantity } } });
        if (!changed.count) throw ApiError.conflict("Product stock changed before payment could be finalized.");
      }
    }

    if (order.couponCode) {
      const coupon = await tx.coupon.findUnique({ where: { code: order.couponCode } });
      if (coupon) {
        const existingRedemption = await tx.couponRedemption.findUnique({ where: { orderId: order.id } });
        if (!existingRedemption) {
          await tx.couponRedemption.create({
            data: {
              couponId: coupon.id,
              customerId: order.customerId || null,
              customerEmail: order.customerEmail,
              orderId: order.id,
              discountAmount: order.discountAmount,
            },
          });
          await tx.coupon.update({
            where: { id: coupon.id },
            data: { usageCount: { increment: 1 } },
          });
        }
      }
    }

    return { alreadyProcessed: false, order };
  });

  if (!result.alreadyProcessed) {
    // Email is best-effort and must never affect payment/order state.
    sendOrderConfirmationEmail(result.order.id).catch(() => {});
  }

  return result;
}

export async function markPaymentFailed({ providerOrderId }) {
  const payment = await prisma.payment.findFirst({ where: { providerOrderId } });
  if (!payment) return { found: false };
  if (payment.status === "PAID") return { found: true, noop: true }; // never downgrade a paid payment

  await prisma.$transaction([
    prisma.payment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: { status: "FAILED" },
    }),
    prisma.order.updateMany({
      where: { id: payment.orderId, paymentStatus: { not: "PAID" } },
      data: { paymentStatus: "FAILED" },
    }),
  ]);

  return { found: true, noop: false };
}
