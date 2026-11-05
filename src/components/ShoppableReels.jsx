import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import HomepageSectionTitle from "./HomepageSectionTitle";
import { resolveMediaUrl } from "../lib/api";
import { formatInr } from "../lib/format";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
const isLive = (reel) => reel && reel.enabled !== false && reel.published !== false && (reel.videoUrl || reel.coverImage);
const categoryPath = (category) => `/shop/category/${encodeURIComponent(category.slug || category.id)}`;
const productPath = (product) => `/products/${encodeURIComponent(product.slug || product.id)}`;


/** Accessible large playable popup for a reel. Autoplays unmuted (or falls back to muted), traps focus, closes on Esc/backdrop/close button, locks body scroll. */
function ReelModal({ reel, onClose, onShop }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const videoRef = useRef(null);
  const [videoError, setVideoError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const title = reel?.title || "Reel";
  const cover = reel?.coverImage ? resolveMediaUrl(reel.coverImage) : "";
  const videoSrc = reel?.videoUrl ? resolveMediaUrl(reel.videoUrl) : "";
  const products = reel?.products || [];
  const categories = reel?.categories || [];
  const targetCount = products.length + categories.length;
  const single = targetCount === 1;
  const singleHref = single ? (products.length === 1 ? productPath(products[0]) : categoryPath(categories[0])) : "";
  const cta = reel?.ctaLabel || "Shop Now";

  // Lock body scroll while open and restore on unmount
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Trap focus & ESC close
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const nodes = dialogRef.current.querySelectorAll(FOCUSABLE);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  // Handle autoplay with sound, fall back gracefully if browser refuses sound
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;
    video.muted = isMuted;
    const playPromise = video.play?.();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => {
          // If unmuted autoplay was rejected, try muted autoplay
          if (!video.muted) {
            setIsMuted(true);
            video.muted = true;
            video.play?.()
              ?.then(() => setIsPlaying(true))
              ?.catch(() => setIsPlaying(false));
          } else {
            setIsPlaying(false);
          }
        });
    }
    return () => {
      video.pause?.();
    };
  }, [videoSrc, isMuted]);

  const togglePlay = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play?.()?.then(() => setIsPlaying(true))?.catch(() => setIsPlaying(false));
    } else {
      video.pause?.();
      setIsPlaying(false);
    }
  };

  const toggleSound = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  return createPortal(
    <div
      data-testid="reel-modal-backdrop"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="reel-modal"
        className="relative flex flex-col items-center justify-center max-h-[94vh] max-w-full overflow-hidden rounded-2xl bg-black text-white shadow-2xl"
      >
        {/* Close button */}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close reel"
          data-testid="reel-modal-close"
          className="absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Video / Content container: max 85vh, 9/16 vertical aspect ratio */}
        <div className="relative aspect-[9/16] h-[85vh] max-h-[85vh] w-auto max-w-[92vw] overflow-hidden rounded-2xl bg-neutral-900 flex items-center justify-center">
          {videoSrc && !videoError ? (
            <>
              <video
                ref={videoRef}
                data-testid="reel-modal-video"
                src={videoSrc}
                poster={cover || undefined}
                playsInline
                loop
                preload="auto"
                aria-label={title}
                onError={() => setVideoError(true)}
                className="h-full w-full object-cover"
              />
              {/* Play / Pause tap overlay */}
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause modal video" : "Play modal video"}
                className="absolute inset-0 flex items-center justify-center focus-visible:outline-none"
              >
                {!isPlaying && (
                  <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-white/80 text-black shadow-lg">
                    <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                )}
              </button>

              {/* Sound toggle button */}
              <button
                type="button"
                onClick={toggleSound}
                aria-label={isMuted ? "Turn sound on" : "Turn sound off"}
                data-testid="reel-modal-sound"
                className="absolute left-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/85"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
                  {isMuted ? <path d="m16 9 5 6m0-6-5 6" /> : <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>}
                </svg>
              </button>
            </>
          ) : (
            <div data-testid="reel-modal-fallback" className="flex flex-col items-center justify-center p-6 text-center text-neutral-300">
              {cover ? (
                <img src={cover} alt={title} className="absolute inset-0 h-full w-full object-cover" />
              ) : null}
              <div className="relative z-10 rounded-xl bg-black/75 p-5 backdrop-blur-sm">
                <svg viewBox="0 0 24 24" className="mx-auto mb-2 h-10 w-10 text-neutral-400" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <p className="text-sm font-medium">Video preview unavailable</p>
                {title && <p className="mt-1 text-xs text-neutral-400">{title}</p>}
              </div>
            </div>
          )}

          {/* Bottom Title & Action overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-16 text-white">
            {title && <h3 className="line-clamp-2 text-base font-semibold drop-shadow">{title}</h3>}
            {single && (
              <Link
                to={singleHref}
                onClick={onClose}
                className="pointer-events-auto mt-3 flex w-full items-center justify-center border border-white/90 bg-transparent px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white hover:text-black rounded-lg"
              >
                {cta}
              </Link>
            )}
            {targetCount > 1 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onShop?.();
                }}
                className="pointer-events-auto mt-3 flex w-full items-center justify-center border border-white/90 bg-transparent px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white hover:text-black rounded-lg"
              >
                {cta}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

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
          {(reel.categories || []).map((category) => (
            <li key={`c-${category.id}`}>
              <Link to={categoryPath(category)} onClick={onClose} className="flex items-center gap-4 px-5 py-3 transition hover:opacity-80">
                {category.image ? <img src={resolveMediaUrl(category.image)} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-lg object-cover store-surface" /> : <span aria-hidden="true" className="h-16 w-16 shrink-0 rounded-lg store-surface" />}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium store-text">{category.name}</span><span className="text-xs uppercase tracking-wider store-muted">Category</span></span>
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

// Reels are muted, so they autoplay for everyone except visitors on Save-Data, who get a play button instead.
// (Reduced-motion visitors still get playing reels; only the sliding motion below is switched off for them.)
const autoplayAllowed = () => {
  if (typeof window === "undefined") return false;
  return navigator.connection?.saveData !== true;
};

// Compact cards: 5 across on desktop, 4 on tablet, 3 on large phones, about 2 on small phones. With four or more reels
// the row glides right to left, non-stop, like the reviews marquee (a CSS animation, so it never hitches and nothing
// pauses it). Seconds of travel per reel: higher is slower.
const MARQUEE_MIN_REELS = 4;
const SECONDS_PER_REEL = 6;

function ReelCard({ reel, soundOn, onSound, onHover, onSoundDenied, onShop, onOpenModal, clone = false, track = false }) {
  const cardRef = useRef(null);
  const videoRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(autoplayAllowed); // false => wait for an explicit tap
  const title = reel.title || "Reel";
  const products = reel.products || [];
  const categories = reel.categories || [];
  const targetCount = products.length + categories.length;
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
    if (playing) {
      video.play?.()?.catch?.(() => { if (muted) setPaused(true); else onSoundDenied?.(); }); // refused: show the play button, or fall back to silent when sound was refused
    } else video.pause?.();
    if (playing && !muted) {
      // Browsers may pause (without an error) a video they will not let make sound before the visitor has clicked the page.
      const check = setTimeout(() => { if (video.paused) onSoundDenied?.(); }, 250);
      return () => clearTimeout(check);
    }
    return undefined;
  }, [playing, muted, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    setLoaded(true);
    if (!started) { setStarted(true); setPaused(false); } else setPaused((current) => !current);
  };

  const single = targetCount === 1;
  const singleHref = single ? (products.length === 1 ? productPath(products[0]) : categoryPath(categories[0])) : "";
  const cta = reel.ctaLabel || "Shop Now";
  // Outline-only premium button (no fill), matching the hero banner's secondary button: white spaced caps and a thin white border.
  const ctaCls = "pointer-events-auto mt-3 flex w-full items-center justify-center border border-white/80 bg-transparent px-4 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-white transition hover:bg-white hover:text-charcoal";

  return (
    <article ref={cardRef} data-testid={clone ? "reel-card-clone" : "reel-card"} aria-hidden={clone ? "true" : undefined} onPointerEnter={(e) => { if (e.pointerType === "mouse") onHover?.(true); }} onPointerLeave={(e) => { if (e.pointerType === "mouse") onHover?.(false); }} onClick={(e) => { if (!e.target.closest("button, a")) onOpenModal?.(reel); }} className={(track ? "mr-3 w-[calc((100cqw-0.75rem)/2.3)] shrink-0 sm:mr-5 sm:w-[calc((100cqw-2.5rem)/3)] md:w-[calc((100cqw-3.75rem)/4)] lg:mr-6 lg:w-[calc((100cqw-6rem)/5)] motion-reduce:[&[aria-hidden=true]]:hidden" : "w-[calc((100%-0.75rem)/2.3)] shrink-0 sm:w-[calc((100%-2.5rem)/3)] md:w-[calc((100%-3.75rem)/4)] lg:w-[calc((100%-6rem)/5)]") + " cursor-pointer"}>
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl store-surface">
        {cover ? <img src={cover} alt={reel.title ? `${reel.title} cover` : ""} loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : <div data-testid="reel-fallback" aria-hidden="true" className="absolute inset-0 flex items-center justify-center store-muted"><svg viewBox="0 0 24 24" className="h-10 w-10 opacity-40" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></div>}
        {playable && loaded && (
          <video ref={videoRef} data-testid="reel-video" src={resolveMediaUrl(reel.videoUrl)} poster={cover || undefined} muted loop playsInline autoPlay={started && playing} preload={cover && !started && !loaded ? "none" : "metadata"} aria-label={title} className="absolute inset-0 h-full w-full object-cover" />
        )}
        {playable && (
          <button type="button" tabIndex={clone ? -1 : undefined} onClick={() => { toggle(); onOpenModal?.(reel); }} aria-label={playing ? `Pause ${title}` : `Play ${title}`} aria-pressed={playing} data-testid="reel-card-trigger" className="absolute inset-0 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] cursor-pointer">
            {!playing && <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/85 text-charcoal shadow-md"><svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>}
          </button>
        )}
        {playable && loaded && (
          <button type="button" tabIndex={clone ? -1 : undefined} onClick={onSound} aria-label={muted ? "Turn sound on" : "Turn sound off"} className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
              {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>}
            </svg>
          </button>
        )}
        {(reel.title || targetCount > 0) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-3 pt-14 text-white">
            {reel.title && <h3 className="line-clamp-2 text-sm font-medium leading-snug drop-shadow">{reel.title}</h3>}
            {single && <Link to={singleHref} tabIndex={clone ? -1 : undefined} className={ctaCls}>{cta}</Link>}
            {targetCount > 1 && <button type="button" tabIndex={clone ? -1 : undefined} onClick={onShop} aria-haspopup="dialog" className={ctaCls}>{cta}</button>}
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
  const [modalReel, setModalReel] = useState(null);
  const closeModal = useCallback(() => setModalReel(null), []);
  const closeTray = useCallback(() => setTrayReel(null), []);
  const count = reels.length;
  const marquee = count >= MARQUEE_MIN_REELS;

  if (count === 0) return null;
  const slide = (dir) => scrollRef.current?.scrollBy?.({ left: dir * scrollRef.current.clientWidth * 0.8, behavior: "smooth" });
  const arrow = "absolute top-[38%] z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border store-border store-surface shadow-md md:flex";
  return (
    <section data-testid="shoppable-reels" aria-label={s.title || "Shoppable reels"} className="mx-auto max-w-7xl px-4 sm:px-8">
      <HomepageSectionTitle align="CENTER" eyebrow={s.eyebrow} title={s.title || "Shop Our Reels"} subtitle={s.subtitle} className="mb-8 sm:mb-10" />
      {marquee ? (
        <div data-testid="reel-track" data-marquee="true" className="no-scrollbar overflow-hidden [container-type:inline-size] motion-reduce:overflow-x-auto">
          <div className="reels-marquee-track flex w-max" style={{ "--reels-duration": `${count * SECONDS_PER_REEL}s` }}>
            {[...reels, ...reels].map((reel, index) => {
              const clone = index >= count;
              const id = reel.id || `reel-${index % count}`;
              const key = `${clone ? "clone-" : ""}${id}`; // each on-screen card is its own sound owner, copies included
              return <ReelCard key={key} track clone={clone} reel={{ ...reel, products: reel.products || [], categories: reel.categories || [] }} soundOn={soundId === key} onSound={() => setSoundId((current) => (current === key ? null : key))} onHover={(on) => setSoundId((current) => (on ? key : current === key ? null : current))} onSoundDenied={() => setSoundId((current) => (current === key ? null : current))} onShop={() => setTrayReel(reel)} onOpenModal={() => setModalReel(reel)} />;
            })}
          </div>
        </div>
      ) : (
        <div className="relative">
          {s.showArrows !== false && <button type="button" aria-label="Previous reels" onClick={() => slide(-1)} className={`${arrow} -left-3`}>&larr;</button>}
          <div ref={scrollRef} data-testid="reel-track" className="no-scrollbar flex gap-3 overflow-x-auto pb-1 sm:gap-5 md:justify-center lg:gap-6">
            {reels.map((reel, index) => {
              const id = reel.id || `reel-${index}`;
              return <ReelCard key={id} reel={{ ...reel, products: reel.products || [], categories: reel.categories || [] }} soundOn={soundId === id} onSound={() => setSoundId((current) => (current === id ? null : id))} onHover={(on) => setSoundId((current) => (on ? id : current === id ? null : current))} onSoundDenied={() => setSoundId((current) => (current === id ? null : current))} onShop={() => setTrayReel(reel)} onOpenModal={() => setModalReel(reel)} />;
            })}
          </div>
          {s.showArrows !== false && <button type="button" aria-label="Next reels" onClick={() => slide(1)} className={`${arrow} -right-3`}>&rarr;</button>}
        </div>
      )}
      {modalReel && <ReelModal reel={{ ...modalReel, products: modalReel.products || [], categories: modalReel.categories || [] }} onClose={closeModal} onShop={() => setTrayReel(modalReel)} />}
      {trayReel && <ShopTray reel={{ ...trayReel, products: trayReel.products || [], categories: trayReel.categories || [] }} onClose={closeTray} />}
    </section>
  );
}
