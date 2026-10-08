// Creates the demo bookshelf through the Admin API: theme subcategories, ~13 clearly-labelled sample
// books with typographic covers, and a physical format for each. Safe to re-run: anything that already
// exists (by slug) is skipped.
//
//   API_BASE=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/demo-content/seed-demo-books.mjs
//   DRY_RUN=1 ... prints what would be created without writing.
import { chromium } from "@playwright/test";
import { adminLogin, client, publicGet, API_BASE } from "./admin-client.mjs";
import { DEMO_BOOKS, DEMO_PUBLISHER, THEME_CATEGORIES } from "./demo-books.mjs";

const DRY = process.env.DRY_RUN === "1";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function coverHtml(book) {
  const [bg, accent, ink] = book.palette;
  return `<!doctype html><html><body style="margin:0"><div style="width:800px;height:1200px;background:${bg};color:${ink};position:relative;overflow:hidden;font-family:Georgia,'Times New Roman',serif">
    <div style="position:absolute;inset:44px;border:2px solid ${accent};opacity:.7"></div>
    <div style="position:absolute;left:0;top:0;bottom:0;width:26px;background:rgba(0,0,0,.18)"></div>
    <div style="position:absolute;top:150px;left:110px;right:90px;font:600 22px Arial,sans-serif;letter-spacing:.42em;text-transform:uppercase;color:${accent}">Aadya Editions</div>
    <div style="position:absolute;top:330px;left:110px;right:90px;font-size:104px;line-height:1.02;font-weight:300">${esc(book.title)}</div>
    <div style="position:absolute;top:760px;left:110px;width:90px;height:3px;background:${accent}"></div>
    <div style="position:absolute;top:800px;left:110px;right:90px;font-size:34px;font-style:italic;opacity:.9">${esc(book.subtitle)}</div>
    <div style="position:absolute;bottom:150px;left:110px;right:90px;font:500 24px Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase">${esc(DEMO_PUBLISHER)}</div>
    <div style="position:absolute;bottom:92px;left:110px;font:600 16px Arial,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:${accent}">Demo sample cover</div>
  </div></body></html>`;
}

async function main() {
  console.log(`Target API: ${API_BASE}${DRY ? "  (DRY RUN)" : ""}`);
  const token = DRY ? null : await adminLogin();
  const api = DRY ? null : client(token);

  const catsRes = await publicGet("/categories");
  const categories = catsRes?.data || [];
  const booksRoot = categories.find((c) => c.slug === "books");
  if (!booksRoot) throw new Error("The Books root category does not exist");
  const bySlug = new Map(categories.map((c) => [c.slug, c]));

  for (const theme of THEME_CATEGORIES) {
    if (bySlug.has(theme.slug)) { console.log(`category exists: ${theme.slug}`); continue; }
    console.log(`create category: ${theme.name}`);
    if (!DRY) {
      const res = await api.post("/admin/categories", { name: theme.name, slug: theme.slug, parentId: booksRoot.id, sortOrder: theme.sortOrder, isActive: true });
      bySlug.set(theme.slug, res.data);
    } else bySlug.set(theme.slug, { id: "dry", slug: theme.slug });
  }

  const browser = DRY ? null : await chromium.launch();
  let created = 0;
  for (const book of DEMO_BOOKS) {
    if (await publicGet(`/products/${book.slug}`)) { console.log(`book exists: ${book.slug}`); continue; }
    console.log(`create book: ${book.title}`);
    if (DRY) { created += 1; continue; }
    const res = await api.post("/admin/products", {
      name: book.title,
      slug: book.slug,
      productType: "BOOK",
      categoryId: bySlug.get(book.theme).id,
      sku: book.sku,
      price: book.price,
      stockQuantity: 25,
      trackInventory: true,
      isActive: true,
      isFeatured: book.flags.isFeatured === true,
      isBestSeller: book.flags.isBestSeller === true,
      isNewArrival: book.flags.isNewArrival === true,
      shortDescription: `${book.subtitle}. Demo sample title.`,
      description: `${book.blurb} This is a demo / sample listing created to preview the Aadya bookshelf; it is not a real publication.`,
      attributes: { Binding: book.binding },
      tags: ["demo", "sample-book"],
      bookDetail: { author: book.author, publisher: DEMO_PUBLISHER, language: book.n % 5 === 0 ? "Hindi" : "English", pageCount: book.pages, edition: "Aadya demo/sample edition", isbn: `AADYA-DEMO-ISBN-${String(book.n + 100).padStart(4, "0")}` },
    });
    const id = res.data.id;
    const page = await browser.newPage({ viewport: { width: 800, height: 1200 } });
    await page.setContent(coverHtml(book));
    const png = await page.screenshot({ type: "png" });
    await page.close();
    const form = new FormData();
    form.append("image", new Blob([png], { type: "image/png" }), `${book.slug}-cover.png`);
    form.append("altText", `${book.title} (demo sample cover)`);
    form.append("isPrimary", "true");
    await api.upload(`/admin/products/${id}/images`, form);
    await api.put(`/admin/products/${id}/book-formats/PHYSICAL`, { price: book.price, isActive: true, stockQuantity: 25, trackInventory: true, weightGrams: 450 });
    created += 1;
  }
  if (browser) await browser.close();
  console.log(`Done. ${created} book(s) ${DRY ? "would be " : ""}created.`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
