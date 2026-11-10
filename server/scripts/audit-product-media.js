// Read-only audit: every ProductImage row vs. the file actually stored on disk.
// Usage (inside the api container): node scripts/audit-product-media.js [--json]
// Never deletes or modifies anything.
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const root = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads/products");
const asJson = process.argv.includes("--json");

const rows = await prisma.productImage.findMany({
  include: { product: { select: { id: true, name: true, isActive: true } } },
  orderBy: [{ productId: "asc" }, { sortOrder: "asc" }],
});
const report = rows.map((r) => {
  let status;
  if (/^https?:\/\//.test(r.url)) status = "EXTERNAL_URL_NOT_CHECKED";
  else if (!r.url.startsWith("/uploads/products/")) status = "UNEXPECTED_PATH";
  else {
    const f = path.join(root, path.basename(r.url));
    if (!fs.existsSync(f)) status = "MISSING_FILE";
    else status = fs.statSync(f).size > 1_000_000 ? "OK_OVERSIZED" : "OK";
  }
  return { productId: r.product.id, productName: r.product.name, active: r.product.isActive, mediaId: r.id, isPrimary: r.isPrimary, url: r.url, status };
});
if (asJson) console.log(JSON.stringify(report, null, 2));
else {
  for (const r of report.filter((x) => x.status !== "OK")) console.log(`${r.status}\t${r.productId}\t${r.productName}\t${r.mediaId}\t${r.url}`);
  const by = report.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  console.log("\nSummary:", by);
  const noImg = new Map();
  for (const r of report) { const o = noImg.get(r.productId) || { name: r.productName, ok: 0 }; if (r.status.startsWith("OK")) o.ok++; noImg.set(r.productId, o); }
  for (const [id, o] of noImg) if (!o.ok) console.log(`PRODUCT_WITHOUT_WORKING_IMAGE\t${id}\t${o.name}`);
}
// --- ogImage references and files shared by several product-image rows (read-only) ---
const fileMissing = (u) => u.startsWith("/uploads/products/") && !fs.existsSync(path.join(root, path.basename(u)));
const ogs = await prisma.product.findMany({ where: { ogImage: { not: null } }, select: { id: true, name: true, ogImage: true } });
const ogMissing = ogs.filter((p) => p.ogImage && fileMissing(p.ogImage));
const shared = new Map();
for (const r of report) shared.set(r.url, (shared.get(r.url) || new Set()).add(r.productId));
const sharedUrls = [...shared].filter(([, set]) => set.size > 1);
if (!asJson) {
  for (const p of ogMissing) console.log(`OG_IMAGE_MISSING_FILE\t${p.id}\t${p.name}\t${p.ogImage}`);
  console.log("Totals:", { imageRows: report.length, ogImageRefs: ogs.length, ogImageMissing: ogMissing.length, urlsSharedByMultipleProducts: sharedUrls.length });
}
await prisma.$disconnect();
