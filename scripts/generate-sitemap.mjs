// Build-time sitemap generator. Runs as `prebuild` so `npm run build` always
// ships an up-to-date public/sitemap.xml without moving this project to SSR.
// Product routes are included on a best-effort basis: if the API isn't
// reachable at build time (e.g. a static host building without a live
// backend), the sitemap still ships with the static routes.
import fs from "node:fs";
import path from "node:path";

const SITE_URL = (process.env.SITE_URL || "https://www.aadyasociety.example").replace(/\/$/, "");
const API_URL = process.env.VITE_API_URL || "http://localhost:4100/api";

const STATIC_ROUTES = [
  "/",
  "/training",
  "/consultation",
  "/about",
  "/research",
  "/books",
  "/content",
  "/events",
  "/shop",
  "/shop/books",
  "/thinkpod",
  "/testimonials",
  "/faq",
  "/contact",
];

async function fetchAllProductSlugs() {
  // Includes book products — /products returns all productTypes (BOOK
  // included), so no separate fetch is needed for book routes.
  const slugs = [];
  let page = 1;
  for (;;) {
    const res = await fetch(`${API_URL}/products?page=${page}&limit=100`);
    if (!res.ok) break;
    const body = await res.json();
    for (const p of body.data) slugs.push(p.slug);
    if (page >= (body.meta?.totalPages || 1)) break;
    page += 1;
  }
  return slugs;
}

async function fetchSlugs(resourcePath, key = "slug") {
  try {
    const res = await fetch(`${API_URL}${resourcePath}`);
    if (!res.ok) return [];
    const body = await res.json();
    const items = body.data || body.items || [];
    return items.map((item) => item[key]).filter(Boolean);
  } catch {
    return [];
  }
}

export function buildXml(urls) {
  const entries = urls
    .map((url) => `  <url><loc>${SITE_URL}${url}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

async function main() {
  let productRoutes = [];
  let categoryRoutes = [];
  let collectionRoutes = [];
  let blogRoutes = [];
  try {
    const slugs = await fetchAllProductSlugs();
    productRoutes = slugs.map((slug) => `/shop/${slug}`);
    console.log(`sitemap: included ${productRoutes.length} product routes (incl. books) from ${API_URL}`);

    const categorySlugs = await fetchSlugs("/categories");
    categoryRoutes = categorySlugs.map((slug) => `/shop/category/${slug}`);

    const collectionSlugs = await fetchSlugs("/collections");
    collectionRoutes = collectionSlugs.map((slug) => `/collections/${slug}`);

    const blogSlugs = await fetchSlugs("/blog?limit=200");
    blogRoutes = blogSlugs.map((slug) => `/blog/${slug}`);

    console.log(
      `sitemap: included ${categoryRoutes.length} categories, ${collectionRoutes.length} collections, ${blogRoutes.length} blog posts`
    );
  } catch {
    console.warn(`sitemap: could not reach ${API_URL}, shipping static routes only`);
  }

  const xml = buildXml([
    ...STATIC_ROUTES,
    ...productRoutes,
    ...categoryRoutes,
    ...collectionRoutes,
    ...blogRoutes,
  ]);
  const outPath = path.resolve(process.cwd(), "public/sitemap.xml");
  fs.writeFileSync(outPath, xml);
  console.log(`sitemap: wrote ${outPath}`);
}

// Only run as a script (prebuild step) — guarded so this module can be
// imported for unit testing buildXml() without triggering network calls
// or writing to public/sitemap.xml.
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, "/") || process.argv[1]?.endsWith("generate-sitemap.mjs")) {
  main();
}
