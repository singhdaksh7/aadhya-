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

// Private, non-web-served storage for book PDFs. Deliberately outside the
// /uploads public static root — the only way to reach a file here is
// through the authenticated/entitlement-checked download endpoint, which
// streams it by an opaque key. Never return this path/key to the client.
const PRIVATE_ROOT = path.resolve(process.cwd(), "private", "books");
fs.mkdirSync(PRIVATE_ROOT, { recursive: true });

export function randomPdfKey() {
  return `${crypto.randomUUID()}.pdf`;
}

export function createPrivateStorage(config = env.storage, client) {
  if (config.driver === "local") return {
    async save(buffer) { const key = randomPdfKey(); fs.writeFileSync(path.join(PRIVATE_ROOT, key), buffer); return key; },
    async remove(key) { if (key) fs.rm(path.join(PRIVATE_ROOT, path.basename(key)), { force: true }, () => {}); },
    async readStream(key) {
      const filePath = path.join(PRIVATE_ROOT, path.basename(key));
      if (!fs.existsSync(filePath)) return null;
      return { stream: fs.createReadStream(filePath), size: fs.statSync(filePath).size };
    },
    async exists(key) { return fs.existsSync(path.join(PRIVATE_ROOT, path.basename(key))); },
  };
  if (config.driver !== "s3") throw new Error(`Unsupported storage driver: ${config.driver}`);
  const s3 = s3Config(config);
  const s3Client = client || new S3Client({ region: s3.region, endpoint: s3.endpoint || undefined, forcePathStyle: Boolean(s3.endpoint), credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey } });
  return {
    async save(buffer) { const key = `private/books/${randomPdfKey()}`; await s3Client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: buffer, ContentType: "application/pdf" })); return key; },
    async remove(key) { if (key) await s3Client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: key })); },
    async readStream(key) {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      try {
        const result = await s3Client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: key }));
        return { stream: result.Body, size: result.ContentLength };
      } catch { return null; }
    },
    async exists(key) {
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
      try { await s3Client.send(new HeadObjectCommand({ Bucket: s3.bucket, Key: key })); return true; } catch { return false; }
    },
  };
}

const privateStorage = createPrivateStorage();
export async function savePdfBuffer(buffer) { return privateStorage.save(buffer); }
export async function removePdfByKey(key) { return privateStorage.remove(key); }
export async function readPdfStream(key) { return privateStorage.readStream(key); }
export async function pdfExists(key) { return privateStorage.exists(key); }

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
