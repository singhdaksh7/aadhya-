import React, { useEffect } from "react";
import { resolveMediaUrl } from "../lib/api";
import NavAnchor from "./NavAnchor";

/**
 * Editorial promo card shown on the right side of a mega menu.
 * `viewport="mobile"` (admin preview) uses the mobile image directly instead of the media query.
 */
export function MegaPromoCard({ promo, onClose = () => {}, viewport = null }) {
  const mobile = viewport === "mobile";
  const src = resolveMediaUrl(mobile ? promo.mobileImage || promo.image : promo.image);
  return (
    <div className="col-span-4 pl-6 border-l store-border" data-testid="mega-promo" data-viewport={viewport || undefined}>
      <NavAnchor
        to={promo.ctaUrl}
        external={/^(https?:)?\/\//i.test(promo.ctaUrl)}
        onClick={onClose}
        className="group block overflow-hidden rounded-xl store-surface border store-border p-3.5 transition hover:shadow-md"
      >
        {promo.image && (
          <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-stone-100 mb-3">
            <picture>
              {!mobile && promo.mobileImage && <source media="(max-width: 767px)" srcSet={resolveMediaUrl(promo.mobileImage)} />}
              <img src={src} alt={promo.altText} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            </picture>
          </div>
        )}
        {promo.eyebrow && <span className="text-[10px] font-bold uppercase tracking-widest store-secondary block">{promo.eyebrow}</span>}
        {promo.title && <h5 className="font-serif-display text-sm font-bold store-text group-hover:store-primary transition mt-0.5">{promo.title}</h5>}
        {promo.description && <p className="text-[11px] store-muted line-clamp-2 mt-1 leading-relaxed">{promo.description}</p>}
        {promo.ctaLabel && (
          <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider store-primary group-hover:underline">{promo.ctaLabel}</span>
        )}
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
