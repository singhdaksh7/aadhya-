import React, { useEffect } from "react";
import { resolveMediaUrl } from "../lib/api";
import NavAnchor from "./NavAnchor";
import { ctaLabel } from "../lib/cta";

/**
 * Editorial promo card shown on the right side of a mega menu.
 * `viewport="mobile"` (admin preview) uses the mobile image directly instead of the media query.
 */
export function MegaPromoCard({ promo, onClose = () => {}, viewport = null }) {
  const mobile = viewport === "mobile";
  const src = resolveMediaUrl(mobile ? promo.mobileImage || promo.image : promo.image);
  const label = ctaLabel(promo.ctaLabel);
  // Editorial banner language: the image is the surface; eyebrow, title and CTA sit on top of it.
  // No separate text block, panel or border around the card.
  return (
    <div className="col-span-4" data-testid="mega-promo" data-viewport={viewport || undefined}>
      <NavAnchor
        to={promo.ctaUrl}
        external={/^(https?:)?\/\//i.test(promo.ctaUrl)}
        onClick={onClose}
        className="group relative block aspect-[4/5] w-full overflow-hidden rounded-xl bg-charcoal"
      >
        {promo.image && (
          <picture>
            {!mobile && promo.mobileImage && <source media="(max-width: 767px)" srcSet={resolveMediaUrl(promo.mobileImage)} />}
            <img src={src} alt={promo.altText} className="absolute inset-0 h-full w-full object-cover transition duration-[1200ms] ease-out group-hover:scale-[1.04]" />
          </picture>
        )}
        <div data-testid="mega-promo-overlay" className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-charcoal/75 via-charcoal/20 to-transparent p-5 text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.35)]">
          {promo.eyebrow && <span className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/90">{promo.eyebrow}</span>}
          {promo.title && <h5 className="mt-1.5 font-serif-display text-2xl font-light leading-tight text-white">{promo.title}</h5>}
          {promo.description && <p className="mt-1.5 line-clamp-2 text-[11px] font-light leading-relaxed text-white/85">{promo.description}</p>}
          {label && (
            <span data-testid="mega-promo-cta" className="mt-4 inline-flex w-fit items-center gap-2 border border-white/85 px-5 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white transition-colors group-hover:bg-white group-hover:text-charcoal">
              {label}<span aria-hidden="true">&rarr;</span>
            </span>
          )}
        </div>
      </NavAnchor>
    </div>
  );
}

/**
 * Presentational mega menu. Receives a normalized nav item (see lib/navModel.js):
 * `item.columns` and optional `item.promo`. Contains no data fetching.
 */
export default function MegaMenu({ item, isOpen, onClose, id, maxColumns = 4, width = "full" }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item || !Array.isArray(item.columns) || item.columns.length === 0) return null;

  const promo = item.promo;
  const isFullWidth = width !== "contained";
  const colCount = Math.max(1, Math.min(maxColumns, item.columns.length));

  return (
    <div
      id={id}
      role="region"
      aria-label={`${item.label} menu`}
      data-testid="mega-menu"
      className="absolute left-0 right-0 top-full z-50 w-full store-bg border-b store-border shadow-xl"
    >
      <div className={`mx-auto ${isFullWidth ? "max-w-7xl" : "max-w-5xl"} px-8 py-8`}>
        <div className="grid grid-cols-12 gap-8 items-start">
          <div
            className={promo ? "col-span-8 grid gap-6" : "col-span-12 grid gap-6"}
            style={{ gridTemplateColumns: `repeat(${promo ? Math.min(colCount, 3) : colCount}, minmax(0, 1fr))` }}
          >
            {item.columns.map((col) => (
              <div key={col.id} className="space-y-3">
                {col.title && (
                  <h4 className="text-xs font-bold uppercase tracking-widest store-primary font-serif-display border-b store-border pb-2">
                    {col.to ? (
                      <NavAnchor to={col.to} onClick={onClose} className="hover:underline">
                        {col.title}
                      </NavAnchor>
                    ) : (
                      col.title
                    )}
                  </h4>
                )}
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link.id}>
                      <NavAnchor
                        to={link.to}
                        external={link.external}
                        openInNewTab={link.openInNewTab}
                        onClick={onClose}
                        className="text-xs store-text hover:store-primary transition font-medium block py-0.5"
                      >
                        {link.label}
                      </NavAnchor>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {promo && <MegaPromoCard promo={promo} onClose={onClose} />}
        </div>
      </div>
    </div>
  );
}
