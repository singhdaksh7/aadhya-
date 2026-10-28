import React, { useState } from "react";
import { resolveMediaUrl } from "../lib/api";

const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_ITEMS = 8;

// Minimal outline glyphs (same set and style as the trust strip icons).
export const HOW_WE_WORK_ICON_PATHS = {
  sparkles: "M5 3v4M3 5h4m9-2 2.286 6.857L24 12l-5.714 2.143L16 21l-2.286-6.857L8 12l5.714-2.143L16 3z",
  badge: "M9 12l2 2 4-4M12 3l2.4 1.8 3 .1.9 2.9 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-.9 2.9-3 .1L12 21l-2.4-1.8-3-.1-.9-2.9L3.3 14.4l.9-2.9-.9-2.9 2.4-1.8.9-2.9 3-.1z",
  home: "M3 12l9-9 9 9v9h-6v-6H9v6H3z",
  shield: "M12 3l8 3v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3zm-3 9 2 2 4-4",
  leaf: "M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-7 10-16z",
  heart: "M12 21S3 15.5 3 9.5A4.5 4.5 0 0112 8a4.5 4.5 0 019 1.5C21 15.5 12 21 12 21z",
};

function isDark(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 < 0.5;
}

function ItemIcon({ item }) {
  const [broken, setBroken] = useState(false);
  const src = item.iconImage ? resolveMediaUrl(item.iconImage) : "";
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-current/15">
      {src && !broken
        ? <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-5 w-5 object-contain" />
        : <svg aria-hidden="true" className="h-5 w-5 store-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25} d={HOW_WE_WORK_ICON_PATHS[item.icon] || HOW_WE_WORK_ICON_PATHS.sparkles} /></svg>}
    </span>
  );
}

export default function HowWeWork({ config = {} }) {
  const [imageBroken, setImageBroken] = useState(false);
  const items = (Array.isArray(config.items) ? config.items : [])
    .filter((item) => item && item.enabled !== false && (item.title || "").trim())
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .slice(0, MAX_ITEMS);
  const title = (config.title || "").trim();
  if (items.length === 0 && !title) return null;

  const custom = config.background === "CUSTOM" && HEX.test(config.backgroundColor || "");
  const dark = custom && isDark(config.backgroundColor);
  const bgClass = custom ? "" : config.background === "PLAIN" ? "store-bg" : "store-surface";
  const radius = Number.isFinite(config.borderRadius) ? config.borderRadius : 24;
  const showBorder = config.showBorder !== false;
  const style = {
    borderRadius: `${radius}px`,
    ...(custom ? { backgroundColor: config.backgroundColor } : {}),
    ...(showBorder ? { borderWidth: 1, borderStyle: "solid", ...(HEX.test(config.borderColor || "") ? { borderColor: config.borderColor } : {}) } : {}),
  };
  const imageSrc = config.image && !imageBroken ? resolveMediaUrl(config.image) : "";
  const position = config.imagePosition === "LEFT" ? "LEFT" : "RIGHT";
  const muted = dark ? "text-white/75" : "store-muted";
  const eyebrow = (config.eyebrow || "").trim();
  const subtitle = (config.subtitle || "").trim();

  return (
    <section data-testid="how-we-work" data-image-position={position} className="mx-auto max-w-7xl px-4 sm:px-8">
      <div style={style} className={`overflow-hidden ${showBorder && !HEX.test(config.borderColor || "") ? "store-border" : ""} ${bgClass} ${dark ? "text-white" : "store-text"} ${imageSrc ? "grid lg:grid-cols-2" : ""}`}>
        {/* DOM order is heading, points, image so phones read top to bottom in that order. */}
        <div data-testid="how-we-work-content" className={`min-w-0 p-6 sm:p-10 lg:p-14 ${imageSrc ? (position === "LEFT" ? "lg:order-2" : "lg:order-1") : ""}`}>
          {eyebrow && <span className="text-xs font-semibold uppercase tracking-widest store-primary">{eyebrow}</span>}
          {title && <h2 className="mt-2 font-serif-display text-3xl font-normal leading-tight sm:text-4xl">{title}</h2>}
          {subtitle && <p className={`mt-3 max-w-xl text-sm leading-relaxed ${muted}`}>{subtitle}</p>}
          {items.length > 0 && (
            <ol data-testid="how-we-work-items" className="mt-8 list-none divide-y divide-current/10">
              {items.map((item) => (
                <li key={item.id || item.title} data-testid="how-we-work-item" className="flex items-start gap-4 py-5 first:pt-0 last:pb-0">
                  <ItemIcon item={item} />
                  <div className="min-w-0">
                    <h3 className="font-serif-display text-lg leading-snug">{item.title}</h3>
                    {item.description && <p className={`mt-1 text-sm leading-relaxed ${muted}`}>{item.description}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
        {imageSrc && (
          <div data-testid="how-we-work-image" className={`relative min-h-[240px] overflow-hidden sm:min-h-[320px] lg:min-h-0 ${position === "LEFT" ? "lg:order-1" : "lg:order-2"}`}>
            {/* Absolutely positioned so the picture never sets the row height: on desktop the card is exactly as tall as the text and the image fills that height. */}
            <img src={imageSrc} alt={config.imageAlt || ""} loading="lazy" decoding="async" onError={() => setImageBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
          </div>
        )}
      </div>
    </section>
  );
}
