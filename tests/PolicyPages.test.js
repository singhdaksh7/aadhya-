import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildPages, PAGE_MAP, ADDRESS_PLACEHOLDER } from "../scripts/policies/build-policy-pages.mjs";

const source = readFileSync(path.resolve(process.cwd(), "docs/policies/final-tushaqsa-policies.md"), "utf8");
const pages = buildPages();
const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").replace(/ ([.,:;])/g, "$1").trim();

describe("final policy pages (built from the canonical source)", () => {
  it("keeps the canonical source placeholder, but never publishes it", () => {
    expect(source).toContain(ADDRESS_PLACEHOLDER);
    for (const p of Object.values(pages)) expect(p.content).not.toContain("Insert complete");
    expect(pages.terms.content).not.toContain("Business Address");
  });

  it("builds exactly the four routes with the required titles", () => {
    expect(Object.keys(pages).sort()).toEqual(["privacy", "returns", "shipping", "terms"]);
    expect(pages.returns.seoTitle).toBe("Refund, Return & Cancellation Policy | Tushaqsa Homedecor");
    expect(pages.shipping.seoTitle).toBe("Shipping & Delivery Policy | Tushaqsa Homedecor");
    expect(pages.privacy.seoTitle).toBe("Privacy Policy | Tushaqsa Homedecor");
    expect(pages.terms.seoTitle).toBe("Terms & Conditions | Tushaqsa Homedecor");
  });

  it("carries every source word (formatting only) and no raw markdown", () => {
    for (const p of PAGE_MAP) {
      const body = source.split(/^# (.+)$/m);
      const src = body[body.indexOf(p.heading) + 1].split("\n").filter((l) => !l.includes(ADDRESS_PLACEHOLDER)).join("\n")
        .replace(/^- /gm, "").replace(/^\d+\. /gm, "").replace(/^#{2,3} /gm, "").replace(/\*\*|\*/g, "").replace(/\s+/g, " ").trim();
      expect(text(pages[p.slug].content)).toBe(src);
      expect(pages[p.slug].content).not.toMatch(/\*\*|^#|^- /m);
    }
  });

  it("preserves the key policy values and dates", () => {
    const r = text(pages.returns.content);
    expect(r).toContain("within 24 hours of receiving the order");
    expect(r).toContain("unboxing video");
    expect(r).toContain("7–10 working days");
    const s = text(pages.shipping.content);
    expect(s).toContain("within India only");
    expect(s).toContain("2–5 business days");
    expect(s).toContain("5–10 business days from the date of dispatch");
    expect(s).not.toMatch(/₹|Rs\.? ?\d/);
    expect(text(pages.privacy.content)).toContain("Last Updated: 11 November 2026");
    expect(text(pages.privacy.content)).toContain("Grievance Officer: Dr Mahak");
    expect(text(pages.terms.content)).toContain("Last Updated: 12 November 2026");
  });

  it("links only to existing policy routes, never to itself", () => {
    const hrefs = (h) => [...h.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
    expect(hrefs(pages.shipping.content)).toEqual(["/returns"]);
    expect(hrefs(pages.terms.content).sort()).toEqual(["/returns", "/shipping"]);
    expect(hrefs(pages.returns.content)).toEqual([]);
  });

  it("uses a verified address when one is supplied", () => {
    const withAddr = buildPages({ address: "1 Test Road" });
    expect(text(withAddr.terms.content)).toContain("Business Address: 1 Test Road");
  });
});
