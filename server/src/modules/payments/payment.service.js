import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { rupeesToPaise } from "../../utils/money.js";
import { getRazorpayClient, isRazorpayConfigured } from "./razorpay.client.js";
import { sendOrderConfirmationEmail } from "../email/email.service.js";
import { recordPurchaseEvent } from "../analytics/analytics.service.js";
import { decrementStockForOrder } from "../orders/stock.js";
import { ensureDigitalDownloadForOrderItem } from "../downloads/download.service.js";
import { ensureInvoiceForOrder } from "../invoices/invoice.service.js";
import { sendInvoiceEmail } from "../email/email.service.js";

// POST /api/orders/:orderId/payment — creates (or reuses) the Razorpay order
// for an internal order. Idempotent: calling it twice for the same pending
// order returns the same provider order id instead of creating a second one.
export async function createRazorpayOrderForOrder(orderId, requestingCustomerId) {
  const paymentSettingRow = await prisma.siteSetting.findUnique({ where: { key: "payments" } });
  if (paymentSettingRow?.value?.razorpayEnabled === false) {
    throw ApiError.badRequest("Online payment via Razorpay is currently disabled.");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) throw ApiError.notFound("Order not found");
  // If this order is tied to an account, only that account may initiate/
  // retry payment on it — otherwise a guessed/leaked order id would let
  // anyone mint Razorpay checkout options (and see order amount) for
  // someone else's order. Guest (no customerId) orders are unauthenticated
  // by design at this step since checkout itself is guest-accessible.
  if (order.customerId && order.customerId !== requestingCustomerId) {
    throw ApiError.notFound("Order not found");
  }

  const payment = order.payments[0];
  if (!payment) throw ApiError.badRequest("This order has no payment record.");

  if (order.paymentStatus === "PAID") {
    throw ApiError.conflict("This order has already been paid.");
  }
  if (payment.providerOrderId) {
    // Already has a live provider order — reuse it rather than mint another.
    return await buildCheckoutOptions(order, payment);
  }

  if (!(await isRazorpayConfigured())) {
    throw ApiError.badRequest(
      "Payments are not configured on this server yet (RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET missing)."
    );
  }

  const razorpay = await getRazorpayClient();
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

  return await buildCheckoutOptions(order, updatedPayment);
}

async function buildCheckoutOptions(order, payment) {
  const config = await (await import("./razorpay.client.js")).getRazorpayConfig();
  return {
    keyId: config?.keyId,
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

export async function verifyRazorpaySignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const config = await (await import("./razorpay.client.js")).getRazorpayConfig();
  if (!config?.keySecret) return false;
  const expected = crypto
    .createHmac("sha256", config.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return (
    expected.length === razorpaySignature.length &&
    crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(razorpaySignature, "hex"))
  );
}

export async function verifyRazorpayWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const config = await (await import("./razorpay.client.js")).getRazorpayConfig();
  if (!config?.webhookSecret) return false;
  const expected = crypto.createHmac("sha256", config.webhookSecret).update(rawBody).digest("hex");
  if (expected.length !== signatureHeader.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signatureHeader, "hex"));
}

// The single idempotent path from "payment succeeded" to "order confirmed".
// Both the client-facing verify endpoint and the Razorpay webhook call this
// — whichever arrives first wins, the other becomes a safe no-op. The
// compare-and-swap is the `updateMany` with `status: { not: "PAID" }` below,
// which takes its row lock atomically inside the transaction.
export async function finalizePaidPayment({ providerOrderId, providerPaymentId, method, rawReference, amountPaise }) {
  const payment = await prisma.payment.findFirst({ where: { providerOrderId } });
  if (!payment) throw ApiError.notFound("No order matches this payment.");

  // Server-authoritative amount check: if the caller (webhook payload or
  // verify request) supplied the amount actually paid, it must match the
  // amount we recorded when the Razorpay order was created. A mismatch
  // means the payment does not cover what the order actually costs, so it
  // is rejected rather than silently trusted.
  if (amountPaise != null && amountPaise !== rupeesToPaise(payment.amount)) {
    throw ApiError.badRequest("Paid amount does not match the order total.");
  }

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

    await tx.orderStatusHistory.create({
      data: { orderId: order.id, fromStatus: "PENDING", toStatus: "CONFIRMED", note: "Payment verified" },
    });

    // Variant stock is authoritative for variant lines; base-product stock is
    // authoritative only for non-variant lines. Each conditional update is an
    // atomic non-negative check, so a payment never creates negative stock.
    // Guarded by stockDecrementedAt so a webhook retry / duplicate verify
    // call (both funnel through the payment-status CAS above, but this is a
    // second independent guard) never decrements twice.
    if (!order.stockDecrementedAt) {
      await decrementStockForOrder(tx, order);
    }

    // Digital entitlements are created only here — inside the same
    // compare-and-swap transaction that only ever runs once per order
    // (the `cas.count === 0` branch above short-circuits before reaching
    // this point on a webhook/verify retry) — so this is idempotent too.
    for (const item of order.items) {
      await ensureDigitalDownloadForOrderItem(tx, item, order);
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
    // Email and analytics are best-effort and must never affect payment/order
    // state. This is the single, server-authoritative place a `purchase`
    // analytics event is ever recorded — it is never accepted from a client.
    sendOrderConfirmationEmail(result.order.id).catch(() => {});
    ensureInvoiceForOrder(result.order.id).then((invoice) => invoice && sendInvoiceEmail(invoice.id)).catch((err) => console.error("Invoice generation failed:", err.message));
    recordPurchaseEvent(result.order).catch(() => {});
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

// Lets a customer retry after a failed/abandoned payment: clears the old
// provider order id so createRazorpayOrderForOrder mints a fresh Razorpay
// order, and resets both payment and order back to PENDING. Refuses to
// touch anything that is already PAID.
export async function retryFailedPayment(orderId, requestingCustomerId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) throw ApiError.notFound("Order not found");
  if (order.customerId && order.customerId !== requestingCustomerId) {
    throw ApiError.notFound("Order not found");
  }
  if (order.paymentStatus === "PAID") throw ApiError.conflict("This order has already been paid.");

  const payment = order.payments[0];
  if (!payment) throw ApiError.badRequest("This order has no payment record.");

  await prisma.$transaction([
    prisma.payment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: { status: "PENDING", providerOrderId: null, providerPaymentId: null },
    }),
    prisma.order.updateMany({
      where: { id: orderId, paymentStatus: { not: "PAID" } },
      data: { paymentStatus: "PENDING" },
    }),
  ]);

  return createRazorpayOrderForOrder(orderId, requestingCustomerId);
}
