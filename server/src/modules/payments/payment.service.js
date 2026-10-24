import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";
import { rupeesToPaise } from "../../utils/money.js";
import {
  getCashfreeConfig,
  createCashfreeOrder,
  fetchCashfreeOrder,
  fetchCashfreePayments,
  CashfreeError,
  CHECKOUT_MODE,
} from "./cashfree.client.js";
import { sendOrderConfirmationEmail } from "../email/email.service.js";
import { ensureAccountForOrder } from "../customer-auth/guest-account.service.js";
import { recordPurchaseEvent } from "../analytics/analytics.service.js";
import { decrementStockForOrder, runPendingLowStockChecks } from "../orders/stock.js";
import { ensureDigitalDownloadForOrderItem } from "../downloads/download.service.js";
import { ensureInvoiceForOrder } from "../invoices/invoice.service.js";
import { sendInvoiceEmail } from "../email/email.service.js";
import { attemptAutomaticShipment } from "../shipping/fulfilment.service.js";

const ORDER_EXPIRY_MINUTES = 60;

// Cashfree needs a 10-digit mobile number. Real checkout data only: nothing is invented, and a
// missing/invalid number is reported to the customer instead of being papered over.
export function normalizeIndianPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  const national = digits.length > 10 && digits.startsWith("91") ? digits.slice(-10) : digits.replace(/^0+/, "");
  return /^\d{10}$/.test(national) ? national : null;
}

// Cashfree customer_id: 3-50 alphanumeric characters. Account holders use their account id; guests a
// stable hash of their email so repeat purchases map to the same Cashfree customer.
export function cashfreeCustomerId(order) {
  if (order.customerId) {
    const id = String(order.customerId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 50);
    if (id.length >= 3) return id;
  }
  return `guest${crypto.createHash("sha256").update(String(order.customerEmail || order.id).toLowerCase()).digest("hex").slice(0, 24)}`;
}

function sessionResponse(order, cfOrder, config) {
  return {
    provider: "cashfree",
    paymentSessionId: cfOrder.payment_session_id,
    cashfreeOrderId: cfOrder.order_id,
    mode: CHECKOUT_MODE[config.environment],
    environment: config.environment,
    orderNumber: order.orderNumber,
    amount: Number(order.totalAmount),
    currency: order.currency,
  };
}

