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
              <span className="text-xs font-semibold uppercase tracking-widest store-accent">
                {card.eyebrow || "Curated Edit"}
              </span>
              <h3 className="font-serif-display text-2xl sm:text-3xl text-white mt-1">
                {card.title}
              </h3>
              <p className="text-xs sm:text-sm text-white/90 mt-1">
                {card.subtitle}
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white group-hover:store-accent transition-colors">
                <span>{card.ctaLabel || "Discover Now"}</span>
                <svg className="h-4 w-4 transform transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
