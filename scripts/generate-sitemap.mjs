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

function buildXml(urls) {
  const entries = urls
    .map((url) => `  <url><loc>${SITE_URL}${url}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

async function main() {
  let productRoutes = [];
  try {
    const slugs = await fetchAllProductSlugs();
    productRoutes = slugs.map((slug) => `/shop/${slug}`);
    console.log(`sitemap: included ${productRoutes.length} product routes from ${API_URL}`);
  } catch {
    console.warn(`sitemap: could not reach ${API_URL}, shipping static routes only`);
  }

  const xml = buildXml([...STATIC_ROUTES, ...productRoutes]);
  const outPath = path.resolve(process.cwd(), "public/sitemap.xml");
  fs.writeFileSync(outPath, xml);
  console.log(`sitemap: wrote ${outPath}`);
}

main();
