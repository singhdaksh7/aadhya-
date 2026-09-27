import { describe, it, expect } from "vitest";
import { buildXml } from "../scripts/generate-sitemap.mjs";

describe("sitemap generator", () => {
  it("wraps urls in urlset/loc entries with the site origin", () => {
    const xml = buildXml(["/", "/shop/some-book"]);
    expect(xml).toContain("<urlset");
    expect(xml).toContain("<loc>https://www.aadyasociety.example/</loc>");
    expect(xml).toContain("<loc>https://www.aadyasociety.example/shop/some-book</loc>");
  });

  it("includes book product routes alongside physical product routes", () => {
    // Book products share the same /products listing and /shop/:slug route
    // as physical products — no separate fetch/route is needed for books.
    const productSlugs = ["ceramic-vessel", "monograph-slow-living"];
    const xml = buildXml(productSlugs.map((slug) => `/shop/${slug}`));
    expect(xml).toContain("<loc>https://www.aadyasociety.example/shop/monograph-slow-living</loc>");
  });
});
