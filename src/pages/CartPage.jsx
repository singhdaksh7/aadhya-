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

  const discount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const shippingFee = subtotal >= freeShippingThreshold || subtotal === 0 ? 0 : standardShippingAmount;
  const finalTotal = Math.max(0, subtotal - discount) + shippingFee;

  return (
    <div className="bg-white text-charcoal py-10 pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-8 space-y-10">
        <title>Shopping Cart — Aadya Storefront</title>

        <div className="border-b border-charcoal/10 pb-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Your Bag</span>
          <h1 className="font-serif-display text-3xl sm:text-4xl text-charcoal font-bold mt-1">
            Shopping Cart ({items.length} {items.length === 1 ? "item" : "items"})
          </h1>
        </div>

        {isLoading ? (
          <p className="py-16 text-center text-sm text-charcoal-soft">Loading your cart…</p>
        ) : items.length === 0 ? (
          <div className="py-12">
            <EmptyCartState />
          </div>
        ) : (
          <div className="grid gap-12 lg:grid-cols-12 items-start">
            {/* Items Table (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="divide-y divide-charcoal/10">
                {items.map(({ product, quantity, variant }) => {
                  const img = product.images?.[0] || product.image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=300&auto=format&fit=crop";
                  return (
                    <div key={`${product.slug}-${variant?.id || "default"}`} className="py-6 flex flex-col sm:flex-row sm:items-center gap-5">
                      <img
                        src={img}
                        alt={product.name}
                        className="h-24 w-24 rounded-xl object-cover bg-[#FAF6F0] border border-charcoal/10 shrink-0"
                      />

                      <div className="flex-1 space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-terracotta">
                          {product.category}
                        </span>
                        <Link
                          to={`/products/${product.slug}`}
                          className="block font-serif-display text-base font-bold text-charcoal hover:text-terracotta transition"
                        >
                          {product.name}
                        </Link>
                        {variant && (
                          <p className="text-xs text-charcoal-soft">Option: <span className="font-medium">{variant.name}</span></p>
                        )}
                        <p className="text-xs text-charcoal-soft">{formatInr(product.salePrice ?? product.price)} each</p>

                        <button
                          onClick={() => removeItem(product.slug)}
                          className="text-xs text-charcoal-soft hover:text-terracotta underline pt-1 block"
                        >
                          Remove item
                        </button>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0">
                        {/* Quantity Controls */}
                        <div className="flex items-center rounded-full border border-charcoal/20 bg-white px-3 py-1">
                          <button
                            onClick={() => setQuantity(product.slug, quantity - 1)}
                            className="px-2 text-sm font-bold text-charcoal hover:text-terracotta"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-semibold text-charcoal">{quantity}</span>
                          <button
                            onClick={() => setQuantity(product.slug, quantity + 1)}
                            disabled={product.stockQuantity != null && quantity >= product.stockQuantity}
                            className="px-2 text-sm font-bold text-charcoal hover:text-terracotta disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>

                        {/* Line Total */}
                        <span className="text-base font-semibold text-terracotta min-w-[80px] text-right">
                          {formatInr(lineTotal({ product, quantity }))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-4">
                <Link
                  to="/shop"
                  className="text-xs font-semibold uppercase tracking-wider text-terracotta hover:underline"
                >
                  ← Continue Browsing Objects
                </Link>
              </div>
            </div>

            {/* Summary Sidebar (5 cols) */}
            <div className="lg:col-span-5 rounded-2xl border border-charcoal/10 bg-[#FAF6F0] p-6 sm:p-8 space-y-6">
              <h2 className="font-serif-display text-xl font-bold text-charcoal">Order Summary</h2>

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
                  <label className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Coupon Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="Enter coupon code"
                      className="flex-1 rounded-full border border-charcoal/20 bg-white px-4 py-2 text-xs text-charcoal focus:outline-none focus:border-terracotta uppercase font-mono"
                    />
                    <button
                      type="submit"
                      disabled={validating}
                      className="rounded-full bg-charcoal px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-charcoal/80 disabled:opacity-50"
                    >
                      {validating ? "..." : "Apply"}
                    </button>
                  </div>
                  {couponError && <p className="text-xs text-terracotta font-medium">{couponError}</p>}
                </form>
              )}

              {/* Price Calculations */}
              <div className="space-y-3 border-t border-charcoal/10 pt-4 text-sm">
                <div className="flex justify-between text-charcoal-soft">
                  <span>Items Subtotal</span>
                  <span className="text-charcoal font-medium">{formatInr(subtotal)}</span>
                </div>

                {appliedCoupon && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Coupon Discount ({appliedCoupon.code})</span>
                    <span>-{formatInr(discount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-charcoal-soft">
                  <span>Estimated Shipping</span>
                  <span>{shippingFee === 0 ? <span className="text-emerald-700 font-semibold">FREE</span> : formatInr(shippingFee)}</span>
                </div>

                <div className="flex justify-between border-t border-charcoal/10 pt-3 text-base font-bold text-charcoal">
                  <span>Order Total</span>
                  <span className="text-terracotta text-xl">{formatInr(finalTotal)}</span>
                </div>
              </div>

              {/* Dispatch Note */}
              <div className="rounded-xl bg-white p-3 border border-charcoal/10 text-xs text-charcoal-soft space-y-1">
                <p className="font-semibold text-charcoal">📦 Pan-India Express Delivery</p>
                <p>Estimated dispatch: Within 24 hours. Express transit in 3-5 business days.</p>
              </div>

              <Link
                to="/checkout"
                className="flex w-full items-center justify-center rounded-full bg-terracotta py-4 text-xs font-semibold uppercase tracking-wider text-white shadow-xs transition hover:bg-terracotta-dark"
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
