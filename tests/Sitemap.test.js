import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const STORE_ORIGIN = "https://tushaqsa.aadyavocational.com";

// SITE_URL is read when the module loads, so load it fresh with the env override cleared.
async function loadGenerator() {
  vi.resetModules();
  vi.stubEnv("SITE_URL", "");
  delete process.env.SITE_URL;
  return import("../scripts/generate-sitemap.mjs");
}

describe("sitemap generator", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to the production store origin", async () => {
    const { SITE_URL } = await loadGenerator();
    expect(SITE_URL).toBe(STORE_ORIGIN);
  });

  it("honours a SITE_URL override and strips a trailing slash", async () => {
    vi.resetModules();
    vi.stubEnv("SITE_URL", "https://staging.example.test/");
    const { buildXml } = await import("../scripts/generate-sitemap.mjs");
    expect(buildXml(["/"])).toContain("<loc>https://staging.example.test/</loc>");
  });

  it("wraps urls in urlset/loc entries with the store origin", async () => {
    const { buildXml } = await loadGenerator();
    const xml = buildXml(["/", "/shop/some-book"]);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain(`<loc>${STORE_ORIGIN}/</loc>`);
    expect(xml).toContain(`<loc>${STORE_ORIGIN}/shop/some-book</loc>`);
    expect(xml).not.toMatch(/example|localhost/);
  });

  it("includes book product routes alongside physical product routes", async () => {
    // Book products share the /products listing and the /shop/:slug route; no separate route is needed.
    const { buildXml } = await loadGenerator();
    const xml = buildXml(["ceramic-vessel", "monograph-slow-living"].map((slug) => `/shop/${slug}`));
    expect(xml).toContain(`<loc>${STORE_ORIGIN}/shop/ceramic-vessel</loc>`);
    expect(xml).toContain(`<loc>${STORE_ORIGIN}/shop/monograph-slow-living</loc>`);
  });

  it("static routes cover the real storefront pages, are unique, and exclude private areas", async () => {
    const { STATIC_ROUTES } = await loadGenerator();
    for (const r of ["/", "/shop", "/gifting", "/offers", "/new-arrivals", "/best-sellers", "/contact", "/faq"]) expect(STATIC_ROUTES).toContain(r);
    expect(new Set(STATIC_ROUTES).size).toBe(STATIC_ROUTES.length);
    expect(STATIC_ROUTES.every((r) => r.startsWith("/"))).toBe(true);
    expect(STATIC_ROUTES.some((r) => /^\/(admin|account|cart|checkout|api)(\/|$)/.test(r))).toBe(false);
  });

  it("every static route is a real route in the app (no fake URLs)", async () => {
    const fs = await import("node:fs");
    const app = fs.readFileSync("src/App.jsx", "utf8");
    const { STATIC_ROUTES } = await loadGenerator();
    const declared = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
    const missing = STATIC_ROUTES.filter((r) => r !== "/" && !declared.includes(r));
    expect(missing).toEqual([]);
  });
});
