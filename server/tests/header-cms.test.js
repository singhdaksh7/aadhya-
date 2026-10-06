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
