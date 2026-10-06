import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/app.js";
import { resetDb, seedTestAdmin } from "./helpers.js";

const app = createApp();
const request = supertest(app);

describe("Storefront Header CMS Settings API", () => {
  let adminToken;

  beforeEach(async () => {
    await resetDb();
    await seedTestAdmin({ email: "admin@test.local", password: "TestPassword123!" });
    const loginRes = await request.post("/api/admin/auth/login").send({
      email: "admin@test.local",
      password: "TestPassword123!",
    });
    adminToken = loginRes.body.data.accessToken;
  });

  it("GET /api/settings returns header settings with defaults", async () => {
    const res = await request.get("/api/settings");
    expect(res.status).toBe(200);
    expect(res.body.data.header).toBeDefined();
    expect(res.body.data.header.showUtilityBar).toBe(true);
  });

  it("PUT /api/admin/settings accepts extended header CMS fields", async () => {
    const headerPayload = {
      enabled: true,
      stickyMode: "scroll",
      utilityBarCenterText: "Free Express Shipping on Orders > ₹3,000",
      showPromoTicker: true,
      promoTickerSpeed: 60,
      promoTickerPauseOnHover: true,
      showPrimaryNav: true,
      showNewBadge: true,
      enableMegaMenu: true,
      showCircularCategories: true,
      circularCategoryLimit: 16,
      showCircularCategoryArrows: false,
      utilityBar: {
        enabled: true,
        centerMessage: "Get ₹500 off on your first purchase",
        items: [
          {
            id: "ub-1",
            enabled: true,
            label: "Free Shipping Above ₹2,499",
            icon: "truck",
            linkType: "internal",
            url: "/shipping",
            showDesktop: true,
            showMobile: false,
            sortOrder: 1,
          },
        ],
      },
      promoTicker: {
        enabled: true,
        speed: 45,
        direction: "left",
        pauseOnHover: true,
        separator: "diamond",
        hideWhenEmpty: true,
        fallbackMessage: "Crafted by Master Indian Artisans",
      },
      mainHeader: {
        showSearch: true,
        searchPlaceholder: "Search brass lamps & ceramics...",
        logoAlignment: "center",
      },
      primaryNav: {
        enabled: true,
        mode: "MANUAL",
        showNewBadge: true,
        items: [
          {
            id: "nav-1",
            label: "Curated Edits",
            enabled: true,
            destinationType: "collection",
            destination: "/collections/curated",
            badge: "NEW",
          },
        ],
      },
      megaMenu: {
        enabled: true,
        columns: 3,
        dropdownWidth: "contained",
      },
      circularCategories: {
        enabled: true,
        maxItems: 10,
        showArrows: false,
      },
    };

    const res = await request
      .put("/api/admin/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ header: headerPayload });

    expect(res.status).toBe(200);
    expect(res.body.data.header.stickyMode).toBe("scroll");
    expect(res.body.data.header.circularCategoryLimit).toBe(16);
    expect(res.body.data.header.utilityBarCenterText).toBe("Free Express Shipping on Orders > ₹3,000");
  });

  it("PUT /api/admin/settings rejects invalid ticker speed outside 10-300 range", async () => {
    const res = await request
      .put("/api/admin/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        header: {
          promoTickerSpeed: 5, // below min 10
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/header\.promoTickerSpeed/);
  });

  it("PUT /api/admin/settings rejects invalid circular category limit outside 1-24 range", async () => {
    const res = await request
      .put("/api/admin/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        header: {
          circularCategoryLimit: 50, // above max 24
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/header\.circularCategoryLimit/);
  });

  it("PUT /api/admin/settings maintains backward compatibility with legacy flat header fields", async () => {
    const legacyPayload = {
      header: {
        showUtilityBar: false,
        stickyHeader: false,
        showSearch: true,
        showCategoryCircles: true,
      },
    };

    const res = await request
      .put("/api/admin/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(legacyPayload);

    expect(res.status).toBe(200);
    expect(res.body.data.header.showUtilityBar).toBe(false);
    expect(res.body.data.header.stickyHeader).toBe(false);
  });
});

describe("Header CMS: nav mega menu config", () => {
  let adminToken;
  const put = (header) =>
    request.put("/api/admin/settings").set("Authorization", `Bearer ${adminToken}`).send({ header });
  const navItem = (extra = {}) => ({
    id: "nav-1",
    label: "Lighting",
    enabled: true,
    destinationType: "CATEGORY",
    categoryId: "cat-1",
    categorySlug: "lighting",
    destination: "/shop/category/lighting",
    megaMenuMode: "AUTO_FROM_CATEGORY",
    ...extra,
  });

  beforeEach(async () => {
    await resetDb();
    await seedTestAdmin({ email: "admin@test.local", password: "TestPassword123!" });
    const loginRes = await request.post("/api/admin/auth/login").send({
      email: "admin@test.local",
      password: "TestPassword123!",
    });
    adminToken = loginRes.body.data.accessToken;
  });

  it("defaults are non-sticky with circular categories off", async () => {
    const res = await request.get("/api/settings");
    expect(res.body.data.header.stickyHeader).toBe(false);
    expect(res.body.data.header.showCategoryCircles).toBe(false);
  });

  it("accepts nav items with auto + manual mega menu config and promo card", async () => {
    const res = await put({
      stickyMode: "none",
      circularCategories: { enabled: false },
      primaryNav: {
        enabled: true,
        mode: "MANUAL",
        items: [
          navItem({ promoCard: { enabled: true, image: "/uploads/a.jpg", title: "Edit", ctaUrl: "/shop", altText: "x" } }),
          navItem({
            id: "nav-2",
            label: "Books",
            destinationType: "BOOKS",
            destination: "/books",
            megaMenuMode: "MANUAL",
            manualColumns: [{ id: "c1", heading: "Browse", enabled: true, links: [{ label: "Fiction", destination: "/shop/category/fiction" }] }],
          }),
        ],
      },
    });
    expect(res.status).toBe(200);
    const items = res.body.data.header.primaryNav.items;
    expect(items[0].megaMenuMode).toBe("AUTO_FROM_CATEGORY");
    expect(items[0].categoryId).toBe("cat-1");
    expect(items[0].promoCard.title).toBe("Edit");
    expect(items[1].manualColumns[0].links[0].label).toBe("Fiction");
  });

  it("accepts legacy lower-case destination types and items without mega menu fields", async () => {
    const res = await put({
      primaryNav: { items: [{ id: "l1", label: "Old", enabled: true, destinationType: "category", destination: "/shop" }] },
    });
    expect(res.status).toBe(200);
  });

  it("rejects unknown mega menu modes", async () => {
    const res = await put({ primaryNav: { items: [navItem({ megaMenuMode: "HOVER" })] } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/megaMenuMode/);
  });

  it("rejects unknown destination types", async () => {
    const res = await put({ primaryNav: { items: [navItem({ destinationType: "TELEPORT" })] } });
    expect(res.status).toBe(400);
  });

  it("rejects unsafe URLs in destinations, manual links and promo CTA", async () => {
    for (const bad of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "java\tscript:alert(1)", "data:text/html,x", "vbscript:x"]) {
      const dest = await put({ primaryNav: { items: [navItem({ destination: bad })] } });
      expect(dest.status).toBe(400);

      const link = await put({
        primaryNav: { items: [navItem({ megaMenuMode: "MANUAL", manualColumns: [{ links: [{ label: "x", destination: bad }] }] })] },
      });
      expect(link.status).toBe(400);

      const promo = await put({ primaryNav: { items: [navItem({ promoCard: { enabled: true, ctaUrl: bad } })] } });
      expect(promo.status).toBe(400);
    }
  });

  it("enforces array limits (items, columns, links)", async () => {
    const tooManyItems = Array.from({ length: 31 }, (_, i) => navItem({ id: `n${i}` }));
    expect((await put({ primaryNav: { items: tooManyItems } })).status).toBe(400);

    const cols = Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, links: [] }));
    expect((await put({ primaryNav: { items: [navItem({ manualColumns: cols })] } })).status).toBe(400);

    const links = Array.from({ length: 13 }, (_, i) => ({ label: `L${i}`, destination: "/x" }));
    expect((await put({ primaryNav: { items: [navItem({ manualColumns: [{ links }] })] } })).status).toBe(400);
  });

  it("keeps partial legacy settings valid", async () => {
    const res = await put({ showUtilityBar: true, stickyHeader: true, showCategoryCircles: true });
    expect(res.status).toBe(200);
    expect(res.body.data.header.stickyHeader).toBe(true);
  });
});
