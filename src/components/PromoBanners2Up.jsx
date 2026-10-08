import React from "react";
import { Link } from "react-router-dom";
import { resolveMediaUrl } from "../lib/api";
import { ctaLabel } from "../lib/cta";
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

// Alignment of the on-image copy block. Overlay text only: nothing is ever rendered below the image.
const POSITION = {
  LEFT: "items-start justify-end text-left sm:justify-center",
  CENTER: "items-center justify-end text-center sm:justify-center",
  RIGHT: "items-end justify-end text-right sm:justify-center",
};

export default function PromoBanners2Up({ promoCards, layout = "FULL", showSubtitle = false }) {
  const cards = (Array.isArray(promoCards) && promoCards.length ? promoCards : DEFAULT_PROMO_CARDS)
    .filter((card) => card.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  if (cards.length === 0) return null;
  const split = layout === "SPLIT" && cards.length > 1;
  return (
    <section data-testid="promo-banners" data-layout={split ? "SPLIT" : "FULL"} className="mx-auto w-full max-w-7xl px-4 sm:px-8">
      <div className={split ? "grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6" : "grid grid-cols-1 gap-4 sm:gap-6"}>
        {cards.map((card, idx) => (
          <Link
            key={card.id || idx}
            to={card.ctaUrl || "/shop"}
            data-testid="promo-banner"
            className={`group relative block w-full overflow-hidden rounded-2xl store-surface ${split ? "aspect-[4/5] md:aspect-[4/5] lg:aspect-[5/6]" : "aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]"}`}
          >
            <picture>
              {card.mobileImage && <source media="(max-width: 767px)" srcSet={resolveMediaUrl(card.mobileImage)} />}
              <img
                src={resolveMediaUrl(card.image)}
                alt={card.imageAlt || card.title}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.03]"
              />
            </picture>
            <div data-testid="promo-banner-overlay" data-align={card.textAlign || "LEFT"} className={`absolute inset-0 flex flex-col bg-gradient-to-t ${BANNER_OVERLAY_CLASSES[card.overlayStrength] || BANNER_OVERLAY_CLASSES.MEDIUM} px-6 py-8 sm:px-12 lg:px-20 ${POSITION[card.textAlign] || POSITION.LEFT} text-white [text-shadow:0_1px_20px_rgba(0,0,0,0.4)]`}>
              {card.eyebrow && (
                <span className="mb-3 text-[11px] font-medium uppercase tracking-[0.3em] text-white/90">{card.eyebrow}</span>
              )}
              {card.title && (
                <h3 className="max-w-xl font-serif-display text-3xl font-light leading-[1.1] tracking-[-0.01em] text-balance text-white sm:text-4xl lg:text-5xl">{card.title}</h3>
              )}
              {showSubtitle && card.subtitle && (
                <p data-testid="promo-banner-subtitle" className="mt-3 line-clamp-2 max-w-sm text-sm font-light leading-relaxed text-white/85">{card.subtitle}</p>
              )}
              <span
                data-testid="promo-banner-cta"
                className="mt-6 inline-flex items-center gap-3 border border-white/85 px-7 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-white transition-colors group-hover:bg-white group-hover:text-charcoal"
              >
                {ctaLabel(card.ctaLabel, "Shop Now")}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">&rarr;</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
