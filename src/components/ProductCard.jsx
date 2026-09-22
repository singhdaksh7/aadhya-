import React, { useState } from "react";
import { Link } from "react-router-dom";
import { formatInr } from "../lib/format";
import { useCart } from "../context/CartContext";
import { IconCart, IconCheck } from "./icons";

export default function ProductCard({ product }) {
  const { addItem, items } = useCart();
  const [isHovered, setIsHovered] = useState(false);
  const [addedNotice, setAddedNotice] = useState(false);

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
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 1800);
  };

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-charcoal/10 bg-white transition-all duration-300 hover:border-terracotta/30 hover:shadow-lg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top Badges */}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
        {onSale && (
          <span className="rounded-full bg-terracotta px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ivory shadow-sm">
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

      {/* Image Container with Hover Zoom & Dual Image */}
      <Link to={`/shop/${product.slug}`} className="relative aspect-square w-full overflow-hidden bg-ivory-dark/40">
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
                ? "bg-sage text-ivory"
                : outOfStock || atStockLimit
                ? "bg-charcoal/20 text-charcoal/50 cursor-not-allowed"
                : "bg-terracotta text-ivory hover:bg-terracotta/90"
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
        <div className="flex items-center justify-between text-xs text-charcoal-soft">
          <Link to={`/shop/category/${categorySlug}`} className="hover:text-terracotta hover:underline">
            {categoryName}
          </Link>
          {stockQty <= 5 && stockQty > 0 && (
            <span className="text-[11px] font-medium text-terracotta">Only {stockQty} left</span>
          )}
        </div>

        <Link to={`/shop/${product.slug}`} className="mt-1.5 block">
          <h3 className="font-serif-display text-base text-charcoal transition hover:text-terracotta line-clamp-1">
            {product.name}
          </h3>
        </Link>

        {product.author && (
          <p className="mt-0.5 text-xs text-charcoal-soft italic">By {product.author}</p>
        )}

        {product.shortDescription && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-charcoal-soft">
            {product.shortDescription}
          </p>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between border-t border-charcoal/5">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-terracotta">
              {formatInr(salePrice ?? price)}
            </span>
            {onSale && (
              <span className="text-xs text-charcoal-soft line-through">
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
                ? "bg-sage text-ivory"
                : outOfStock || atStockLimit
                ? "bg-charcoal/10 text-charcoal/40"
                : "bg-terracotta/10 text-terracotta hover:bg-terracotta hover:text-ivory"
            }`}
          >
            {addedNotice ? <IconCheck className="h-4 w-4" /> : <IconCart className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
