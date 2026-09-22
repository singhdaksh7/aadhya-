import React from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { IconClose, IconCart } from "./icons";
import { formatInr } from "../lib/format";
import { EmptyCartState } from "./ui/EmptyState";
import { useSiteSettings } from "../hooks/useSiteSettings";

export default function CartDrawer() {
  const { items, isOpen, setIsOpen, removeItem, setQuantity, subtotal, lineTotal, isLoading } = useCart();
  const { freeShippingThreshold } = useSiteSettings();

  if (!isOpen) return null;

  const freeShippingProgress = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));
  const amountNeeded = freeShippingThreshold - subtotal;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-ivory shadow-2xl animate-fade-up">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-charcoal/10 px-6 py-5">
          <h3 className="flex items-center gap-2 font-serif-display text-xl text-charcoal">
            <IconCart className="h-5 w-5 text-terracotta" /> Shopping Cart
            <span className="text-xs font-normal text-charcoal-soft">({items.length} items)</span>
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-full p-2 text-charcoal-soft hover:bg-charcoal/5 hover:text-charcoal"
            aria-label="Close cart"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        {/* Free Delivery Progress Bar */}
        <div className="bg-beige-light/70 px-6 py-3 border-b border-charcoal/10 text-xs">
          {subtotal >= freeShippingThreshold ? (
            <p className="font-semibold text-green-deep">🎉 You unlocked Free Pan-India Shipping!</p>
          ) : (
            <p className="text-charcoal-soft">
              Add <span className="font-semibold text-terracotta">{formatInr(amountNeeded)}</span> more for Free Shipping
            </p>
          )}
          <div className="mt-2 h-1.5 w-full rounded-full bg-charcoal/10 overflow-hidden">
            <div
              className="h-full bg-terracotta transition-all duration-500"
              style={{ width: `${freeShippingProgress}%` }}
            />
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <p className="mt-10 text-center text-sm text-charcoal-soft">Loading your cart…</p>
          ) : items.length === 0 ? (
            <div className="pt-8">
              <EmptyCartState />
            </div>
          ) : (
            <ul className="space-y-6">
              {items.map(({ product, quantity, variant }) => {
                const img = product.images?.[0] || product.image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=300&auto=format&fit=crop";
                return (
                  <li key={`${product.slug}-${variant?.id || "default"}`} className="flex gap-4 border-b border-charcoal/5 pb-5">
                    <img
                      src={img}
                      alt={product.name}
                      className="h-20 w-20 rounded-xl object-cover bg-ivory-dark/40 border border-charcoal/10 shrink-0"
                    />
                    <div className="flex flex-1 flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to={`/products/${product.slug}`}
                            onClick={() => setIsOpen(false)}
                            className="text-sm font-serif-display text-charcoal hover:text-terracotta truncate"
                          >
                            {product.name}
                          </Link>
                          <button
                            onClick={() => removeItem(product.slug)}
                            className="text-[11px] text-charcoal-soft hover:text-terracotta underline"
                          >
                            Remove
                          </button>
                        </div>
                        {variant && (
                          <span className="text-[10px] font-medium text-terracotta bg-beige-light px-2 py-0.5 rounded-full inline-block mt-0.5">
                            {variant.name}
                          </span>
                        )}
                        <p className="mt-1 text-xs font-semibold text-terracotta">
                          {formatInr(product.salePrice ?? product.price)}
                        </p>
                      </div>

                      {/* Quantity counter & line price */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center rounded-full border border-charcoal/20 bg-white px-2 py-0.5">
                          <button
                            onClick={() => setQuantity(product.slug, quantity - 1)}
                            className="px-2 text-xs font-bold text-charcoal hover:text-terracotta"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-xs font-semibold text-charcoal">{quantity}</span>
                          <button
                            onClick={() => setQuantity(product.slug, quantity + 1)}
                            disabled={product.stockQuantity != null && quantity >= product.stockQuantity}
                            className="px-2 text-xs font-bold text-charcoal hover:text-terracotta disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-xs font-bold text-charcoal">
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
          <div className="border-t border-charcoal/10 bg-ivory-dark/40 px-6 py-5 space-y-4">
            <div className="space-y-1.5 text-xs text-charcoal-soft">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-charcoal">{formatInr(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{subtotal >= freeShippingThreshold ? "FREE" : "Calculated at checkout"}</span>
              </div>
              <p className="text-[11px] text-charcoal-soft/80">Taxes included. Free 7-day returns.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/cart"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center rounded-full border border-charcoal/20 bg-white py-3 text-xs font-semibold uppercase tracking-wider text-charcoal transition hover:border-terracotta hover:text-terracotta"
              >
                View Full Cart
              </Link>
              <Link
                to="/checkout"
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center rounded-full bg-terracotta py-3 text-xs font-semibold uppercase tracking-wider text-ivory transition hover:bg-terracotta/90 shadow"
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
