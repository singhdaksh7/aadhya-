import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Local-disk storage today. Swap this module for an S3/Cloudinary-backed
// implementation later without touching product.service.js — callers only
// depend on { save(file) -> url, remove(url) } and PUBLIC_UPLOAD_PREFIX.

const UPLOAD_ROOT = path.resolve(process.cwd(), env.uploads.dir);
export const PUBLIC_UPLOAD_PREFIX = "/uploads/products";

fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function randomFilename(mimeType) {
  const ext = EXT_BY_MIME[mimeType] || ".bin";
  return `${crypto.randomUUID()}${ext}`;
}

function s3Config(config) {
  const missing = ["region", "bucket", "accessKeyId", "secretAccessKey"].filter((key) => !config[key]);
  if (missing.length) throw new Error(`Missing S3 storage configuration: ${missing.join(", ")}`);
  return config;
}

export function createStorage(config = env.storage, client) {
  if (config.driver === "local") return {
    async save(buffer, mimeType) { const filename = randomFilename(mimeType); fs.writeFileSync(path.join(UPLOAD_ROOT, filename), buffer); return `${PUBLIC_UPLOAD_PREFIX}/${filename}`; },
    async remove(url) { if (url?.startsWith(PUBLIC_UPLOAD_PREFIX)) fs.rm(path.join(UPLOAD_ROOT, path.basename(url)), { force: true }, () => {}); },
  };
  if (config.driver !== "s3") throw new Error(`Unsupported storage driver: ${config.driver}`);
  const s3 = s3Config(config);
  const s3Client = client || new S3Client({ region: s3.region, endpoint: s3.endpoint || undefined, forcePathStyle: Boolean(s3.endpoint), credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey } });
  const publicBase = s3.publicBaseUrl.replace(/\/$/, "");
  return {
    async save(buffer, mimeType) { const key = `products/${randomFilename(mimeType)}`; await s3Client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: buffer, ContentType: mimeType })); return publicBase ? `${publicBase}/${key}` : `${s3.endpoint.replace(/\/$/, "")}/${s3.bucket}/${key}`; },
    async remove(url) { if (url) await s3Client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: url.split("/").slice(-2).join("/") })); },
  };
}

const storage = createStorage();
export async function saveBuffer(buffer, mimeType) { return storage.save(buffer, mimeType); }
export async function removeByUrl(url) { return storage.remove(url); }

export const uploadRootDir = UPLOAD_ROOT;
