import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { parseVariantRequest, ensureVariant } from "../src/modules/uploads/imageVariants.js";

describe("image variants", () => {
  it("accepts only whitelisted widths and safe raster names", () => {
    expect(parseVariantRequest("a-b.png", "full")).toEqual({ width: "full", base: "a-b" });
    expect(parseVariantRequest("a.png", "480")).toBeNull();
    expect(parseVariantRequest("a.svg", "full")).toBeNull();
    expect(parseVariantRequest("../a.png", "full")).toBeNull();
  });
  it("generates a smaller webp, keeps the original, is idempotent, null when missing", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "var-"));
    await sharp({ create: { width: 1600, height: 2000, channels: 3, background: "#c33" } }).png().toFile(path.join(dir, "x.png"));
    const out = await ensureVariant(dir, "x.png", "full");
    expect((await sharp(out).metadata()).width).toBe(1600);
    expect((await sharp(out).metadata()).height).toBe(2000);
    expect((await sharp(out).metadata()).format).toBe("webp");
    expect(fs.existsSync(path.join(dir, "x.png"))).toBe(true);
    expect(await ensureVariant(dir, "x.png", "full")).toBe(out);
    expect(await ensureVariant(dir, "nope.png", "full")).toBeNull();
  });
});
