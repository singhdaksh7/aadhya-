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

// Autoplay is skipped for visitors who asked for reduced motion or Save-Data; they get a play button instead.
const autoplayAllowed = () => {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return false;
  return navigator.connection?.saveData !== true;
};

function ReelCard({ reel, soundOn, onSound, onShop }) {
  const cardRef = useRef(null);
  const videoRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(autoplayAllowed); // false => wait for an explicit tap
  const title = reel.title || "Reel";
  const products = reel.products || [];
  const cover = reel.coverImage ? resolveMediaUrl(reel.coverImage) : "";
  const playable = Boolean(reel.videoUrl);
  const muted = !soundOn;
  const playing = inView && started && !paused;

  // The video element only exists once the card has actually scrolled into view (no eager downloads),
  // plays while at least 40% visible and pauses when it leaves the screen.
  useEffect(() => {
    if (!playable || typeof IntersectionObserver === "undefined" || !cardRef.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      const visible = Boolean(entry) && entry.intersectionRatio >= 0.4;
      setInView(visible);
      if (visible) setLoaded(true);
    }, { threshold: [0, 0.4, 0.75] });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [playable]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (playing) video.play?.()?.catch?.(() => setPaused(true)); // browser refused autoplay: show the play button
    else video.pause?.();
  }, [playing, muted, loaded]);

  const toggle = () => {
    setLoaded(true);
    if (!started) { setStarted(true); setPaused(false); } else setPaused((current) => !current);
  };

  const single = products.length === 1;
  const cta = reel.ctaLabel || "Shop Now";
  // Same premium treatment as the hero banner button: solid brand block, white spaced caps, square corners.
  const ctaCls = "pointer-events-auto mt-3 flex w-full items-center justify-center border border-transparent store-bg-primary px-4 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-white shadow-lg transition store-primary-hover";

  return (
    <article ref={cardRef} data-testid="reel-card" className="w-[64%] shrink-0 snap-start sm:w-[36%] md:w-[26%] lg:w-[19.2%]">
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl store-surface">
        {cover ? <img src={cover} alt={reel.title ? `${reel.title} cover` : ""} loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : <div data-testid="reel-fallback" aria-hidden="true" className="absolute inset-0 flex items-center justify-center store-muted"><svg viewBox="0 0 24 24" className="h-10 w-10 opacity-40" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></div>}
        {playable && loaded && (
          <video ref={videoRef} data-testid="reel-video" src={resolveMediaUrl(reel.videoUrl)} poster={cover || undefined} muted loop playsInline autoPlay={started && playing} preload="metadata" aria-label={title} className="absolute inset-0 h-full w-full object-cover" />
        )}
        {playable && (
          <button type="button" onClick={toggle} aria-label={playing ? `Pause ${title}` : `Play ${title}`} aria-pressed={playing} className="absolute inset-0 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px]">
            {!playing && <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/85 text-charcoal shadow-md"><svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>}
          </button>
        )}
        {playable && loaded && (
          <button type="button" onClick={onSound} aria-label={muted ? "Turn sound on" : "Turn sound off"} className="absolute right-3 top-3 z-10 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white">{muted ? "Sound off" : "Sound on"}</button>
        )}
        {(reel.title || single || products.length > 1) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-3 pt-14 text-white">
            {reel.title && <h3 className="line-clamp-2 text-sm font-medium leading-snug drop-shadow">{reel.title}</h3>}
            {single && <Link to={productPath(products[0])} className={ctaCls}>{cta}</Link>}
            {products.length > 1 && <button type="button" onClick={onShop} aria-haspopup="dialog" className={ctaCls}>{cta}</button>}
          </div>
        )}
      </div>
    </article>
  );
}

export default function ShoppableReels({ section }) {
  const s = section?.settings || {};
  const reels = (Array.isArray(s.reels) ? s.reels : []).filter(isLive);
  const scrollRef = useRef(null);
  const [soundId, setSoundId] = useState(null); // only one reel is ever unmuted
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
            return <ReelCard key={id} reel={{ ...reel, products: reel.products || [] }} soundOn={soundId === id} onSound={() => setSoundId((current) => (current === id ? null : id))} onShop={() => setTrayReel(reel)} />;
          })}
        </div>
        {s.showArrows !== false && <button type="button" aria-label="Next reels" onClick={() => slide(1)} className={`${arrow} -right-3`}>&rarr;</button>}
      </div>
      {trayReel && <ShopTray reel={{ ...trayReel, products: trayReel.products || [] }} onClose={closeTray} />}
    </section>
  );
}
