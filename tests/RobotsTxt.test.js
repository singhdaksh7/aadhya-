import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const STORE_ORIGIN = "https://tushaqsa.aadyavocational.com";

describe("public/robots.txt", () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), "public/robots.txt"), "utf8");
  const lines = content.split(/\r?\n/).map((l) => l.trim());

  it("allows crawling in general but disallows admin, account, api, cart and checkout", () => {
    expect(lines).toContain("User-agent: *");
    expect(lines).toContain("Allow: /");
    for (const p of ["/admin", "/account", "/api/", "/cart", "/checkout"]) expect(lines).toContain(`Disallow: ${p}`);
  });

  it("never blocks the public storefront pages it wants indexed", () => {
    for (const p of ["/", "/shop", "/gifting", "/offers"]) expect(lines).not.toContain(`Disallow: ${p}`);
  });

  it("points at the absolute sitemap URL on the production store host (robots.txt requires an absolute URL)", () => {
    expect(lines).toContain(`Sitemap: ${STORE_ORIGIN}/sitemap.xml`);
    expect(lines.filter((l) => /^Sitemap:/i.test(l))).toHaveLength(1);
  });
});
