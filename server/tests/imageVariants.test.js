import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { parseVariantRequest, ensureVariant } from "../src/modules/uploads/imageVariants.js";

describe("image variants", () => {
  it("accepts only whitelisted widths and safe raster names", () => {
    expect(parseVariantRequest("a-b.png", "480")).toEqual({ width: 480, base: "a-b" });
    expect(parseVariantRequest("a.png", "481")).toBeNull();
    expect(parseVariantRequest("a.svg", "480")).toBeNull();
    expect(parseVariantRequest("../a.png", "480")).toBeNull();
  });
  it("generates a smaller webp, keeps the original, is idempotent, null when missing", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "var-"));
    await sharp({ create: { width: 1600, height: 2000, channels: 3, background: "#c33" } }).png().toFile(path.join(dir, "x.png"));
    const out = await ensureVariant(dir, "x.png", 480);
    expect((await sharp(out).metadata()).width).toBe(480);
    expect((await sharp(out).metadata()).format).toBe("webp");
    expect(fs.existsSync(path.join(dir, "x.png"))).toBe(true);
    expect(await ensureVariant(dir, "x.png", 480)).toBe(out);
    expect(await ensureVariant(dir, "nope.png", 480)).toBeNull();
  });
});
