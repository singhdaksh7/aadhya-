import React, { useState } from "react";
import { Link } from "react-router-dom";
import { formatInr } from "../lib/format";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { IconCart, IconCheck } from "./icons";
import { trackAddToCart, trackWishlistAdd } from "../lib/analytics";

export default function ProductCard({ product }) {
  const { addItem, items } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [isHovered, setIsHovered] = useState(false);
  const [addedNotice, setAddedNotice] = useState(false);

  const wishlisted = isInWishlist(product.id);
  const inCart = items.find((i) => i.product.slug === product.slug);
  const stockQty = product.stockQuantity ?? (product.inStock !== false ? 10 : 0);
  const outOfStock = product.inStock === false || stockQty <= 0;
  const atStockLimit = inCart && inCart.quantity >= stockQty;

  const price = Number(product.price);
  const salePrice = product.salePrice ? Number(product.salePrice) : null;
  const onSale = salePrice != null && salePrice < price;

  const discountPercent = onSale ? Math.round(((price - salePrice) / price) * 100) : 0;

  // Dual image logic
  const primaryImg = product.images?.[0] || product.image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=800&auto=format&fit=crop";
  const hoverImg = product.images?.[1] || primaryImg;


  const handleQuickAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock || atStockLimit) return;
    addItem(product);
    trackAddToCart(product.id, { slug: product.slug });
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 1800);
  };

  // Editorial card: no enclosing box. The image carries its own radius, badges, wishlist and quick-add;
  // the name and the single price sit directly on the page background beneath it.
  return (
    <div
      data-testid="product-card-root"
      className="group relative flex flex-col"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div data-testid="product-card-media" className="relative aspect-[4/5] w-full overflow-hidden rounded-xl store-surface">
        <div className="absolute left-2.5 top-2.5 z-10 flex flex-wrap gap-1.5">
          {onSale && (
            <span className="rounded-full store-bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm">
              {discountPercent}% OFF
            </span>
          )}
          {product.isNew && (
            <span className="rounded-full bg-sage-light px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-green-deep">
              New
            </span>
          )}
          {product.isBestSeller && (
            <span className="rounded-full bg-beige px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal">
              Best Seller
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!wishlisted) trackWishlistAdd(product.id, { slug: product.slug });
            toggleWishlist(product.id);
          }}
          aria-label={wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
          className={`absolute right-2.5 top-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm transition-all hover:scale-110 shadow-xs ${
            wishlisted ? "store-primary" : "store-muted hover:text-[var(--theme-primary)]"
          }`}
        >
          <svg className="h-4 w-4" fill={wishlisted ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.684a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        <Link to={`/shop/${product.slug}`} aria-label={product.name} className="absolute inset-0 block">
          <img
            src={primaryImg}
            alt={product.name}
            className={`h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-[1.03] ${
              isHovered && hoverImg !== primaryImg ? "opacity-0" : "opacity-100"
            }`}
            loading="lazy"
          />
          {hoverImg !== primaryImg && (
            <img
              src={hoverImg}
              alt={`${product.name} lifestyle`}
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-[1.03] ${
                isHovered ? "opacity-100" : "opacity-0"
              }`}
              loading="lazy"
            />
          )}
        </Link>

        {/* Quick add: slides up on desktop hover; a compact round button on touch screens. */}
        <div className="absolute bottom-3 left-3 right-3 z-10 hidden translate-y-2 transform opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 sm:block">
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={outOfStock || atStockLimit}
            className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[11px] font-semibold uppercase tracking-wider shadow-md transition ${
              addedNotice
                ? "bg-sage text-white"
                : outOfStock || atStockLimit
                ? "bg-[var(--theme-border)] text-[var(--theme-muted)] cursor-not-allowed"
                : "store-bg-primary text-white hover:brightness-95"
            }`}
          >
            {addedNotice ? (
              <>
                <IconCheck className="h-4 w-4" /> Added to Cart
              </>
            ) : outOfStock ? (
              "Sold Out"
            ) : atStockLimit ? (
              "Max in Cart"
            ) : (
              <>
                <IconCart className="h-4 w-4" /> Quick Add
              </>
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={handleQuickAdd}
          disabled={outOfStock || atStockLimit}
          aria-label="Add to cart"
          className={`absolute bottom-2.5 right-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-xs backdrop-blur-sm transition sm:hidden ${
            addedNotice ? "text-sage" : outOfStock || atStockLimit ? "text-[var(--theme-muted)]" : "store-primary"
          }`}
        >
          {addedNotice ? <IconCheck className="h-4 w-4" /> : <IconCart className="h-4 w-4" />}
        </button>
      </div>

      {/* Minimal text: name and one clean price (no category, description, tax note or MRP clutter). */}
      <div className="pt-3">
        <Link to={`/shop/${product.slug}`} className="block">
          <h3 className="line-clamp-1 font-serif-display text-[15px] font-normal store-text transition hover:text-[var(--theme-primary)]">
            {product.name}
          </h3>
        </Link>
        <span data-testid="card-price" className="mt-1 block text-sm font-medium store-primary">
          {formatInr(salePrice ?? price)}
        </span>
      </div>
    </div>
  );
}
