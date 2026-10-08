import React from "react";
import { Link } from "react-router-dom";
import { formatInr } from "../../lib/format";
import { resolveMediaUrl } from "../../lib/api";

const cleanAuthor = (author) => (typeof author === "string" ? author.replace(/\s*\(demo sample\)\s*$/i, "").trim() : "");

/** Book-specific card: portrait cover, title, author and a single price. No box around it. */
export default function BookCard({ product }) {
  const cover = product.images?.[0]?.url || product.images?.[0] || product.image;
  const price = Number(product.salePrice ?? product.price);
  const author = cleanAuthor(product.bookDetail?.author);
  return (
    <Link to={`/shop/${product.slug}`} data-testid="book-card" className="group block">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[3px] store-surface shadow-[0_10px_24px_-14px_rgba(43,39,35,0.45)] transition duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_18px_30px_-14px_rgba(43,39,35,0.5)]">
        {cover && <img src={resolveMediaUrl(cover)} alt={`${product.name} cover`} loading="lazy" className="h-full w-full object-cover" />}
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/20 to-transparent" />
        {product.isNewArrival && <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-charcoal">New</span>}
      </div>
      <div className="pt-3">
        <h3 className="line-clamp-2 font-serif-display text-[15px] font-normal leading-snug store-text transition group-hover:text-[var(--theme-primary)]">{product.name}</h3>
        {author && <p data-testid="book-author" className="mt-0.5 line-clamp-1 text-xs italic store-muted">{author}</p>}
        <span data-testid="card-price" className="mt-1 block text-sm font-medium store-primary">{formatInr(price)}</span>
      </div>
    </Link>
  );
}
