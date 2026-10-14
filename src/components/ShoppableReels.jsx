import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import HomepageSectionTitle from "./HomepageSectionTitle";
import { resolveMediaUrl } from "../lib/api";
import { formatInr } from "../lib/format";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
const isLive = (reel) => reel && reel.enabled !== false && reel.published !== false && (reel.videoUrl || reel.coverImage);
const productPath = (product) => `/products/${encodeURIComponent(product.slug || product.id)}`;

/** Accessible "Shop this reel" dialog: focus moves in, Tab is trapped, Escape closes, focus returns to the trigger. */
function ShopTray({ reel, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const nodes = dialogRef.current.querySelectorAll(FOCUSABLE);
      if (!nodes.length) return;
      const first = nodes[0]; const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Shop this reel" data-testid="reel-tray" className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl store-bg shadow-2xl sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between border-b store-border px-5 py-4">
          <div className="min-w-0"><h3 className="font-serif-display text-lg store-text">Shop this reel</h3>{reel.title && <p className="truncate text-xs store-muted">{reel.title}</p>}</div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full border store-border store-text">&times;</button>
        </div>
        <ul className="divide-y store-border overflow-y-auto">
          {reel.products.map((product) => (
            <li key={product.id}>
              <Link to={productPath(product)} onClick={onClose} className="flex items-center gap-4 px-5 py-3 transition hover:opacity-80">
                {product.image ? <img src={resolveMediaUrl(product.image)} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-lg object-cover store-surface" /> : <span aria-hidden="true" className="h-16 w-16 shrink-0 rounded-lg store-surface" />}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium store-text">{product.name}</span>{Number.isFinite(product.price) && <span className="text-xs store-muted">{formatInr(product.price)}</span>}</span>
                <span aria-hidden="true" className="store-primary">&rarr;</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

function ReelCard({ reel, active, onActivate, onDeactivate, onShop }) {
  const cardRef = useRef(null);
  const videoRef = useRef(null);
  const [soundOn, setSoundOn] = useState(false);
  const muted = !(active && soundOn);
  const title = reel.title || "Reel";
  const products = reel.products || [];
  const cover = reel.coverImage ? resolveMediaUrl(reel.coverImage) : "";
  const playable = Boolean(reel.videoUrl);

  // Pause (and unload) the video as soon as the card scrolls out of view.
  useEffect(() => {
    if (!active || typeof IntersectionObserver === "undefined" || !cardRef.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => { if (entry && entry.intersectionRatio < 0.25) onDeactivate(); }, { threshold: [0, 0.25, 0.5] });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [active, onDeactivate]);

  useEffect(() => { if (active) videoRef.current?.play?.()?.catch?.(() => {}); }, [active]);

  const single = products.length === 1;
  const cta = reel.ctaLabel || "Shop Now";
  const ctaCls = "mt-3 inline-flex w-full items-center justify-center rounded-full border store-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider store-text transition hover:border-[var(--theme-primary)] hover:store-primary";

  return (
    <article ref={cardRef} data-testid="reel-card" className="w-[64%] shrink-0 snap-start sm:w-[36%] md:w-[26%] lg:w-[19.2%]">
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl store-surface">
        {cover ? <img src={cover} alt={reel.title ? `${reel.title} cover` : ""} loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : <div data-testid="reel-fallback" aria-hidden="true" className="absolute inset-0 flex items-center justify-center store-muted"><svg viewBox="0 0 24 24" className="h-10 w-10 opacity-40" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></div>}
        {active && playable && (
          <video ref={videoRef} data-testid="reel-video" src={resolveMediaUrl(reel.videoUrl)} poster={cover || undefined} muted={muted} loop playsInline preload="metadata" aria-label={title} className="absolute inset-0 h-full w-full bg-black object-cover" />
        )}
        {playable && (
          <button type="button" onClick={() => { if (active) onDeactivate(); else { setSoundOn(false); onActivate(); } }} aria-label={active ? `Stop ${title}` : `Play ${title}`} aria-pressed={active} className="absolute inset-0 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px]">
            {!active && <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/85 text-charcoal shadow-md"><svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>}
          </button>
        )}
        {active && playable && (
          <button type="button" onClick={() => setSoundOn((on) => !on)} aria-label={muted ? "Turn sound on" : "Turn sound off"} className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white">{muted ? "Sound off" : "Sound on"}</button>
        )}
      </div>
      {reel.title && <h3 className="mt-3 line-clamp-2 text-sm font-medium store-text">{reel.title}</h3>}
      {single && <Link to={productPath(products[0])} className={ctaCls}>{cta}</Link>}
      {products.length > 1 && <button type="button" onClick={onShop} aria-haspopup="dialog" className={ctaCls}>{cta}</button>}
    </article>
  );
}

export default function ShoppableReels({ section }) {
  const s = section?.settings || {};
  const reels = (Array.isArray(s.reels) ? s.reels : []).filter(isLive);
  const scrollRef = useRef(null);
  const [activeId, setActiveId] = useState(null);
  const [trayReel, setTrayReel] = useState(null);
  const closeTray = useCallback(() => setTrayReel(null), []);
  if (reels.length === 0) return null;
  const slide = (dir) => scrollRef.current?.scrollBy?.({ left: dir * scrollRef.current.clientWidth * 0.8, behavior: "smooth" });
  const arrow = "absolute top-[38%] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border store-border store-surface shadow-md md:flex";
  return (
    <section data-testid="shoppable-reels" aria-label={s.title || "Shoppable reels"} className="mx-auto max-w-7xl px-4 sm:px-8">
      <HomepageSectionTitle align="CENTER" eyebrow={s.eyebrow} title={s.title || "Shop Our Reels"} subtitle={s.subtitle} className="mb-8 sm:mb-10" />
      <div className="relative">
        {s.showArrows !== false && <button type="button" aria-label="Previous reels" onClick={() => slide(-1)} className={`${arrow} -left-3`}>&larr;</button>}
        <div ref={scrollRef} className="no-scrollbar flex snap-x gap-4 overflow-x-auto scroll-smooth pb-1 sm:gap-5">
          {reels.map((reel, index) => {
            const id = reel.id || `reel-${index}`;
            return <ReelCard key={id} reel={{ ...reel, products: reel.products || [] }} active={activeId === id} onActivate={() => setActiveId(id)} onDeactivate={() => setActiveId((current) => (current === id ? null : current))} onShop={() => { setActiveId(null); setTrayReel(reel); }} />;
          })}
        </div>
        {s.showArrows !== false && <button type="button" aria-label="Next reels" onClick={() => slide(1)} className={`${arrow} -right-3`}>&rarr;</button>}
      </div>
      {trayReel && <ShopTray reel={{ ...trayReel, products: trayReel.products || [] }} onClose={closeTray} />}
    </section>
  );
}
