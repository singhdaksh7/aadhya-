import React, { useState } from "react";
import { SectionHeading, Button, Tag } from "../components/ui";
import { trackOrder, ApiRequestError } from "../lib/api";
import { formatInr } from "../lib/format";
import { IconCheck } from "../components/icons";

const STATUS_TIMELINE = [
  { key: "CONFIRMED", label: "Order Confirmed", desc: "Your order has been logged into our artisan fulfillment queue." },
  { key: "PROCESSING", label: "Artisan Processing", desc: "Objects are quality checked and eco-cushion packed." },
  { key: "SHIPPED", label: "Shipped in Transit", desc: "Package dispatched via insured express courier." },
  { key: "DELIVERED", label: "Delivered", desc: "Successfully delivered to your sanctuary." }
];

export default function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      const res = await trackOrder({ orderNumber: orderNumber.trim(), email: email.trim() });
      setOrder(res.data);
      setStatus("ready");
    } catch (err) {
      setError(
        err instanceof ApiRequestError && err.status === 404
          ? "No matching order was found. Please check your order number and email address."
          : err.message || "Something went wrong while looking up your order."
      );
      setStatus("error");
    }
  };

  const getStepIndex = (currentStatus) => {
    const s = (currentStatus || "").toUpperCase();
    if (s === "DELIVERED") return 3;
    if (s === "SHIPPED") return 2;
    if (s === "PROCESSING") return 1;
    return 0; // CONFIRMED
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8 space-y-10">
      <title>Track Your Order — Aadya Storefront</title>

      <div className="text-center max-w-lg mx-auto">
        <span className="text-xs font-semibold uppercase tracking-widest store-primary">Shipment Tracker</span>
        <h1 className="font-serif-display text-3xl sm:text-4xl store-text mt-1">Track Your Order</h1>
        <p className="text-sm store-muted mt-2 leading-relaxed">
          Enter your order number (e.g. AAD-2026-008921) and account email to trace your shipment.
        </p>
      </div>

      <form onSubmit={onSubmit} className="rounded-3xl border store-border store-surface p-6 sm:p-8 space-y-4 shadow-sm">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider store-muted mb-1">Order Number</label>
          <input
            required
            placeholder="AAD-2026-008921"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            className="w-full rounded-xl border store-border store-bg px-4 py-3 text-sm store-text focus:border-[var(--theme-primary)] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider store-muted mb-1">Checkout Email</label>
          <input
            required
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border store-border store-bg px-4 py-3 text-sm store-text focus:border-[var(--theme-primary)] focus:outline-none"
          />
        </div>

        <button
          disabled={status === "loading"}
          className="w-full rounded-full store-bg-primary py-3.5 text-xs font-semibold uppercase tracking-wider text-white transition store-primary-hover shadow"
        >
          {status === "loading" ? "Searching Order..." : "Trace Order Status"}
        </button>
      </form>

      {error && <p className="text-center text-sm font-medium text-terracotta bg-terracotta/10 p-4 rounded-xl">{error}</p>}

      {status === "ready" && order && (
        <div className="rounded-3xl border store-border store-bg p-6 sm:p-8 space-y-8 shadow-md animate-fade-up">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b store-border pb-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider store-primary">Order Details</span>
              <h2 className="font-serif-display text-2xl store-text">{order.orderNumber}</h2>
              <p className="text-xs store-muted mt-1">Placed on {new Date(order.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full bg-sage-light px-3 py-1 text-xs font-semibold uppercase tracking-wider text-green-deep">
                {order.status}
              </span>
              <span className="rounded-full bg-beige px-3 py-1 text-xs font-semibold uppercase tracking-wider text-charcoal">
                {order.paymentStatus || "PAID"}
              </span>
            </div>
          </div>

          {/* Visual Progress Timeline */}
          <div>
            <h3 className="font-serif-display text-lg store-text mb-6">Delivery Timeline</h3>
            <div className="space-y-6 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[var(--theme-border)]">
              {STATUS_TIMELINE.map((step, idx) => {
                const currentIdx = getStepIndex(order.status);
                const isPassed = idx <= currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                  <div key={step.key} className="flex gap-4 items-start relative z-10">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                        isPassed
                          ? "store-bg-primary text-white shadow-sm"
                          : "store-surface store-muted border store-border"
                      }`}
                    >
                      {isPassed ? <IconCheck className="h-4 w-4" /> : idx + 1}
                    </div>

                    <div className="space-y-0.5">
                      <p className={`text-sm font-semibold ${isCurrent ? "store-primary" : isPassed ? "store-text" : "store-muted"}`}>
                        {step.label}
                      </p>
                      <p className="text-xs store-muted">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order Items List */}
          <div className="border-t store-border pt-6 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider store-muted">Items in this Order</h4>
            <div className="divide-y divide-[var(--theme-border)]">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 text-xs">
                  <span className="store-text font-medium">
                    {item.name || item.productNameSnapshot} × {item.quantity}
                  </span>
                  <span className="store-primary font-semibold">
                    {formatInr(item.lineTotal || (item.unitPrice * item.quantity))}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between border-t store-border pt-3 text-sm font-bold store-text">
              <span>Total Amount</span>
              <span className="store-primary">{formatInr(order.totalAmount)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
