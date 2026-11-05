import { useEffect, useState } from "react";
import { buildSrcSet, variantUrl, CARD_SIZES } from "../lib/imageVariants";

// Branded, text-free fallback: no <img>, so the browser can never paint alt text or a broken icon.
export function ImageFallback({ className = "" }) {
  return (
    <div
      data-testid="image-fallback"
      role="img"
      aria-hidden="true"
      className={`absolute inset-0 flex items-center justify-center store-surface ${className}`}
    >
      <svg className="h-10 w-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="1.6" />
        <path d="m4 18 5-5 4 4 3-3 4 4" />
      </svg>
    </div>
  );
}

// Fills its (already aspect-ratio'd) parent. Shows a skeleton until decoded, fades in, and walks
// through fallback sources on error before settling on the branded placeholder.
export default function CardImage({ sources = [], alt, priority = false, sizes = CARD_SIZES, className = "", imgClassName = "" }) {
  const list = sources.filter(Boolean);
  const key = list.join("|");
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setIdx(0); setLoaded(false); }, [key]);

  const src = list[idx];
  const failed = !src;
  return (
    <div className={`absolute inset-0 ${className}`}>
      {!loaded && <div data-testid="image-skeleton" className="absolute inset-0 animate-pulse store-surface" />}
      {failed ? (
        <ImageFallback />
      ) : (
        <img
          key={src}
          ref={(el) => { if (el && el.complete && el.naturalWidth === 0 && el.currentSrc) setIdx((i) => i + 1); }}
          src={variantUrl(src, 640)}
          srcSet={buildSrcSet(src)}
          sizes={buildSrcSet(src) ? sizes : undefined}
          alt={alt}
          width={800}
          height={1000}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setIdx((i) => i + 1)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"} ${imgClassName}`}
        />
      )}
    </div>
  );
}
