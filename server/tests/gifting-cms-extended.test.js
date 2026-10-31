import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { resetDb, seedTestAdmin } from "./helpers.js";
import { validateHomepageSettings } from "../src/modules/pages/homepage-content.js";
import { resolveFeaturedGiftProducts } from "../src/modules/pages/page.service.js";

const request = supertest(createApp());

describe("gifting section schemas: admin-editable gaps", () => {
  it("accepts a story layout orientation and rejects unknown ones", () => {
    const ok = { heading: "S", stories: [{ heading: "A", layout: "IMAGE_TOP" }] };
    expect(() => validateHomepageSettings("CURATED_STORIES", ok)).not.toThrow();
    expect(() => validateHomepageSettings("CURATED_STORIES", { heading: "S", stories: [{ heading: "A", layout: "DIAGONAL" }] })).toThrow();
  });

  it("accepts a benefit image and rejects unsafe image URLs", () => {
    expect(() => validateHomepageSettings("GIFTING_BENEFITS", { heading: "H", cards: [{ title: "T", icon: "gift", image: "/uploads/i.png" }] })).not.toThrow();
    expect(() => validateHomepageSettings("GIFTING_BENEFITS", { heading: "H", cards: [{ title: "T", image: "javascript:alert(1)" }] })).toThrow();
  });

  it("accepts budget min/max and rejects negatives", () => {
    expect(() => validateHomepageSettings("GIFTS_BY_BUDGET", { heading: "H", tiers: [{ label: "L", minPrice: 0, maxPrice: 1000, destinationUrl: "" }] })).not.toThrow();
    expect(() => validateHomepageSettings("GIFTS_BY_BUDGET", { heading: "H", tiers: [{ label: "L", minPrice: -1 }] })).toThrow();
  });

  it("accepts every featured-gifts source and query fields", () => {
    for (const sourceMode of ["AUTO", "MANUAL", "COLLECTION", "QUERY"]) {
      expect(() => validateHomepageSettings("FEATURED_GIFTS", { heading: "H", sourceMode })).not.toThrow();
    }
    expect(() => validateHomepageSettings("FEATURED_GIFTS", { heading: "H", sourceMode: "QUERY", queryCategory: "decor", querySearch: "brass", queryMinPrice: 100, queryMaxPrice: 900, querySort: "price_asc" })).not.toThrow();
    expect(() => validateHomepageSettings("FEATURED_GIFTS", { heading: "H", sourceMode: "RANDOM" })).toThrow();
    expect(() => validateHomepageSettings("FEATURED_GIFTS", { heading: "H", querySort: "chaos" })).toThrow();
  });
});

describe("featured gifts server-side resolution", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns null for AUTO so the storefront keeps its featured fallback", async () => {
    expect(await resolveFeaturedGiftProducts({ sourceMode: "AUTO" })).toBeNull();
  });

  it("returns empty lists for incomplete MANUAL / COLLECTION configs", async () => {
    expect(await resolveFeaturedGiftProducts({ sourceMode: "MANUAL", productIds: [] })).toEqual([]);
    expect(await resolveFeaturedGiftProducts({ sourceMode: "COLLECTION", collectionSlug: "" })).toEqual([]);
  });

  it("QUERY resolves with no matches to an empty list", async () => {
    expect(await resolveFeaturedGiftProducts({ sourceMode: "QUERY", querySearch: "does-not-exist-xyz" })).toEqual([]);
  });
});

describe("Gifting in header navigation and footer CMS", () => {
  let token;
  beforeEach(async () => {
    await resetDb();
    await seedTestAdmin({ email: "admin@test.local", password: "TestPassword123!" });
    const login = await request.post("/api/admin/auth/login").send({ email: "admin@test.local", password: "TestPassword123!" });
    token = login.body.data.accessToken;
  });

  it("saves a GIFTING primary-nav item", async () => {
    const res = await request
      .put("/api/admin/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ header: { primaryNav: { items: [{ id: "n1", label: "Gifting", enabled: true, destinationType: "GIFTING", destination: "/gifting" }] } } });
    expect(res.status).toBe(200);
    expect(res.body.data.header.primaryNav.items[0].destinationType).toBe("GIFTING");
  });

  it("saves a GIFTING footer link and serves it from the public settings", async () => {
    const res = await request
      .put("/api/admin/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ footer: { footerColumns: [{ id: "fc", title: "Company", enabled: true, links: [{ label: "Artisan Gifting", type: "GIFTING", url: "/gifting" }] }] } });
    expect(res.status).toBe(200);
    const pub = await request.get("/api/settings");
    expect(pub.body.data.footer.footerColumns[0].links[0]).toMatchObject({ type: "GIFTING", url: "/gifting" });
  });

  it("includes the Gifting link in the default footer columns", async () => {
    await prisma.siteSetting.deleteMany();
    const pub = await request.get("/api/settings");
    const links = pub.body.data.footer.footerColumns.flatMap((c) => c.links);
    expect(links.some((l) => l.url === "/gifting")).toBe(true);
  });
});
