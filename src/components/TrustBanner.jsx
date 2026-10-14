import React, { useState } from "react";
import { TrustIcon } from "./TrustServiceStrip";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { commercialContext, hasUnresolvedPlaceholder, interpolateCommercial } from "../lib/commercialText";
import { resolveMediaUrl } from "../lib/api";

const DEFAULT_BG = "#F6EFE3";
const HEX = /^#[0-9a-fA-F]{6}$/;
const MOBILE_LAYOUTS = {
  // Horizontal swipe row on phones, grid from the `sm` breakpoint up.
  SCROLL: "flex gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-5 px-5 pb-1 sm:mx-0 sm:px-0 sm:pb-0",
  STACKED: "grid grid-cols-1 gap-3",
};
const VISIBILITY = { both: "flex", mobile: "flex sm:hidden", desktop: "hidden sm:flex" };

// Dark custom backgrounds flip the copy to white so the banner stays legible.
function isDark(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

// An uploaded icon that fails to load falls back to the built-in glyph instead of a broken image.
function ItemIcon({ item }) {
  const [broken, setBroken] = useState(false);
  const src = item.iconImage ? resolveMediaUrl(item.iconImage) : "";
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/60">
      {src && !broken
        ? <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-6 w-6 object-contain" />
        : <TrustIcon name={item.icon} />}
    </span>
  );
}

function Summary({ config, dark }) {
  const [broken, setBroken] = useState(false);
  const score = Number(config.reviewScore) > 0 ? Number(config.reviewScore) : null;
  const count = Number(config.reviewCount) > 0 ? Number(config.reviewCount) : null;
  const logo = config.summaryIcon && !broken ? resolveMediaUrl(config.summaryIcon) : "";
  const source = (config.reviewSource || "").trim();
  const title = (config.summaryTitle || "").trim();
  if (!title && !score && !count && !source && !logo) return null;
  const muted = dark ? "text-white/75" : "store-muted";
  return (
    <div data-testid="trust-banner-summary" className="flex shrink-0 items-center gap-3 border-b border-current/10 pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
      {logo && <img src={logo} alt="" aria-hidden="true" loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-10 max-w-[96px] object-contain" />}
      <div className="min-w-0">
        {title && <p className="font-serif-display text-base leading-tight">{title}</p>}
        {(score || count) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm font-semibold">
            {score && <><TrustIcon name="star" className="h-4 w-4" /><span data-testid="trust-banner-score">{score.toFixed(1)}</span></>}
            {count && <span data-testid="trust-banner-count" className={`font-normal ${muted}`}>({count.toLocaleString("en-IN")} reviews)</span>}
          </p>
        )}
        {source && <p className={`mt-0.5 text-xs ${muted}`}>{source}</p>}
      </div>
    </div>
  );
}

export default function TrustBanner({ config = {} }) {
  const ctx = commercialContext(useSiteSettings());
  const bg = HEX.test(config.backgroundColor || "") ? config.backgroundColor : DEFAULT_BG;
  const dark = isDark(bg);

  const items = (Array.isArray(config.items) ? config.items : [])
    .filter((item) => item.enabled !== false)
    .map((item) => {
      const mobile = item.showOnMobile !== false;
      const desktop = item.showOnDesktop !== false;
      if (!mobile && !desktop) return null;
      // A message built on a setting that is not configured is dropped rather than shown half-written.
      if (hasUnresolvedPlaceholder(item.title, ctx) || hasUnresolvedPlaceholder(item.description, ctx)) return null;
      const title = interpolateCommercial(item.title, ctx).trim();
      if (!title) return null;
      return { ...item, title, description: interpolateCommercial(item.description, ctx).trim(), visibility: VISIBILITY[mobile && desktop ? "both" : mobile ? "mobile" : "desktop"] };
    })
    .filter(Boolean)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const showSummary = config.showSummary !== false;
  const hasSummary = showSummary && ((config.summaryTitle || "").trim() || Number(config.reviewScore) > 0 || Number(config.reviewCount) > 0 || (config.reviewSource || "").trim() || config.summaryIcon);
  if (!hasSummary && items.length === 0) return null;

  const bgImage = config.backgroundImage ? resolveMediaUrl(config.backgroundImage) : "";
  const style = {
    backgroundColor: bg,
    borderRadius: `${Number.isFinite(config.borderRadius) ? config.borderRadius : 24}px`,
    "--tb-pad-m": `${config.paddingMobile ?? 24}px`,
    "--tb-pad-d": `${config.paddingDesktop ?? 40}px`,
  };

  return (
    <section data-testid="trust-banner" className="mx-auto mt-4 max-w-7xl px-4 sm:mt-6 sm:px-8">
      <div style={style} className={`relative overflow-hidden ${dark ? "text-white" : "store-text"}`}>
        {bgImage && <TextureImage src={bgImage} opacity={config.backgroundImageOpacity ?? 30} />}
        <div className="relative flex flex-col gap-4 px-5 py-[var(--tb-pad-m)] sm:px-8 sm:py-[var(--tb-pad-d)] lg:flex-row lg:items-center lg:gap-8">
          {hasSummary && <Summary config={config} dark={dark} />}
          {items.length > 0 && (
            <ul data-testid="trust-banner-items" className={`${MOBILE_LAYOUTS[config.mobileLayout] || MOBILE_LAYOUTS.SCROLL} min-w-0 list-none sm:grid sm:overflow-visible sm:grid-cols-2 sm:gap-x-6 sm:gap-y-4 lg:flex-1 lg:grid-cols-[repeat(auto-fit,minmax(11.5rem,1fr))]`}>
              {items.map((item) => (
                <li key={item.id || item.title} data-testid="trust-banner-item" className={`${item.visibility} min-w-[15rem] shrink-0 snap-start items-start gap-3 sm:min-w-0 sm:shrink`}>
                  <ItemIcon item={item} />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold leading-tight">{item.title}</h3>
                    {item.description && <p className={`mt-1 text-xs leading-snug ${dark ? "text-white/75" : "store-muted"}`}>{item.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// Decorative texture; removed entirely if the image cannot load.
function TextureImage({ src, opacity }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" onError={() => setBroken(true)} style={{ opacity: Math.min(100, Math.max(0, opacity)) / 100 }} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />;
}
