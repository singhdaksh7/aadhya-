import React from "react";
import { Link } from "react-router-dom";

const safePath = (value, fallback) =>
  typeof value === "string" && (value.startsWith("/") || /^https?:\/\//i.test(value)) ? value : fallback;

/** Hairline-and-leaf flourish used on either side of centered headings. `flip` mirrors it for the right side. */
function Flourish({ flip = false }) {
  return (
    <svg data-testid="heading-ornament" aria-hidden="true" viewBox="0 0 120 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className={`h-3 w-9 shrink-0 store-primary opacity-70 min-[400px]:w-14 sm:w-24 ${flip ? "-scale-x-100" : ""}`}>
      <path d="M0 6h82" />
      <path d="M82 6c6-5 12-5 16 0-4 5-10 5-16 0z" />
      <path d="M102 6c4-3 8-3 12-3M102 6c4 3 8 3 12 3" />
      <circle cx="118" cy="6" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Shared homepage section title: eyebrow, heading flanked by flourishes, optional subtitle.
 * CENTER (default for rails/reviews/blog/looks) keeps a restrained max-width so text never runs wide
 * on desktop and stays centered on mobile; LEFT is the legacy editorial layout (no ornaments).
 */
export default function HomepageSectionTitle({ eyebrow, title, subtitle, align = "CENTER", className = "" }) {
  const center = align !== "LEFT";
  return (
    <div data-testid="section-title" data-align={center ? "CENTER" : "LEFT"} className={`${center ? "mx-auto flex max-w-2xl flex-col items-center text-center" : ""} ${className}`}>
      {eyebrow && <span className="text-[11px] font-medium uppercase tracking-[0.3em] store-primary">{eyebrow}</span>}
      <div className={`mt-3 flex w-full items-center ${center ? "justify-center gap-3 sm:gap-5" : ""}`}>
        {center && <Flourish />}
        <h2 className="font-serif-display text-2xl font-normal leading-[1.15] tracking-tight store-text text-balance sm:text-3xl lg:text-[2.5rem]">{title}</h2>
        {center && <Flourish flip />}
      </div>
      {subtitle && <p className="mt-3 max-w-xl text-sm leading-relaxed store-muted">{subtitle}</p>}
    </div>
  );
}

/** Thin-bordered, restrained section CTA, centered below a rail (or any block). */
export function SectionCta({ to, children, align = "CENTER" }) {
  const href = safePath(to, "/shop");
  const cls = "inline-flex items-center gap-2 rounded-full border store-border px-8 py-3 text-xs font-semibold uppercase tracking-wider store-text transition hover:border-[var(--theme-primary)] hover:store-primary";
  return (
    <div className={`mt-10 flex ${align === "LEFT" ? "justify-start" : "justify-center"}`}>
      {href.startsWith("/") ? (
        <Link to={href} data-testid="section-cta" className={cls}>{children} <span aria-hidden="true">&rarr;</span></Link>
      ) : (
        <a href={href} data-testid="section-cta" className={cls}>{children} <span aria-hidden="true">&rarr;</span></a>
      )}
    </div>
  );
}
