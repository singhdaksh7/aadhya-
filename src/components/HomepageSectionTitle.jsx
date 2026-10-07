import React from "react";
import { Link } from "react-router-dom";

const safePath = (value, fallback) =>
  typeof value === "string" && (value.startsWith("/") || /^https?:\/\//i.test(value)) ? value : fallback;

/**
 * Shared homepage section title: eyebrow, heading, optional subtitle.
 * CENTER (default for rails/reviews/blog) keeps a restrained max-width so text never runs wide
 * on desktop and stays centered on mobile; LEFT is the legacy editorial layout.
 */
export default function HomepageSectionTitle({ eyebrow, title, subtitle, align = "CENTER", className = "" }) {
  const center = align !== "LEFT";
  return (
    <div data-testid="section-title" data-align={center ? "CENTER" : "LEFT"} className={`${center ? "mx-auto flex max-w-2xl flex-col items-center text-center" : ""} ${className}`}>
      {eyebrow && <span className="text-xs font-semibold uppercase tracking-[0.2em] store-primary">{eyebrow}</span>}
      <h2 className="mt-2 font-serif-display text-3xl font-bold leading-tight store-text text-balance sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 max-w-xl text-sm leading-relaxed store-muted sm:text-base">{subtitle}</p>}
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
