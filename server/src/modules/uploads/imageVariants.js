import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// Responsive derivatives for uploaded raster images. Originals are never touched:
// a derivative is generated on first request, written next to the originals under
// `.variants/` and served with long-lived caching. Names are content-addressed by
// the original's random UUID filename, so a derivative can never go stale.
export const VARIANT_WIDTHS = [320, 480, 640, 800, 1200];
const RASTER_RE = /^[A-Za-z0-9_-]+\.(png|jpe?g|webp)$/i;
const inflight = new Map();

export function parseVariantRequest(name, widthParam) {
  if (!RASTER_RE.test(name || "")) return null;
  const width = Number(widthParam);
  if (!VARIANT_WIDTHS.includes(width)) return null;
  return { width, base: name.replace(/\.[^.]+$/, "") };
}

export function variantPath(root, base, width) {
  return path.join(root, ".variants", `${base}-${width}.webp`);
}

export async function ensureVariant(root, name, width) {
  const base = name.replace(/\.[^.]+$/, "");
  const out = variantPath(root, base, width);
  if (fs.existsSync(out)) return out;
  const src = path.join(root, path.basename(name));
  if (!fs.existsSync(src)) return null;
  if (inflight.has(out)) return inflight.get(out);
  const job = (async () => {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const tmp = `${out}.${process.pid}.tmp`;
    await sharp(src, { failOn: "none" })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toFile(tmp);
    fs.renameSync(tmp, out);
    return out;
  })().finally(() => inflight.delete(out));
  inflight.set(out, job);
  return job;
}

// Express middleware: `/uploads/products/<uuid>.png?w=480` -> cached WebP; anything else falls through to static.
export function variantMiddleware(root) {
  return async (req, res, next) => {
    if (req.query.w === undefined || (req.method !== "GET" && req.method !== "HEAD")) return next();
    const parsed = parseVariantRequest(path.basename(req.path), req.query.w);
    if (!parsed) return next();
    try {
      const file = await ensureVariant(root, path.basename(req.path), parsed.width);
      if (!file) return next();
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.type("image/webp");
      res.sendFile(file, { dotfiles: "allow" });
    } catch (err) {
      next(); // never break the page: fall back to the original file
    }
  };
}
