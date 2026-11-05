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
await prisma.$disconnect();
