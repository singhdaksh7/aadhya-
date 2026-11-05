// Delivery for admin-uploaded raster images. The API serves `/uploads/products/<uuid>.png?w=full` as a cached
// WebP with the SAME pixel dimensions as the original, only a much smaller file (the original is never touched).
// Anything else (external URLs, svg, video) is returned unchanged.
const UPLOAD_RASTER = /\/uploads\/products\/[A-Za-z0-9_-]+\.(png|jpe?g|webp)(\?.*)?$/i;

export function canVariant(url) {
  return typeof url === "string" && UPLOAD_RASTER.test(url) && !/[?&]w=/.test(url);
}

export function optimizedUrl(url) {
  return canVariant(url) ? `${url}?w=full` : url;
}
export const variantUrl = optimizedUrl;

export function bannerImgProps(url) {
  return { src: optimizedUrl(url) };
}
