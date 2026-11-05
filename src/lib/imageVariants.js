// Responsive delivery for admin-uploaded raster images. The API serves
// `/uploads/products/<uuid>.png?w=<width>` as a cached WebP derivative (the original
// stays untouched). Anything else (external URLs, svg, video) is returned unchanged.
export const VARIANT_WIDTHS = [320, 480, 640, 800, 1200];
const UPLOAD_RASTER = /\/uploads\/products\/[A-Za-z0-9_-]+\.(png|jpe?g|webp)(\?.*)?$/i;

export function canVariant(url) {
  return typeof url === "string" && UPLOAD_RASTER.test(url) && !/[?&]w=/.test(url);
}

export function variantUrl(url, width) {
  if (!canVariant(url)) return url;
  return `${url}?w=${width}`;
}

export function buildSrcSet(url, widths = VARIANT_WIDTHS) {
  if (!canVariant(url)) return undefined;
  return widths.map((w) => `${variantUrl(url, w)} ${w}w`).join(", ");
}

// 2-column grid on phones, 3 on tablets, 3-4 on desktop.
export const CARD_SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";
