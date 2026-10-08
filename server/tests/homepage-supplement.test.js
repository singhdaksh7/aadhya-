import { describe, it, expect } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { validateHomepageSettings } from "../src/modules/pages/homepage-content.js";

const request = supertest(createApp());

describe("homepage supplemental data-driven sections", () => {
  it("adds TESTIMONIALS and BLOG_PREVIEW once, before the newsletter, even under concurrent first visits", async () => {
    // Simulate an older production homepage that predates the two sections.
    await request.get("/api/pages/home"); // ensure the page row exists (page creation itself is not what is under test)
    const home = await prisma.page.findUnique({ where: { slug: "home" } });
    await prisma.pageSection.deleteMany({ where: { pageId: home.id, type: { in: ["TESTIMONIALS", "BLOG_PREVIEW"] } } });
    const responses = await Promise.all([1, 2, 3, 4].map(() => request.get("/api/pages/home")));
    responses.forEach((res) => expect(res.status).toBe(200));

    const page = await prisma.page.findUnique({ where: { slug: "home" }, include: { sections: { orderBy: { sortOrder: "asc" } } } });
    const types = page.sections.map((s) => s.type);
    expect(types.filter((t) => t === "TESTIMONIALS")).toHaveLength(1);
    expect(types.filter((t) => t === "BLOG_PREVIEW")).toHaveLength(1);
    expect(types.indexOf("TESTIMONIALS")).toBeLessThan(types.indexOf("NEWSLETTER"));
    expect(types.indexOf("BLOG_PREVIEW")).toBeLessThan(types.indexOf("NEWSLETTER"));
    // unrelated sections keep their relative order
    expect(types.indexOf("BEST_SELLERS")).toBeLessThan(types.indexOf("SHOP_THE_LOOK"));
    expect(new Set(page.sections.map((s) => s.sortOrder)).size).toBe(page.sections.length);

    // a later visit changes nothing
    await request.get("/api/pages/home");
    const again = await prisma.page.findUnique({ where: { slug: "home" }, include: { sections: true } });
    expect(again.sections).toHaveLength(page.sections.length);
  });

  it("always serves arrays for reviews/posts (empty when none are approved/published) so the storefront can hide the sections", async () => {
    const res = await request.get("/api/pages/home");
    const reviews = res.body.data.sections.find((s) => s.type === "TESTIMONIALS");
    const blog = res.body.data.sections.find((s) => s.type === "BLOG_PREVIEW");
    expect(Array.isArray(reviews.reviews)).toBe(true);
    expect(reviews.reviewSummary.reviewCount).toBeGreaterThanOrEqual(reviews.reviews.length);
    expect(Array.isArray(blog.posts)).toBe(true);
  });

  it("validates the new banner layout and Shop-the-Look subtitle settings", () => {
    expect(validateHomepageSettings("PROMO_BANNERS_2UP", { layout: "SPLIT", showSubtitle: true, items: [] })).toMatchObject({ layout: "SPLIT", showSubtitle: true });
    expect(() => validateHomepageSettings("PROMO_BANNERS_2UP", { layout: "DIAGONAL", items: [] })).toThrow();
    expect(validateHomepageSettings("SHOP_THE_LOOK", { subtitle: "Rooms we love", headingAlign: "CENTER", items: [] })).toMatchObject({ subtitle: "Rooms we love" });
  });
});
