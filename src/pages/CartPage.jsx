import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { formatInr } from "../lib/format";
import { EmptyCartState } from "../components/ui/EmptyState";
import { useSiteSettings } from "../hooks/useSiteSettings";

export default function CartPage() {
  const {
    items,
    isLoading,
    removeItem,
    setQuantity,
    subtotal,
    lineTotal,
    unitPrice,
    appliedCoupon,
    couponError,
    applyCoupon,
    removeCoupon,
  } = useCart();
  const { freeShippingThreshold, standardShippingAmount } = useSiteSettings();
  const [couponInput, setCouponInput] = useState("");
  const [validating, setValidating] = useState(false);

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    setValidating(true);
    await applyCoupon(couponInput);
    setValidating(false);
  };

  // A cart made entirely of digital (PDF) lines needs no shipping.
  const isDigitalOnly = items.length > 0 && items.every((i) => i.bookFormat === "PDF");
  const discount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const shippingFee = isDigitalOnly ? 0 : (subtotal >= freeShippingThreshold || subtotal === 0 ? 0 : standardShippingAmount);
  const finalTotal = Math.max(0, subtotal - discount) + shippingFee;

  return (
    <div className="store-bg store-text py-10 pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 space-y-10">
        <title>Shopping Cart — Aadya Storefront</title>

        <div className="border-b store-border pb-6">
          <span className="text-xs font-semibold uppercase tracking-widest store-primary">Your Bag</span>
          <h1 className="font-serif-display text-3xl sm:text-4xl store-text font-bold mt-1">
            Shopping Cart ({items.length} {items.length === 1 ? "item" : "items"})
          </h1>
        </div>

        {isLoading ? (
          <p className="py-16 text-center text-sm store-muted">Loading your cart…</p>
        ) : items.length === 0 ? (
          <div className="py-12">
            <EmptyCartState />
          </div>
        ) : (
          <div className="grid gap-12 lg:grid-cols-12 items-start">
            {/* Items Table (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="divide-y divide-[var(--theme-border)]">
                {items.map((item) => {
                  const { product, quantity, variant, bookFormat } = item;
                  const isPdf = bookFormat === "PDF";
                  const img = product.images?.[0] || product.image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=300&auto=format&fit=crop";
                  return (
                    <div key={`${product.slug}-${variant?.id || bookFormat || "default"}`} className="py-6 flex flex-col sm:flex-row sm:items-center gap-5">
                      <img
                        src={img}
                        alt={product.name}
                        className="h-24 w-24 rounded-xl object-cover store-surface border store-border shrink-0"
                      />

                      <div className="flex-1 space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider store-primary">
                          {product.category}
                        </span>
                        <Link
                          to={`/products/${product.slug}`}
                          className="block font-serif-display text-base font-bold store-text hover:text-[var(--theme-primary-hover)] transition"
                        >
                          {product.name}
                        </Link>
                        {variant && (
                          <p className="text-xs store-muted">Option: <span className="font-medium">{variant.name}</span></p>
                        )}
                        {bookFormat && (
                          <p className="text-xs store-muted">Format: <span className="font-medium">{bookFormat === "PDF" ? "PDF / Digital" : "Physical Book"}</span></p>
                        )}
                        <p className="text-xs store-muted">{formatInr(unitPrice(item))} each</p>

                        <button
                          onClick={() => removeItem(product.slug, bookFormat)}
                          className="text-xs store-muted hover:text-[var(--theme-primary-hover)] underline pt-1 block"
                        >
                          Remove item
                        </button>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0">
                        {/* Quantity Controls — PDF lines are always exactly 1 */}
                        {isPdf ? (
                          <span className="text-xs font-semibold uppercase tracking-wider store-muted">Qty: 1</span>
                        ) : (
                          <div className="flex items-center rounded-full border store-border store-bg px-3 py-1">
                            <button
                              onClick={() => setQuantity(product.slug, quantity - 1, bookFormat)}
                              className="px-2 text-sm font-bold store-text hover:text-[var(--theme-primary-hover)]"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-sm font-semibold store-text">{quantity}</span>
                            <button
                              onClick={() => setQuantity(product.slug, quantity + 1, bookFormat)}
                              disabled={product.stockQuantity != null && quantity >= product.stockQuantity}
                              className="px-2 text-sm font-bold store-text hover:text-[var(--theme-primary-hover)] disabled:opacity-30"
                            >
                              +
                            </button>
                          </div>
                        )}

                        {/* Line Total */}
                        <span className="text-base font-semibold store-primary min-w-[80px] text-right">
                          {formatInr(lineTotal(item))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-4">
                <Link
                  to="/shop"
                  className="text-xs font-semibold uppercase tracking-wider store-primary hover:underline"
                >
                  ← Continue Browsing Objects
                </Link>
              </div>
            </div>

            {/* Summary Sidebar (5 cols) */}
            <div className="lg:col-span-5 rounded-2xl border store-border store-surface p-6 sm:p-8 space-y-6">
              <h2 className="font-serif-display text-xl font-bold store-text">Order Summary</h2>

              {/* Coupon Code Input */}
              {appliedCoupon ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                      Coupon Applied: {appliedCoupon.code}
                    </span>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="text-xs text-rose-600 hover:underline font-medium"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="text-xs text-emerald-700">
                    Saving {formatInr(appliedCoupon.discountAmount)} on this order
                  </p>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider store-muted">Coupon Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="Enter coupon code"
                      className="flex-1 rounded-full border store-border store-bg px-4 py-2 text-xs store-text store-ring-primary focus:outline-none uppercase font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={validating}
                      className="rounded-full store-bg-primary px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white transition store-primary-hover disabled:opacity-50"
                    >
                      {validating ? "..." : "Apply"}
                    </button>
                  </div>
                  {couponError && <p className="text-xs store-primary font-medium">{couponError}</p>}
                </form>
              )}

              {/* Price Calculations */}
              <div className="space-y-3 border-t store-border pt-4 text-sm">
                <div className="flex justify-between store-muted">
                  <span>Items Subtotal</span>
                  <span className="store-text font-medium">{formatInr(subtotal)}</span>
                </div>

                {appliedCoupon && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Coupon Discount ({appliedCoupon.code})</span>
                    <span>-{formatInr(discount)}</span>
                  </div>
                )}

                <div className="flex justify-between store-muted">
                  <span>Estimated Shipping</span>
                  <span>{shippingFee === 0 ? <span className="text-emerald-700 font-semibold">FREE</span> : formatInr(shippingFee)}</span>
                </div>

                <div className="flex justify-between border-t store-border pt-3 text-base font-bold store-text">
                  <span>Order Total</span>
                  <span className="store-primary text-xl">{formatInr(finalTotal)}</span>
                </div>
              </div>

              {/* Dispatch Note */}
              <div className="rounded-xl store-bg p-3 border store-border text-xs store-muted space-y-1">
                <p className="font-semibold store-text">📦 Pan-India Express Delivery</p>
                <p>Estimated dispatch: Within 24 hours. Express transit in 3-5 business days.</p>
              </div>

              <Link
                to="/checkout"
                className="flex w-full items-center justify-center rounded-full store-bg-primary py-4 text-xs font-semibold uppercase tracking-wider text-white shadow-xs transition store-primary-hover"
              >
                Proceed to Checkout
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
