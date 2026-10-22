import React from "react";
import { TRUST_COLUMN_CLASSES, TRUST_MOBILE_CLASSES } from "../lib/homepageConfig";

const FALLBACK_ITEMS = [
  { id: "trust-1", icon: "sparkles", title: "Thoughtfully Curated", description: "Home and lifestyle pieces chosen for texture and everyday use" },
  { id: "trust-2", icon: "badge", title: "Clear Product Details", description: "Materials, dimensions and care are listed on every product page" },
  { id: "trust-3", icon: "home", title: "Styles for Every Space", description: "Proportions tailored for modern and traditional homes" },
  { id: "trust-4", icon: "shield", title: "Secure Payments", description: "Encrypted checkout, with cash on delivery on eligible orders" },
];

export function TrustIcon({ name, className = "h-6 w-6" }) {
  const paths = {
    sparkles: "M5 3v4M3 5h4m9-2 2.286 6.857L24 12l-5.714 2.143L16 21l-2.286-6.857L8 12l5.714-2.143L16 3z",
    badge: "M9 12l2 2 4-4M7.8 4.7a3.4 3.4 0 004.4-.8 3.4 3.4 0 014.4 0 3.4 3.4 0 001.9.8 3.4 3.4 0 013.1 3.1 3.4 3.4 0 00.8 1.9 3.4 3.4 0 010 4.4 3.4 3.4 0 00-.8 1.9 3.4 3.4 0 01-3.1 3.1 3.4 3.4 0 00-1.9.8 3.4 3.4 0 01-4.4 0 3.4 3.4 0 00-1.9-.8 3.4 3.4 0 01-3.1-3.1 3.4 3.4 0 00-.8-1.9 3.4 3.4 0 010-4.4 3.4 3.4 0 00.8-1.9 3.4 3.4 0 013.1-3.1z",
    home: "M3 12l9-9 9 9v9h-6v-6H9v6H3z",
    shield: "M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3zm-3 9 2 2 4-4",
    leaf: "M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-7 10-16z",
    heart: "M12 21S3 15.5 3 9.5A4.5 4.5 0 0112 8a4.5 4.5 0 019 1.5C21 15.5 12 21 12 21z",
    truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
    return: "M4 9h11a5 5 0 010 10H8M4 9l4-4M4 9l4 4",
    lock: "M6 11h12v9H6zM8 11V8a4 4 0 018 0v3",
    gift: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0",
    star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"
  };
  return (
    <svg aria-hidden="true" className={`${className} store-primary`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d={paths[name] || paths.sparkles} />
    </svg>
  );
}

export default function TrustServiceStrip({ items, config = {} }) {
  const visibleItems = (Array.isArray(items) && items.length ? items : FALLBACK_ITEMS)
    .filter((item) => item.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  if (visibleItems.length === 0) return null;
  const bg = config.background === "PLAIN" ? "store-bg" : "store-surface";
  const mobile = TRUST_MOBILE_CLASSES[config.mobileLayout] || TRUST_MOBILE_CLASSES.STACKED;
  const columns = TRUST_COLUMN_CLASSES[config.desktopColumns] || TRUST_COLUMN_CLASSES[4];

  return (
    <section data-testid="trust-strip" className={`w-full ${bg} py-8 sm:py-12`}>
      <div data-testid="trust-grid" className={`w-full px-4 sm:grid sm:grid-cols-2 sm:px-6 lg:px-10 ${columns} ${mobile} items-start`}>
        {visibleItems.map((item) => (
          <div key={item.id || item.title} data-testid="trust-item" className="flex flex-col items-center px-4 py-5 text-center sm:px-6 sm:py-4">
            <TrustIcon name={item.icon} />
            <h3 className="mt-3 font-serif-display text-[13px] font-normal uppercase tracking-[0.18em] store-text">{item.title}</h3>
            <p className="mt-1.5 max-w-[16rem] text-xs font-light leading-relaxed store-muted">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
