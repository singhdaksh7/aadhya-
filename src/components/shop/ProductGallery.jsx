import React, { useEffect, useRef, useState } from "react";
import { ImageFallback } from "../CardImage";
import { optimizedUrl } from "../../lib/imageVariants";
import ImageLightbox from "./ImageLightbox";

const SWIPE_PX = 40;

function Arrow({ dir, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous product image" : "Next product image"}
      className={`absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[var(--theme-primary)] shadow-md backdrop-blur-sm transition hover:bg-white hover:scale-105 ${dir === "prev" ? "left-2 sm:left-3" : "right-2 sm:right-3"}`}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir === "prev" ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"} />
      </svg>
    </button>
  );
}

/**
 * PDP gallery. `index` / `onIndexChange` are owned by the page (single source of truth) and shared with the
 * lightbox. Arrows loop; a horizontal swipe on the image changes image without blocking vertical scroll.
 */
export default function ProductGallery({ images, index, onIndexChange, alt, children }) {
  const count = images.length;
  const multi = count > 1;
  const safe = count ? Math.min(Math.max(index, 0), count - 1) : 0;
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState({});
  const touch = useRef(null);
  const swiped = useRef(false);

  const go = (delta) => { if (multi) onIndexChange((safe + delta + count) % count); };

  // Warm only the NEXT image (optimized, same file the PDP would show) so arrows feel instant.
  useEffect(() => {
    if (!multi || typeof Image === "undefined") return;
    const next = images[(safe + 1) % count];
    if (next) new Image().src = optimizedUrl(next);
  }, [safe, count, multi, images]);

  const onTouchStart = (e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; swiped.current = false; };
  const onTouchEnd = (e) => {
    const s = touch.current; touch.current = null;
    if (!s || !multi) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped.current = true; setTimeout(() => { swiped.current = false; }, 400); go(dx < 0 ? 1 : -1); }
  };

  const src = images[safe];
  const broken = !src || failed[src];

  return (
    <>
      <div data-testid="pdp-gallery-main" className="relative aspect-square w-full overflow-hidden rounded-xl store-surface">
        {broken ? (
          <ImageFallback />
        ) : (
          <button
            type="button"
            data-testid="pdp-zoom-trigger"
            aria-label="Open image viewer to zoom"
            onClick={() => { if (swiped.current) { swiped.current = false; return; } setOpen(true); }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="absolute inset-0 block h-full w-full cursor-zoom-in"
            style={{ touchAction: "pan-y" }}
          >
            <img
              key={src}
              src={optimizedUrl(src)}
              fetchPriority="high"
              decoding="async"
              alt={alt}
              draggable={false}
              onError={() => setFailed((f) => ({ ...f, [src]: true }))}
              className="h-full w-full select-none object-contain"
            />
            <span aria-hidden="true" className="pointer-events-none absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-[var(--theme-primary)] shadow-sm">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M11 8.5v5M8.5 11h5" /></svg>
            </span>
          </button>
        )}
        {multi && <Arrow dir="prev" onClick={() => go(-1)} />}
        {multi && <Arrow dir="next" onClick={() => go(1)} />}
        {children}
        {multi && (
          <span data-testid="pdp-gallery-counter" className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/45 px-2.5 py-0.5 text-[11px] tabular-nums text-white">
            {safe + 1} / {count}
          </span>
        )}
      </div>

      {multi && (
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onIndexChange(idx)}
              aria-label={`View image ${idx + 1}`}
              aria-current={idx === safe}
              className={`h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-lg border-2 store-surface transition ${
                idx === safe ? "border-[var(--theme-primary)]" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <img src={optimizedUrl(img)} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}

      {open && <ImageLightbox images={images} index={safe} onIndexChange={onIndexChange} onClose={() => setOpen(false)} alt={alt} />}
    </>
  );
}
