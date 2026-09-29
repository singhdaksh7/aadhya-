import React, { useEffect, useState } from "react";
import { resolveMediaUrl } from "../lib/api";

/**
 * Renders a site-settings-driven logo (header logo, footer logo, dark/light
 * variant, ...) with the ONE shared media URL normalization path and a
 * graceful fallback to the Aadya text wordmark if the image fails to load
 * (broken key, deleted media asset, storage misconfiguration, etc.) instead
 * of a broken-image icon. Every consumer (Navbar, Footer) should render logos
 * through this component rather than reinventing URL resolution + <img>.
 */
export default function BrandLogo({
  src,
  alt = "Aadya",
  fallbackText = "Aadya",
  widthPx,
  className = "",
  textClassName = "font-serif-display text-2xl tracking-tight text-charcoal sm:text-3xl font-bold",
}) {
  const resolved = resolveMediaUrl(src);
  const [broken, setBroken] = useState(false);

  // Reset the broken flag whenever the configured logo changes (e.g. after
  // an admin save swaps the URL) so a previously-broken logo gets a fresh
  // chance to load rather than staying stuck on the text fallback forever.
  useEffect(() => {
    setBroken(false);
  }, [resolved]);

  if (!resolved || broken) {
    return <span className={textClassName}>{fallbackText}</span>;
  }

  return (
    <img
      src={resolved}
      alt={alt}
      style={widthPx ? { width: `${widthPx}px` } : undefined}
      className={className}
      onError={() => {
        // The real fix is a correct stored URL; this is only the safety net.
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn(`[BrandLogo] failed to load "${alt}" logo from resolved URL (falling back to text).`);
        }
        setBroken(true);
      }}
    />
  );
}
