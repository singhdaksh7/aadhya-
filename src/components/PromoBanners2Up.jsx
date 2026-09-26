import React from "react";
import { Link } from "react-router-dom";

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

export default function PromoBanners2Up({ promoCards = DEFAULT_PROMO_CARDS }) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-8 py-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {promoCards.map((card, idx) => (
          <Link
            key={idx}
            to={card.ctaUrl || "/shop"}
            className="group relative overflow-hidden rounded-2xl border border-charcoal/10 aspect-[16/9] sm:aspect-[2/1] bg-[#FAF6F0] block shadow-sm hover:shadow-lg transition-all duration-300"
          >
            {/* Background Image */}
            <img
              src={card.image}
              alt={card.title}
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
            {/* Subtle Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/30 to-transparent p-6 sm:p-8 flex flex-col justify-end text-white">
              <span className="text-xs font-semibold uppercase tracking-widest text-terracotta-light">
                Curated Edit
              </span>
              <h3 className="font-serif-display text-2xl sm:text-3xl text-white mt-1">
                {card.title}
              </h3>
              <p className="text-xs sm:text-sm text-white/90 mt-1">
                {card.subtitle}
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white group-hover:text-terracotta-light transition-colors">
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
