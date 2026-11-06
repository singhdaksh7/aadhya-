import sharp from "sharp";

// Auto size-reducer for every new image upload. Pixel dimensions are never changed: the image is
// re-encoded as WebP (smaller file, same look), stepping the quality down only if the result is
// still heavy. If re-encoding would not make the file smaller, the original bytes are kept.
export const TARGET_MAX_BYTES = 600 * 1024;
const QUALITY_STEPS = [82, 72, 62, 52];
const RASTER = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function optimizeImageBuffer(buffer, mimeType) {
  if (!RASTER.has(mimeType)) return { buffer, mimeType };
  let best = null;
  try {
    for (const quality of QUALITY_STEPS) {
      const out = await sharp(buffer, { failOn: "none" }).rotate().webp({ quality, effort: 4 }).toBuffer();
      best = out;
      if (out.length <= TARGET_MAX_BYTES) break;
    }
  } catch {
    return { buffer, mimeType }; // undecodable image: never fail the upload, store the original bytes
  }
  if (!best || best.length >= buffer.length) return { buffer, mimeType };
  return { buffer: best, mimeType: "image/webp" };
}
