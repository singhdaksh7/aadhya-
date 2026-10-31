import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/app.js";
import { resetDb, seedTestAdmin } from "./helpers.js";
import { isPopupLive } from "../src/modules/popup/popup.routes.js";

const request = supertest(createApp());

const valid = {
  enabled: true,
  title: "Diwali gifting is here",
  description: "Handcrafted gifts for every home.",
  desktopImage: "/uploads/popup-desktop.jpg",
  mobileImage: "https://example.com/popup-mobile.jpg",
  ctaLabel: "Shop gifts",
  ctaUrl: "/gifting",
  dismissLabel: "Maybe later",
  delaySeconds: 4,
  frequency: "EVERY_X_DAYS",
  days: 3,
  startDate: "",
  endDate: "",
  targeting: "SELECTED",
  routes: ["/", "/gifting"],
};

describe("Promotional popup API", () => {
  let token;
  const put = (body) => request.put("/api/admin/popup").set("Authorization", `Bearer ${token}`).send(body);

  beforeEach(async () => {
    await resetDb();
    await seedTestAdmin({ email: "admin@test.local", password: "TestPassword123!" });
    const login = await request.post("/api/admin/auth/login").send({ email: "admin@test.local", password: "TestPassword123!" });
    token = login.body.data.accessToken;
  });

  it("public GET returns null when nothing is configured", async () => {
    const res = await request.get("/api/popup");
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it("admin endpoints require auth", async () => {
    expect((await request.get("/api/admin/popup")).status).toBe(401);
    expect((await request.put("/api/admin/popup").send(valid)).status).toBe(401);
  });

  it("admin GET returns defaults before the first save", async () => {
    const res = await request.get("/api/admin/popup").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(false);
    expect(res.body.data.frequency).toBe("SESSION");
  });

  it("hides a disabled popup from the public endpoint but keeps it for admins", async () => {
    expect((await put({ ...valid, enabled: false })).status).toBe(200);
    expect((await request.get("/api/popup")).body.data).toBeNull();
    const admin = await request.get("/api/admin/popup").set("Authorization", `Bearer ${token}`);
    expect(admin.body.data.title).toBe(valid.title);
  });

  it("serves an enabled popup with no date window", async () => {
    expect((await put(valid)).status).toBe(200);
    const res = await request.get("/api/popup");
    expect(res.body.data.title).toBe(valid.title);
    expect(res.body.data.routes).toEqual(["/", "/gifting"]);
    expect(typeof res.body.data.version).toBe("number");
  });

  it("hides the popup before its start date and after its end date", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const farFuture = new Date(Date.now() + 2 * 86400000).toISOString();
    await put({ ...valid, startDate: future, endDate: farFuture });
    expect((await request.get("/api/popup")).body.data).toBeNull();

    const past = new Date(Date.now() - 2 * 86400000).toISOString();
    const recent = new Date(Date.now() - 86400000).toISOString();
    await put({ ...valid, startDate: past, endDate: recent });
    expect((await request.get("/api/popup")).body.data).toBeNull();

    await put({ ...valid, startDate: recent, endDate: future });
    expect((await request.get("/api/popup")).body.data).not.toBeNull();
  });

  it("is never exposed through the public settings endpoint", async () => {
    await put(valid);
    const res = await request.get("/api/settings");
    expect(res.body.data.promoPopup).toBeUndefined();
  });

  it("ignores an unvalidated promoPopup sent through the generic settings endpoint", async () => {
    const res = await request
      .put("/api/admin/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ general: { storeName: "Tushaqsa" }, promoPopup: { enabled: true, title: "<script>" } });
    expect(res.status).toBe(200);
    expect((await request.get("/api/popup")).body.data).toBeNull();
  });

  describe("validation", () => {
    it.each([
      ["javascript: CTA url", { ctaUrl: "javascript:alert(1)" }],
      ["protocol-relative CTA url", { ctaUrl: "//evil.example.com" }],
      ["data: image", { desktopImage: "data:text/html;base64,AAAA" }],
      ["unknown frequency", { frequency: "HOURLY" }],
      ["unknown targeting", { targeting: "EVERYWHERE" }],
      ["negative delay", { delaySeconds: -1 }],
      ["absurd delay", { delaySeconds: 99999 }],
      ["zero days", { days: 0 }],
      ["end before start", { startDate: "2030-02-02T00:00:00.000Z", endDate: "2030-01-01T00:00:00.000Z" }],
      ["invalid date", { startDate: "not-a-date" }],
      ["selected targeting without routes", { targeting: "SELECTED", routes: [] }],
      ["route without leading slash", { routes: ["gifting"] }],
      ["enabled without title", { title: "" }],
      ["CTA label without URL", { ctaLabel: "Go", ctaUrl: "" }],
      ["overlong title", { title: "x".repeat(121) }],
    ])("rejects %s", async (_name, patch) => {
      const res = await put({ ...valid, ...patch });
      expect(res.status).toBe(400);
    });
  });
});

describe("isPopupLive", () => {
  const now = new Date("2030-06-15T12:00:00.000Z");
  it("requires enabled === true", () => {
    expect(isPopupLive({ enabled: false }, now)).toBe(false);
    expect(isPopupLive(null, now)).toBe(false);
    expect(isPopupLive({ enabled: true }, now)).toBe(true);
  });
  it("is inclusive of the window edges and exclusive outside", () => {
    const popup = { enabled: true, startDate: "2030-06-15T12:00:00.000Z", endDate: "2030-06-15T12:00:00.000Z" };
    expect(isPopupLive(popup, now)).toBe(true);
    expect(isPopupLive({ ...popup, startDate: "2030-06-15T12:00:01.000Z" }, now)).toBe(false);
    expect(isPopupLive({ ...popup, endDate: "2030-06-15T11:59:59.000Z", startDate: "" }, now)).toBe(false);
  });
});
