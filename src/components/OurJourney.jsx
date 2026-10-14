import React, { useState } from "react";
import HomepageSectionTitle from "./HomepageSectionTitle";
import { resolveMediaUrl } from "../lib/api";

const ICON_PATHS = {
  sparkles: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z",
  badge: "M12 3l2.4 2.1 3.2-.2.9 3.1 2.6 1.9-1.1 3 1.1 3-2.6 1.9-.9 3.1-3.2-.2L12 21l-2.4-2.1-3.2.2-.9-3.1L3 14.1l1.1-3L3 8.1l2.6-1.9.9-3.1 3.2.2L12 3z",
  home: "M4 11l8-7 8 7v9H4v-9zM10 20v-6h4v6",
  shield: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z",
  leaf: "M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19c3-5 6-8 10-10",
  heart: "M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z",
};

function Glyph({ name }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

// Images that fail to load are removed rather than leaving a broken icon.
function SafeImage({ src, alt = "", className }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return null;
  return <img src={resolveMediaUrl(src)} alt={alt} loading="lazy" decoding="async" onError={() => setBroken(true)} className={className} />;
}

const visibleMilestones = (list) =>
  (Array.isArray(list) ? list : [])
    .filter((m) => m && m.enabled !== false && (m.title || "").trim())
    .map((m, i) => ({ ...m, _i: i }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a._i - b._i);

/**
 * Vertical timeline of admin-managed milestones. Single spine on mobile; alternating sides from `md`.
 * Static by design (no animation), so it is inherently reduced-motion safe. Renders nothing when
 * there are no enabled milestones.
 */
export default function OurJourney({ config = {} }) {
  const items = visibleMilestones(config.milestones);
  if (items.length === 0) return null;
  const surface = config.background === "SURFACE";
  return (
    <section data-testid="our-journey" aria-label={config.title || "Our journey"} className={`mx-auto max-w-5xl px-4 sm:px-8 ${surface ? "rounded-3xl py-10 store-surface sm:py-14" : ""}`}>
      {(config.title || config.eyebrow || config.subtitle) && <HomepageSectionTitle eyebrow={config.eyebrow} title={config.title} subtitle={config.subtitle} />}
      <SafeImage src={config.image} alt={config.imageAlt || ""} className="mx-auto mt-8 max-h-64 w-full max-w-3xl rounded-2xl object-cover" />
      <ol data-testid="journey-list" className="relative mt-10 space-y-8 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-[var(--theme-primary,#8a5a44)]/30 md:space-y-10 md:before:left-1/2">
        {items.map((m, idx) => {
          const left = idx % 2 === 0;
          return (
            <li key={m.id || idx} data-testid="journey-item" className="relative pl-12 md:grid md:grid-cols-2 md:pl-0">
              <span aria-hidden="true" className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--theme-primary,#8a5a44)] bg-white store-primary md:left-1/2 md:-translate-x-1/2">
                {m.icon ? <Glyph name={m.icon} /> : <span className="h-2 w-2 rounded-full bg-[var(--theme-primary,#8a5a44)]" />}
              </span>
              <div className={`min-w-0 ${left ? "md:pr-12 md:text-right" : "md:col-start-2 md:pl-12"}`}>
                {m.date && <p className="text-[11px] font-semibold uppercase tracking-[0.25em] store-primary">{m.date}</p>}
                <h3 className="mt-1 font-serif-display text-xl leading-snug store-text break-words">{m.title}</h3>
                {m.description && <p className="mt-2 text-sm leading-relaxed store-muted break-words">{m.description}</p>}
                <SafeImage src={m.image} alt={m.imageAlt || ""} className={`mt-3 h-40 w-full max-w-xs rounded-xl object-cover ${left ? "md:ml-auto" : ""}`} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
