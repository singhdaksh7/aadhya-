import React from "react";
import { Link } from "react-router-dom";
import { resolveMediaUrl } from "../lib/api";
import { BANNER_ALIGN_CLASSES, BANNER_OVERLAY_CLASSES } from "../lib/homepageConfig";

const DEFAULT_PROMO_CARDS = [
  {
    title: "Warm Neutrals",
    subtitle: "Unglazed Clay & Linen Textiles",
    image: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?q=80&w=1000&auto=format&fit=crop",
    ctaLabel: "Shop Collection",
    ctaUrl: "/collections/earth-collection"
  },
  {
    title: "Gift Edit",
    subtitle: "Handcrafted Heritage Objects",
    image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=1000&auto=format&fit=crop",
    ctaLabel: "Explore Gifts",
    ctaUrl: "/collections/gifts"
  }
];

export default function PromoBanners2Up({ promoCards }) {
  const cards = (Array.isArray(promoCards) && promoCards.length ? promoCards : DEFAULT_PROMO_CARDS)
    .filter((card) => card.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  if (cards.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-8 py-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card, idx) => (
          <Link
            key={idx}
            to={card.ctaUrl || "/shop"}
            className="group relative overflow-hidden rounded-2xl border store-border aspect-[16/9] sm:aspect-[2/1] store-surface block shadow-sm hover:shadow-lg transition-all duration-300"
          >
            {/* Background Image */}
            <picture>
              {card.mobileImage && <source media="(max-width: 767px)" srcSet={resolveMediaUrl(card.mobileImage)} />}
              <img
                src={resolveMediaUrl(card.image)}
                alt={card.imageAlt || card.title}
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            </picture>
            {/* Overlay (strength + text alignment are admin-configurable) */}
            <div data-testid="promo-banner-overlay" className={`absolute inset-0 bg-gradient-to-t ${BANNER_OVERLAY_CLASSES[card.overlayStrength] || BANNER_OVERLAY_CLASSES.MEDIUM} p-6 sm:p-8 flex flex-col justify-end ${BANNER_ALIGN_CLASSES[card.textAlign] || BANNER_ALIGN_CLASSES.LEFT} text-white`}>
              {card.eyebrow && (
                <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/85">{card.eyebrow}</span>
              )}
              {card.title && (
                <h3 className="font-serif-display text-xl sm:text-2xl text-white">{card.title}</h3>
              )}
              {/* Image-first banner: only the title and a subtle bordered CTA sit on the image (subtitle/description are never rendered). */}
              <span
                data-testid="promo-banner-cta"
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/80 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-[2px] transition-colors group-hover:bg-white group-hover:text-charcoal"
              >
                {card.ctaLabel || "Shop Now"}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">&rarr;</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
