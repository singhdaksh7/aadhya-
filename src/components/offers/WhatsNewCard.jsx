import React from "react";
import { Link } from "react-router-dom";
import { resolveProductImageUrl } from "../../lib/api";

export default function WhatsNewCard({ item }) {
  const img = item.imageUrl ? resolveProductImageUrl(item.imageUrl) : null;
  const external = item.ctaUrl && /^https?:\/\//i.test(item.ctaUrl);
  const cta = item.ctaUrl && item.ctaLabel ? (
    external ? (
      <a href={item.ctaUrl} target="_blank" rel="noopener noreferrer" className="mt-auto text-sm font-semibold text-terracotta underline underline-offset-4">
        {item.ctaLabel}
      </a>
    ) : (
      <Link to={item.ctaUrl} className="mt-auto text-sm font-semibold text-terracotta underline underline-offset-4">
        {item.ctaLabel}
      </Link>
    )
  ) : null;

  return (
    <article data-testid="whats-new-card" className="flex flex-col overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-white shadow-sm">
      {img && (
        <div className="relative aspect-[4/3] bg-beige-light">
          <img src={img} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
          {item.badge && (
            <span className="absolute left-3 top-3 rounded-full bg-terracotta px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-ivory">{item.badge}</span>
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-5">
        {!img && item.badge && (
          <span className="w-fit rounded-full bg-terracotta px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-ivory">{item.badge}</span>
        )}
        <h3 className="font-serif-display text-xl text-charcoal">{item.title}</h3>
        {item.subtitle && <p className="text-sm leading-relaxed text-charcoal-soft">{item.subtitle}</p>}
        {cta}
      </div>
    </article>
  );
}
