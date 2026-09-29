import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { IconClose, IconCart } from "./icons";
import { formatInr } from "../lib/format";
import { EmptyCartState } from "./ui/EmptyState";
import { useSiteSettings } from "../hooks/useSiteSettings";

export default function CartDrawer() {
  const {
    items,
    isOpen,
    setIsOpen,
    removeItem,
    setQuantity,
    subtotal,
    lineTotal,
    isLoading,
    appliedCoupon,
    couponError,
    applyCoupon,
    removeCoupon,
  } = useCart();
  const { freeShippingThreshold } = useSiteSettings();
  const [couponInput, setCouponInput] = useState("");
  const [validating, setValidating] = useState(false);

  if (!isOpen) return null;

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    setValidating(true);
    const ok = await applyCoupon(couponInput);
    if (ok) setCouponInput("");
    setValidating(false);
  };

  const freeShippingProgress = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));
  const amountNeeded = freeShippingThreshold - subtotal;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col store-bg shadow-2xl animate-fade-up">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b store-border px-6 py-5">
          <h3 className="flex items-center gap-2 font-serif-display text-xl store-text">
            <IconCart className="h-5 w-5 store-primary" /> Shopping Cart
            <span className="text-xs font-normal store-muted">({items.length} items)</span>
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-full p-2 store-muted hover:bg-[var(--theme-border)]/40 hover:text-[var(--theme-text)]"
            aria-label="Close cart"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        {/* Free Delivery Progress Bar (bg-beige-light/text-green-deep here is a success state, left as semantic) */}
        <div className="bg-beige-light/70 px-6 py-4 border-b store-border text-xs">
          {subtotal >= freeShippingThreshold ? (
            <p className="font-semibold text-green-deep">🎉 You unlocked Free Pan-India Shipping!</p>
          ) : (
            <p className="store-muted">
              Add <span className="font-semibold store-primary">{formatInr(amountNeeded)}</span> more for Free Shipping
            </p>
          )}
          <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--theme-border)] overflow-hidden">
            <div
              className="h-full store-bg-primary transition-all duration-500"
              style={{ width: `${freeShippingProgress}%` }}
            />
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <p className="mt-10 text-center text-sm store-muted">Loading your cart…</p>
          ) : items.length === 0 ? (
            <div className="pt-8">
              <EmptyCartState />
            </div>
          ) : (
            <ul className="space-y-6">
              {items.map(({ product, quantity, variant }) => {
                const img = product.images?.[0] || product.image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=300&auto=format&fit=crop";
                return (
                  <li key={`${product.slug}-${variant?.id || "default"}`} className="flex gap-4 border-b border-[var(--theme-border)]/50 pb-5">
                    <img
                      src={img}
                      alt={product.name}
                      className="h-20 w-20 rounded-xl object-cover store-surface border store-border shrink-0"
                    />
                    <div className="flex flex-1 flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={`/products/${product.slug}`}
                            onClick={() => setIsOpen(false)}
                            className="text-sm font-serif-display store-text hover:text-[var(--theme-primary-hover)] truncate"
                          >
                            {product.name}
                          </Link>
                          <button
                            onClick={() => removeItem(product.slug)}
                            className="text-[11px] store-muted hover:text-[var(--theme-primary-hover)] underline"
                          >
                            Remove
                          </button>
                        </div>
                        {variant && (
                          <span className="text-[10px] font-medium store-primary bg-[var(--theme-primary-soft)] px-2 py-0.5 rounded-full inline-block mt-0.5">
                            {variant.name}
                          </span>
                        )}
                        <p className="mt-1 text-xs font-semibold store-primary">
                          {formatInr(product.salePrice ?? product.price)}
                        </p>
                      </div>

                      {/* Quantity counter & line price */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center rounded-full border store-border store-bg px-2 py-0.5">
                          <button
                            onClick={() => setQuantity(product.slug, quantity - 1)}
                            className="px-2 text-xs font-bold store-text hover:text-[var(--theme-primary-hover)]"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-xs font-semibold store-text">{quantity}</span>
                          <button
                            onClick={() => setQuantity(product.slug, quantity + 1)}
                            disabled={product.stockQuantity != null && quantity >= product.stockQuantity}
                            className="px-2 text-xs font-bold store-text hover:text-[var(--theme-primary-hover)] disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-xs font-bold store-text">
                          {formatInr(lineTotal({ product, quantity }))}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer Checkout Summary */}
        {items.length > 0 && (
          <div className="border-t store-border store-surface px-6 py-5 space-y-4">
            {appliedCoupon ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    {appliedCoupon.code} applied
                  </span>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="text-[11px] text-rose-600 hover:underline font-medium"
                  >
                    Remove
                  </button>
                </div>
                <p className="text-[11px] text-emerald-700">
                  You saved {formatInr(appliedCoupon.discountAmount)}
                </p>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider store-muted">
                  Have a promo code?
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Enter code"
                    aria-label="Coupon code"
                    className="flex-1 rounded-full border store-border store-bg px-3 py-1.5 text-xs store-text store-ring-primary focus:outline-none uppercase font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={validating}
                    className="rounded-full store-bg-primary px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white transition store-primary-hover disabled:opacity-50"
                  >
                    {validating ? "..." : "Apply"}
                  </button>
                </div>
                {couponError && <p className="text-[11px] store-primary font-medium">{couponError}</p>}
              </form>
            )}

            <div className="space-y-1.5 text-xs store-muted">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold store-text">{formatInr(subtotal)}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Coupon Discount ({appliedCoupon.code})</span>
                  <span>-{formatInr(appliedCoupon.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{subtotal >= freeShippingThreshold ? "FREE" : "Calculated at checkout"}</span>
              </div>
              <p className="text-[11px] store-muted/80">Taxes included. Free 7-day returns.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/cart"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center rounded-full border store-border store-bg py-3 text-xs font-semibold uppercase tracking-wider store-text transition hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]"
              >
                View Full Cart
              </Link>
              <Link
                to="/checkout"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center rounded-full store-bg-primary py-3 text-xs font-semibold uppercase tracking-wider text-white transition store-primary-hover shadow"
              >
                Checkout Now
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
