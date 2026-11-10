import path from "node:path";
import { prisma } from "../../lib/prisma.js";
import { PUBLIC_UPLOAD_PREFIX, removeByUrl } from "./storage.js";

// Product images, product OG images and Media Library assets can all point at the same physical
// file (a duplicated product reuses its source's URLs). These helpers are the single place that
// decides whether a file is still in use before it is physically removed.

// Local uploads are matched on their file name so "/uploads/products/x.jpg", an absolute API URL
// or a URL with a query string all count as the same file. Other URLs (S3/external) match exactly.
function matcher(url) {
  if (typeof url !== "string" || !url) return null;
  const clean = url.split(/[?#]/)[0];
  let decoded = clean;
  try { decoded = decodeURIComponent(clean); } catch { /* keep raw */ }
  if (decoded.includes(`${PUBLIC_UPLOAD_PREFIX}/`)) return { contains: `${PUBLIC_UPLOAD_PREFIX}/${path.basename(decoded)}` };
  return { equals: url };
}

/** Counts products using this file via ProductImage rows or ogImage. Distinct products. */
export async function countProductsUsingMedia(url) {
  const m = matcher(url);
  if (!m) return 0;
  const [images, ogs] = await Promise.all([
    prisma.productImage.findMany({ where: { url: m }, select: { productId: true } }),
    prisma.product.findMany({ where: { ogImage: m }, select: { id: true } }),
  ]);
  return new Set([...images.map((i) => i.productId), ...ogs.map((p) => p.id)]).size;
}

/** True if any product image, product OG image or Media Library asset still references the file. */
export async function isMediaUrlReferenced(url) {
  const m = matcher(url);
  if (!m) return false;
  const [imageRef, ogRef, assetRef] = await Promise.all([
    prisma.productImage.findFirst({ where: { url: m }, select: { id: true } }),
    prisma.product.findFirst({ where: { ogImage: m }, select: { id: true } }),
    prisma.mediaAsset.findFirst({ where: { url: m }, select: { id: true } }),
  ]);
  return Boolean(imageRef || ogRef || assetRef);
}

/**
 * Call AFTER the DB row that referenced the file has been removed: deletes the physical file only
 * when nothing references it any more. Filesystem failures are logged, never thrown, so valid DB
 * state is not undone.
 */
export async function removeLocalFileIfUnreferenced(url) {
  try {
    if (!url || (await isMediaUrlReferenced(url))) return false;
    await removeByUrl(url);
    return true;
  } catch (err) {
    console.error("[media] orphan file cleanup failed", url, err?.message);
    return false;
  }
}
