// Idempotent: pre-generates responsive WebP derivatives for existing uploads.
// Originals are never modified; already generated variants are skipped; failures are
// reported and do not stop the run. Safe to rerun. Usage: node scripts/backfill-image-variants.js
import fs from "node:fs";
import path from "node:path";
import { ensureVariant, variantPath, VARIANT_WIDTHS } from "../src/modules/uploads/imageVariants.js";

const root = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads/products");
const files = fs.readdirSync(root).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
let made = 0, skipped = 0;
const failures = [];
for (const f of files) {
  const base = f.replace(/\.[^.]+$/, "");
  for (const w of VARIANT_WIDTHS) {
    if (fs.existsSync(variantPath(root, base, w))) { skipped++; continue; }
    try { await ensureVariant(root, f, w); made++; } catch (e) { failures.push(`${f}@${w}: ${e.message}`); }
  }
}
console.log(`files=${files.length} created=${made} skipped=${skipped} failed=${failures.length}`);
failures.forEach((x) => console.log("FAIL", x));
process.exit(failures.length ? 1 : 0);
