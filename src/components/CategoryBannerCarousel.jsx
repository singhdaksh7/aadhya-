import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { resolveMediaUrl } from "../lib/api";

// 0 slides -> nothing, 1 -> static banner, 2+ -> carousel (arrows, dots, autoplay, swipe).
// The frame has a fixed aspect ratio so slides never shift layout; only the first image is eager.
const isExternal = (u) => /^https?:\/\//i.test(u);

function Cta({ slide }) {
  if (!slide.ctaLabel || !slide.ctaUrl) return null;
  const cls = "pointer-events-auto inline-flex rounded-full bg-white px-4 py-2 text-xs font-semibold text-charcoal shadow hover:bg-white/90";
  return isExternal(slide.ctaUrl)
    ? <a href={slide.ctaUrl} className={cls} rel="noopener noreferrer">{slide.ctaLabel}</a>
    : <Link to={slide.ctaUrl} className={cls}>{slide.ctaLabel}</Link>;
}

// The frame takes the banner's own proportions (clamped 1:1 to 4:1) at every screen size, so the
// whole image is always visible, never cropped, at any viewport. Before the image has loaded the frame
// uses a fixed placeholder ratio. A slide whose shape differs from the frame (only possible in a
// carousel of mixed shapes) is shown whole with object-contain, centred over a blurred copy of itself.
const MIN_FRAME_RATIO = 1;
const MAX_FRAME_RATIO = 4;
const ratioMismatch = (natural, frame) => Boolean(natural && frame) && Math.abs(natural / frame - 1) > 0.03;

function SlideImage({ slide, alt, first, onBroken, onMeasure, frameRatio }) {
  const [natural, setNatural] = useState(null);
  const contain = ratioMismatch(natural, frameRatio);
  const src = resolveMediaUrl(slide.desktop || slide.mobile);
  return (
    <picture>
      {slide.mobile && slide.desktop && slide.mobile !== slide.desktop && (
        <source media="(max-width: 767px)" srcSet={resolveMediaUrl(slide.mobile)} />
      )}
      {contain && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          data-testid="category-banner-backdrop"
          draggable={false}
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
        />
      )}
      <img
        src={src}
        alt={alt}
        loading={first ? "eager" : "lazy"}
        fetchPriority={first ? "high" : "auto"}
        decoding={first ? "sync" : "async"}
        draggable={false}
        onLoad={(e) => {
          const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
          if (w > 0 && h > 0) {
            setNatural(w / h);
            onMeasure?.(w / h);
          }
        }}
        onError={onBroken}
        className={`absolute inset-0 h-full w-full object-center ${contain ? "object-contain" : "object-cover"}`}
      />
    </picture>
  );
}

export default function CategoryBannerCarousel({ slides = [], autoplay = false, intervalMs = 5000, categoryName = "Category" }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [broken, setBroken] = useState(() => new Set());
  const [ratio, setRatio] = useState(null);
  const touchX = useRef(null);
  const count = slides.length;
  const safeIndex = count ? Math.min(index, count - 1) : 0;

  const go = useCallback((n) => setIndex(((n % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || !autoplay || paused) return undefined;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), Math.max(2000, intervalMs));
    return () => clearInterval(t);
  }, [count, autoplay, intervalMs, paused]);

  const markBroken = (id) => setBroken((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  // Every image failed to load: drop the banner instead of leaving an empty frame.
  if (count === 0 || slides.every((x) => broken.has(x.id))) return null;

  const frameRatio = ratio ? Math.min(MAX_FRAME_RATIO, Math.max(MIN_FRAME_RATIO, ratio)) : null;
  const frameBase = "relative w-full overflow-hidden rounded-2xl border border-[var(--theme-border)] store-surface";
  const frame = frameRatio ? frameBase : `${frameBase} aspect-[2/1] md:aspect-[3/1] md:max-h-[300px]`;
  const frameStyle = frameRatio ? { aspectRatio: frameRatio } : undefined;
  const alt = (s) => s.title || `${categoryName} banner`;

  const overlay = (s) => (s.title || s.subtitle || s.ctaLabel) && (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 space-y-1 bg-gradient-to-t from-black/60 to-transparent p-4 pb-9 text-white sm:p-6 sm:pb-10">
      {s.title && <p className="font-heading text-lg font-semibold leading-tight sm:text-2xl">{s.title}</p>}
      {s.subtitle && <p className="text-xs sm:text-sm">{s.subtitle}</p>}
      <Cta slide={s} />
    </div>
  );

  if (count === 1) {
    return (
      <section data-testid="category-banner" className="mx-auto w-full max-w-7xl px-4 sm:px-8">
        <div className={frame} style={frameStyle}>
          <SlideImage slide={slides[0]} alt={alt(slides[0])} first onBroken={() => markBroken(slides[0].id)} onMeasure={setRatio} frameRatio={frameRatio} />
          {overlay(slides[0])}
        </div>
      </section>
    );
  }

  const onTouchStart = (e) => { touchX.current = e.touches?.[0]?.clientX ?? null; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = (e.changedTouches?.[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 40) go(safeIndex + (dx < 0 ? 1 : -1));
  };

  return (
    <section
      data-testid="category-banner"
      aria-roledescription="carousel"
      aria-label={`${categoryName} banners`}
      className="mx-auto w-full max-w-7xl px-4 sm:px-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className={frame} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ ...frameStyle, touchAction: "pan-y" }}>
        {slides.map((s, i) => (
          <div
            key={s.id}
            data-testid="category-banner-slide"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== safeIndex}
            className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${i === safeIndex ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <SlideImage slide={s} alt={alt(s)} first={i === 0} onBroken={() => markBroken(s.id)} onMeasure={i === 0 ? setRatio : undefined} frameRatio={frameRatio} />
            {i === safeIndex && overlay(s)}
          </div>
        ))}
        <button type="button" aria-label="Previous banner" onClick={() => go(safeIndex - 1)}
          className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-charcoal shadow hover:bg-white">&#8249;</button>
        <button type="button" aria-label="Next banner" onClick={() => go(safeIndex + 1)}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-charcoal shadow hover:bg-white">&#8250;</button>
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2">
          {slides.map((s, i) => (
            <button key={s.id} type="button" aria-label={`Go to banner ${i + 1}`} aria-current={i === safeIndex}
              onClick={() => go(i)}
              className={`h-2 rounded-full transition-all ${i === safeIndex ? "w-5 bg-white" : "w-2 bg-white/60"}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
