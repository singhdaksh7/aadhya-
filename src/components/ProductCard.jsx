import React, { useState } from "react";
import { Link } from "react-router-dom";
import { formatInr } from "../lib/format";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { IconCart, IconCheck } from "./icons";
import { trackAddToCart, trackWishlistAdd } from "../lib/analytics";

export default function ProductCard({ product }) {
  const { addItem, items } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { showRatings } = useSiteSettings();

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

  const categoryName = typeof product.category === "object" ? product.category?.name : (product.category || "Home Decor");
  const categorySlug = product.categorySlug || "home-decor";

  const handleQuickAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock || atStockLimit) return;
    addItem(product);
    trackAddToCart(product.id, { slug: product.slug });
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 1800);
  };

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--theme-border)] store-surface transition-all duration-300 hover:border-[var(--theme-primary)]/30 hover:shadow-lg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top Badges */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
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

      {/* Wishlist Heart Button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!wishlisted) trackWishlistAdd(product.id, { slug: product.slug });
          toggleWishlist(product.id);
        }}
        aria-label={wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
        className={`absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm transition-all hover:scale-110 shadow-xs ${
          wishlisted ? "store-primary" : "store-muted hover:text-[var(--theme-primary)]"
        }`}
      >
        <svg className="h-4 w-4" fill={wishlisted ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.684a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>

      {/* Image Container with Hover Zoom & Dual Image */}
      <Link to={`/shop/${product.slug}`} className="relative aspect-square w-full overflow-hidden store-surface">
        <img
          src={primaryImg}
          alt={product.name}
          className={`h-full w-full object-cover transition-all duration-500 ease-out group-hover:scale-105 ${
            isHovered && hoverImg !== primaryImg ? "opacity-0" : "opacity-100"
          }`}
          loading="lazy"
        />
        {hoverImg !== primaryImg && (
          <img
            src={hoverImg}
            alt={`${product.name} lifestyle`}
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ease-out group-hover:scale-105 ${
              isHovered ? "opacity-100" : "opacity-0"
            }`}
            loading="lazy"
          />
        )}

        {/* Quick Add Overlay on Desktop Hover */}
        <div className="absolute bottom-3 left-3 right-3 hidden transition-all duration-300 transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 sm:block">
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={outOfStock || atStockLimit}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold uppercase tracking-wider shadow-md transition ${
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
      </Link>

      {/* Product Content Details */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center justify-between text-xs store-muted">
          <Link to={`/shop/category/${categorySlug}`} className="hover:text-[var(--theme-primary)] hover:underline">
            {categoryName}
          </Link>
          {stockQty <= 5 && stockQty > 0 && (
            <span className="text-[11px] font-medium store-primary">Only {stockQty} left</span>
          )}
        </div>

        <Link to={`/shop/${product.slug}`} className="mt-1.5 block">
          <h3 className="font-serif-display text-base store-text transition hover:text-[var(--theme-primary)] line-clamp-1">
            {product.name}
          </h3>
        </Link>

        {/* Ratings Display */}
        {showRatings !== false && (product.reviewCount > 0 || product.averageRating > 0) && (
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            <div className="flex items-center text-amber-500">
              <span className="text-sm">★</span>
              <span className="ml-0.5 font-semibold store-text">
                {Number(product.averageRating || 0).toFixed(1)}
              </span>
            </div>
            {product.reviewCount > 0 && (
              <span className="text-[11px] store-muted">({product.reviewCount})</span>
            )}
          </div>
        )}

        {product.author && (
          <p className="mt-0.5 text-xs store-muted italic">By {product.author}</p>
        )}

        {product.shortDescription && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed store-muted">
            {product.shortDescription}
          </p>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between border-t border-[var(--theme-border)]">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold store-primary">
              {formatInr(salePrice ?? price)}
            </span>
            {onSale && (
              <span className="text-xs store-muted line-through">
                {formatInr(price)}
              </span>
            )}
          </div>

          {/* Mobile Quick Add Button */}
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={outOfStock || atStockLimit}
            aria-label="Add to cart"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition sm:hidden ${
              addedNotice
                ? "bg-sage text-white"
                : outOfStock || atStockLimit
                ? "bg-[var(--theme-border)] text-[var(--theme-muted)]"
                : "bg-[var(--theme-primary-soft)] store-primary hover:bg-[var(--theme-primary)] hover:text-white"
            }`}
          >
            {addedNotice ? <IconCheck className="h-4 w-4" /> : <IconCart className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