// POST /api/orders/:orderId/payment — creates (or reuses) the Cashfree order for an internal order.
// The amount comes from the stored order total (computed server-side at checkout); the browser never
// supplies amount, currency or ownership. Idempotent: an order that already has a live Cashfree order
// gets the same payment session back instead of a second order.
export async function createCashfreeOrderForOrder(orderId, requestingCustomerId, { fresh = false } = {}) {
  const paymentSettingRow = await prisma.siteSetting.findUnique({ where: { key: "payments" } });
  if (paymentSettingRow?.value?.cashfreeEnabled === false) {
    throw ApiError.badRequest("Online payment is currently disabled.");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) throw ApiError.notFound("Order not found");
  // An order tied to an account can only have payment initiated/retried by that account.
  if (order.customerId && order.customerId !== requestingCustomerId) {
    throw ApiError.notFound("Order not found");
  }

  const payment = order.payments[0];
  if (!payment) throw ApiError.badRequest("This order has no payment record.");
  if (payment.provider === "cod") throw ApiError.badRequest("This is a Cash on Delivery order.");
  if (order.paymentStatus === "PAID") throw ApiError.conflict("This order has already been paid.");

  const config = await getCashfreeConfig();
  if (!config) {
    throw ApiError.badRequest("Online payment is not available right now. Please choose Cash on Delivery or try again later.");
  }

  if (payment.providerOrderId && !fresh) {
    let existing = null;
    try {
      existing = await fetchCashfreeOrder(config, payment.providerOrderId);
    } catch {
      existing = null; // missing/expired on Cashfree's side: create a fresh order below
    }
    if (existing?.order_status === "PAID") {
      await syncCashfreePayment(payment.providerOrderId);
      throw ApiError.conflict("This order has already been paid.");
    }
    if (existing?.order_status === "ACTIVE" && existing.payment_session_id) return sessionResponse(order, existing, config);
  }

  const phone = normalizeIndianPhone(order.customerPhone);
  if (!phone) throw ApiError.badRequest("A valid 10-digit mobile number is required for online payment. Please update your phone number.");

  const retrySuffix = payment.providerOrderId || fresh ? `-${Date.now().toString(36)}` : "";
  const cashfreeOrderId = `${order.orderNumber}${retrySuffix}`.slice(0, 45);
  const base = env.apiPublicUrl;
  const payload = {
    order_id: cashfreeOrderId,
    order_amount: Number(order.totalAmount),
    order_currency: order.currency || "INR",
    customer_details: {
      customer_id: cashfreeCustomerId(order),
      customer_phone: phone,
      ...(order.customerName ? { customer_name: String(order.customerName).slice(0, 100) } : {}),
      ...(order.customerEmail ? { customer_email: order.customerEmail } : {}),
    },
    order_meta: {
      return_url: `${env.frontendUrl.replace(/\/$/, "")}/payment/return?order_id={order_id}`,
      ...(base.startsWith("https://") ? { notify_url: `${base}/api/webhooks/cashfree` } : {}),
    },
    order_expiry_time: new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60_000).toISOString(),
    order_note: `Order ${order.orderNumber}`.slice(0, 200),
  };

  let cfOrder;
  try {
    cfOrder = await createCashfreeOrder(config, payload);
  } catch (err) {
    if (err instanceof CashfreeError && err.status === 409) {
      cfOrder = await fetchCashfreeOrder(config, cashfreeOrderId);
    } else if (err instanceof CashfreeError && err.status >= 400 && err.status < 500) {
      throw ApiError.badRequest(
        err.status === 401 || err.status === 403
          ? "Online payment is not available right now. Please try Cash on Delivery or contact us."
          : `Payment could not be started: ${err.message}`
      );
    } else {
      throw ApiError.badRequest("The payment provider is temporarily unavailable. Please retry in a moment.");
    }
  }

  const providerOrderId = cfOrder.order_id || cashfreeOrderId;
  await prisma.payment.updateMany({
    where: { id: payment.id, status: { not: "PAID" } },
    data: { provider: "cashfree", providerOrderId },
  });
  return sessionResponse(order, { ...cfOrder, order_id: providerOrderId }, config);
}

