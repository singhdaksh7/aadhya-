import { describe, it, expect } from "vitest";
import sharp from "sharp";
import crypto from "node:crypto";
import { optimizeImageBuffer, TARGET_MAX_BYTES } from "../src/modules/uploads/optimizeImage.js";

describe("upload auto-optimizer", () => {
  it("shrinks a heavy PNG to WebP with identical dimensions", async () => {
    const raw = crypto.randomBytes(1600 * 1200 * 3);
    const png = await sharp(raw, { raw: { width: 1600, height: 1200, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
    const out = await optimizeImageBuffer(png, "image/png");
    expect(out.mimeType).toBe("image/webp");
    expect(out.buffer.length).toBeLessThan(png.length);
    const meta = await sharp(out.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([1600, 1200]);
  });
  it("keeps a smooth photo-like image well under the target", async () => {
    const img = await sharp({ create: { width: 1080, height: 1080, channels: 3, background: "#a55" } }).png().toBuffer();
    const out = await optimizeImageBuffer(img, "image/png");
    expect(out.buffer.length).toBeLessThanOrEqual(TARGET_MAX_BYTES);
  });
  it("passes non-raster types through untouched", async () => {
    const buf = Buffer.from("<svg/>");
    expect(await optimizeImageBuffer(buf, "image/svg+xml")).toEqual({ buffer: buf, mimeType: "image/svg+xml" });
  });
});

describe("upload auto-optimizer safety", () => {
  it("never throws on an undecodable image: stores the original bytes", async () => {
    const bad = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("not really a png")]);
    expect(await optimizeImageBuffer(bad, "image/png")).toEqual({ buffer: bad, mimeType: "image/png" });
  });
});

import fs from "node:fs";
import path from "node:path";
import { saveBufferWithInfo, uploadRootDir } from "../src/modules/uploads/storage.js";

describe("every stored upload is compressed (regression guard)", () => {
  it("saveBufferWithInfo stores a smaller WebP with the same dimensions", async () => {
    const raw = crypto.randomBytes(1400 * 1000 * 3);
    const png = await sharp(raw, { raw: { width: 1400, height: 1000, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
    const saved = await saveBufferWithInfo(png, "image/png");
    const file = path.join(uploadRootDir, path.basename(saved.url));
    try {
      expect(saved.mimeType).toBe("image/webp");
      expect(saved.size).toBeLessThan(png.length);
      expect(fs.statSync(file).size).toBe(saved.size);
      const meta = await sharp(fs.readFileSync(file)).metadata();
      expect([meta.width, meta.height]).toEqual([1400, 1000]);
    } finally {
      try { fs.rmSync(file, { force: true }); } catch { /* OneDrive may briefly lock the temp file */ }
    }
  });
});
