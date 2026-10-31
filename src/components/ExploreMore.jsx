import React, { useState } from "react";
import { Link } from "react-router-dom";
import { resolveMediaUrl } from "../lib/api";
import HomepageSectionTitle from "./HomepageSectionTitle";
import { ctaLabel as cleanCtaLabel } from "../lib/cta";

const MAX_ITEMS = 8;
const safeUrl = (value) => (typeof value === "string" && (value.startsWith("/") || /^https?:\/\//i.test(value)) ? value : "");

export const EXPLORE_MORE_ICON_PATHS = {
  sparkles: "M5 3v4M3 5h4m9-2 2.286 6.857L24 12l-5.714 2.143L16 21l-2.286-6.857L8 12l5.714-2.143L16 3z",
  gift: "M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H8a2.5 2.5 0 110-5c2.5 0 4 5 4 5zm0 0h4a2.5 2.5 0 100-5c-2.5 0-4 5-4 5z",
  tag: "M3 12V3h9l9 9-9 9-9-9zm5-5h.01",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  heart: "M12 21S3 15.5 3 9.5A4.5 4.5 0 0112 8a4.5 4.5 0 019 1.5C21 15.5 12 21 12 21z",
  leaf: "M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-7 10-16z",
  badge: "M9 12l2 2 4-4M12 3l2.4 1.8 3 .1.9 2.9 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-.9 2.9-3 .1L12 21l-2.4-1.8-3-.1-.9-2.9L3.3 14.4l.9-2.9-.9-2.9 2.4-1.8.9-2.9 3-.1z",
  home: "M3 12l9-9 9 9v9h-6v-6H9v6H3z",
};

function CardVisual({ item }) {
  const [broken, setBroken] = useState(false);
  const src = item.image && !broken ? resolveMediaUrl(item.image) : "";
  if (src) {
    return (
      <div className="aspect-[4/3] overflow-hidden store-surface">
        <img src={src} alt={item.imageAlt || ""} loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
      </div>
    );
  }
  return (
    <div className="px-6 pt-6 sm:px-7 sm:pt-7">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border store-border">
        <svg aria-hidden="true" className="h-6 w-6 store-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25} d={EXPLORE_MORE_ICON_PATHS[item.icon] || EXPLORE_MORE_ICON_PATHS.sparkles} /></svg>
      </span>
    </div>
  );
}

function ExploreCard({ item }) {
  const to = safeUrl(item.url);
  const label = cleanCtaLabel(item.ctaLabel, "");
  const inner = (
    <>
      <CardVisual item={item} />
      <div className="flex flex-1 flex-col gap-2 p-6 sm:p-7">
        <h3 className="font-serif-display text-xl store-text sm:text-2xl">{item.title}</h3>
        {item.subtitle && <p className="text-sm leading-relaxed store-muted">{item.subtitle}</p>}
        {label && <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-xs font-semibold uppercase tracking-wider store-primary">{label} <span aria-hidden="true">&rarr;</span></span>}
      </div>
    </>
  );
  const cls = "group flex h-full flex-col overflow-hidden rounded-2xl border store-border store-surface transition hover:shadow-lg";
  if (!to) return <div data-testid="explore-card" className={cls}>{inner}</div>;
  return to.startsWith("/")
    ? <Link to={to} data-testid="explore-card" className={cls}>{inner}</Link>
    : <a href={to} data-testid="explore-card" className={cls}>{inner}</a>;
}

/** Admin-managed "Explore More" discovery cards. Hidden when there are no enabled cards. */
export default function ExploreMore({ config = {} }) {
  const items = (Array.isArray(config.items) ? config.items : [])
    .filter((item) => item && item.enabled !== false && (item.title || "").trim())
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .slice(0, MAX_ITEMS);
  if (items.length === 0) return null;
  const cols = items.length >= 4 ? "lg:grid-cols-4" : items.length === 2 ? "lg:grid-cols-2" : items.length === 1 ? "lg:grid-cols-1" : "lg:grid-cols-3";
  return (
    <section data-testid="explore-more" className="mx-auto max-w-7xl px-4 sm:px-8">
      {(config.title || config.eyebrow || config.subtitle) && <HomepageSectionTitle eyebrow={config.eyebrow} title={config.title} subtitle={config.subtitle} className="mb-10 sm:mb-12" />}
      <div className={`mx-auto grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 ${cols} ${items.length === 1 ? "max-w-md" : ""}`}>
        {items.map((item, index) => <ExploreCard key={item.id || index} item={item} />)}
      </div>
    </section>
  );
}