// Cashfree webhook signature: Base64( HMAC-SHA256( client secret, x-webhook-timestamp + rawBody ) ).
// The raw bytes must be used - re-serialising parsed JSON changes decimals and breaks the signature.
export function verifyCashfreeWebhookSignature(rawBody, timestamp, signature, secret) {
  if (!secret || !timestamp || typeof signature !== "string" || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(String(timestamp) + Buffer.from(rawBody).toString("utf8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Authoritative status check against Cashfree's API (never the browser's word, never a query param).
// Called by the customer verify endpoint and by verified webhooks; funnels into the single idempotent
// finalizePaidPayment. Returns { status, orderNumber } where status is PAID | PENDING | FAILED | EXPIRED.
export async function syncCashfreePayment(cashfreeOrderId) {
  const payment = await prisma.payment.findFirst({ where: { providerOrderId: cashfreeOrderId }, include: { order: true } });
  if (!payment) throw ApiError.notFound("No order matches this payment.");
  const orderNumber = payment.order.orderNumber;
  if (payment.status === "PAID") return { status: "PAID", orderNumber };

  const config = await getCashfreeConfig();
  if (!config) throw ApiError.badRequest("Online payment is not configured.");

  let cfOrder;
  try {
    cfOrder = await fetchCashfreeOrder(config, cashfreeOrderId);
  } catch (err) {
    if (err instanceof CashfreeError) {
      throw ApiError.badRequest("Could not confirm the payment with the provider. If money was deducted, contact us with your order number.");
    }
    throw err;
  }

  if (cfOrder.order_status === "PAID") {
    if (cfOrder.order_currency && cfOrder.order_currency !== payment.currency) throw ApiError.badRequest("Paid currency does not match the order.");
    const attempts = await fetchCashfreePayments(config, cashfreeOrderId).catch(() => []);
    const success = attempts.find((p) => p.payment_status === "SUCCESS");
    const cfPaymentId = success?.cf_payment_id != null ? String(success.cf_payment_id) : null;
    await finalizePaidPayment({
      providerOrderId: cashfreeOrderId,
      providerPaymentId: cfPaymentId,
      method: success?.payment_group || "cashfree",
      rawReference: cfPaymentId,
      amountPaise: rupeesToPaise(cfOrder.order_amount),
    });
    return { status: "PAID", orderNumber };
  }

  if (["EXPIRED", "TERMINATED", "TERMINATION_REQUESTED"].includes(cfOrder.order_status)) {
    await markPaymentFailed({ providerOrderId: cashfreeOrderId });
    return { status: "EXPIRED", orderNumber };
  }

  // ACTIVE: look at the individual attempts.
  const attempts = await fetchCashfreePayments(config, cashfreeOrderId).catch(() => []);
  if (attempts.some((p) => p.payment_status === "PENDING")) return { status: "PENDING", orderNumber };
  if (attempts.some((p) => ["FAILED", "USER_DROPPED", "CANCELLED", "VOID"].includes(p.payment_status))) {
    await markPaymentFailed({ providerOrderId: cashfreeOrderId });
    return { status: "FAILED", orderNumber };
  }
  return { status: "PENDING", orderNumber };
}

// The single idempotent path from "payment succeeded" to "order confirmed".
// Both the client-facing verify endpoint and the payment webhook call this
// — whichever arrives first wins, the other becomes a safe no-op. The
// compare-and-swap is the `updateMany` with `status: { not: "PAID" }` below,
// which takes its row lock atomically inside the transaction.
export async function finalizePaidPayment({ providerOrderId, providerPaymentId, method, rawReference, amountPaise }) {
  const payment = await prisma.payment.findFirst({ where: { providerOrderId } });
  if (!payment) throw ApiError.notFound("No order matches this payment.");

  // Server-authoritative amount check: if the caller (webhook payload or
  // verify request) supplied the amount actually paid, it must match the
  // amount we recorded when the payment order was created. A mismatch
  // means the payment does not cover what the order actually costs, so it
  // is rejected rather than silently trusted.
  if (amountPaise != null && amountPaise !== rupeesToPaise(payment.amount)) {
    throw ApiError.badRequest("Paid amount does not match the order total.");
  }

  let pendingLowStockChecks = [];
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
      pendingLowStockChecks = await decrementStockForOrder(tx, order);
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

  if (pendingLowStockChecks.length) await runPendingLowStockChecks(pendingLowStockChecks);

  if (!result.alreadyProcessed) {
    // Email and analytics are best-effort and must never affect payment/order
    // state. This is the single, server-authoritative place a `purchase`
    // analytics event is ever recorded — it is never accepted from a client.
    await ensureAccountForOrder(result.order.id).catch((err) => console.error("Guest account creation failed:", err.message));
    sendOrderConfirmationEmail(result.order.id).catch(() => {});
    try {
      const invoice = await ensureInvoiceForOrder(result.order.id);
      if (invoice) sendInvoiceEmail(invoice.id).catch((err) => console.error("Invoice email failed:", err.message));
    } catch (err) {
      console.error("Invoice generation failed:", err.message);
    }
    // Awaited (not fire-and-forget): this call itself is internally
    // idempotent, but leaving it undetached let a second caller (e.g. a
    // manual/admin retry, or a test verifying shipment-creation-failure
    // handling) race it after this function had already returned, since a
    // pending promise here keeps running past this request's response.
    await attemptAutomaticShipment(result.order.id).catch((err) => console.error("Automatic shipment failed:", err.message));
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

// Lets a customer retry after a failed/abandoned payment: resets the
// payment so a fresh Cashfree order is minted, resets both payment and order back to PENDING. Refuses to

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

  // Settle against Cashfree first: a payment that actually went through must never be retried, and an
  // order that is still live on Cashfree's side is reused rather than replaced (no double charge).
  if (payment.providerOrderId) {
    const current = await syncCashfreePayment(payment.providerOrderId).catch(() => null);
    if (current?.status === "PAID") throw ApiError.conflict("This order has already been paid.");
  }

  await prisma.$transaction([
    prisma.payment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: { status: "PENDING" },
    }),
    prisma.order.updateMany({
      where: { id: orderId, paymentStatus: { not: "PAID" } },
      data: { paymentStatus: "PENDING" },
    }),
  ]);

  // Reuses the existing Cashfree session while it is ACTIVE, otherwise mints a fresh order.
  return createCashfreeOrderForOrder(orderId, requestingCustomerId);
}
