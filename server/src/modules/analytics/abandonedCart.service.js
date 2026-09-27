import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { round2 } from "../../utils/money.js";

// A cart counts as "abandoned" once it has sat idle (no update) for at
// least this long, still has items, and the customer hasn't placed a
// confirmed/paid order since the cart last changed.
const ABANDONED_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

function cartValue(cart) {
  return round2(
    cart.items.reduce((sum, item) => {
      const unitPrice = Number(item.variant?.priceOverride ?? item.product?.salePrice ?? item.product?.price ?? 0);
      return sum + unitPrice * item.quantity;
    }, 0)
  );
}

export async function listAbandonedCarts({ thresholdMs = ABANDONED_THRESHOLD_MS } = {}) {
  const cutoff = new Date(Date.now() - thresholdMs);

  const carts = await prisma.cart.findMany({
    where: {
      updatedAt: { lte: cutoff },
      recoveredAt: null,
      items: { some: {} },
    },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, slug: true, price: true, salePrice: true } },
          variant: { select: { id: true, name: true, priceOverride: true } },
        },
      },
    },
    orderBy: { updatedAt: "asc" },
  });

  // A cart is only truly "abandoned" if the customer hasn't completed a
  // paid order after the cart was last touched — otherwise it's just a
  // stale leftover from a completed purchase. One extra query, not N+1.
  const customerIds = carts.map((c) => c.customerId);
  const recentPaidOrders = customerIds.length
    ? await prisma.order.findMany({
        where: { customerId: { in: customerIds }, paymentStatus: "PAID" },
        select: { customerId: true, paidAt: true },
      })
    : [];
  const lastPaidByCustomer = new Map();
  for (const o of recentPaidOrders) {
    const existing = lastPaidByCustomer.get(o.customerId);
    if (!existing || o.paidAt > existing) lastPaidByCustomer.set(o.customerId, o.paidAt);
  }

  return carts
    .filter((cart) => {
      const lastPaid = lastPaidByCustomer.get(cart.customerId);
      return !lastPaid || lastPaid < cart.updatedAt;
    })
    .map((cart) => ({
      cartId: cart.id,
      customer: cart.customer,
      items: cart.items.map((i) => ({
        productName: i.product?.name,
        productSlug: i.product?.slug,
        variantName: i.variant?.name || null,
        quantity: i.quantity,
      })),
      itemCount: cart.items.reduce((s, i) => s + i.quantity, 0),
      value: cartValue(cart),
      abandonedSince: cart.updatedAt,
      abandonedDurationMs: Date.now() - cart.updatedAt.getTime(),
      recoveryEmailSentAt: cart.recoveryEmailSentAt,
      recoveryStatus: cart.recoveryEmailSentAt ? "sent" : "not_sent",
    }));
}

// Composes recovery email content. Pure/deterministic — no AI copy, no
// side effects — so it's trivially testable and reusable by whatever
// transport (email.service.js) actually sends it.
export function composeRecoveryEmail({ customer, items, value }) {
  const itemLines = items.map((i) => `- ${i.productName}${i.variantName ? ` (${i.variantName})` : ""} x${i.quantity}`).join("\n");
  const subject = "You left something in your cart";
  const text = `Hi ${customer?.name || "there"},\n\nYou still have items waiting in your Aadya cart:\n\n${itemLines}\n\nCart value: ₹${value}\n\nComplete your order before these items sell out.`;
  return { subject, text, to: customer?.email };
}

// Gated so a cart can only ever be recovery-emailed once: the DB update
// uses a compare-and-swap (`recoveryEmailSentAt: null`) so a concurrent
// second trigger for the same cart is a safe no-op, not a duplicate send.
export async function triggerRecoveryEmail(cartId, sendFn) {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          product: { select: { name: true, slug: true, price: true, salePrice: true } },
          variant: { select: { name: true, priceOverride: true } },
        },
      },
    },
  });
  if (!cart) throw ApiError.notFound("Cart not found");
  if (cart.recoveryEmailSentAt) {
    return { sent: false, reason: "already_sent" };
  }

  const cas = await prisma.cart.updateMany({
    where: { id: cartId, recoveryEmailSentAt: null },
    data: { recoveryEmailSentAt: new Date() },
  });
  if (cas.count === 0) {
    return { sent: false, reason: "already_sent" };
  }

  const email = composeRecoveryEmail({
    customer: cart.customer,
    items: cart.items.map((i) => ({ productName: i.product?.name, variantName: i.variant?.name || null, quantity: i.quantity })),
    value: cartValue(cart),
  });

  if (typeof sendFn === "function") {
    try {
      await sendFn(email);
    } catch (err) {
      // Best-effort — the "sent" flag stays set (never spam-retry), but log
      // it so an operator can follow up manually if the transport failed.
      console.error("Abandoned cart recovery email failed to send:", err);
    }
  }

  return { sent: true, email };
}
