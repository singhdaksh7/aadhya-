import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import { createApp } from "../src/app.js";
import { resetDb, seedTestAdmin } from "./helpers.js";

const app = createApp();
const request = supertest(app);

// Minimal valid 1x1 PNG, used to exercise the real upload pipeline (magic-byte
// check, storage, MediaAsset creation) rather than a fake buffer.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

describe("Media upload -> branding settings integration", () => {
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

  it("requires admin auth to upload media", async () => {
    const res = await request
      .post("/api/admin/media/upload")
      .attach("file", PNG_1X1, "logo.png");
    expect(res.status).toBe(401);
  });

  it("uploads a logo image and returns a server-relative /uploads URL", async () => {
    const res = await request
      .post("/api/admin/media/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", PNG_1X1, "logo.png");

    expect(res.status).toBe(201);
    expect(res.body.data.url).toMatch(/^\/uploads\/products\//);
    expect(res.body.data.mimeType).toBe("image/png");
  });

  it("rejects a disallowed file type even with an image/* mimetype override", async () => {
    const res = await request
      .post("/api/admin/media/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", Buffer.from("<script>alert(1)</script>"), {
        filename: "evil.html",
        contentType: "image/png",
      });
    expect(res.status).toBe(400);
  });

  it("rejects SVG uploads (no server-side SVG sanitization is in place)", async () => {
    const svgBuffer = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    );
    const res = await request
      .post("/api/admin/media/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", svgBuffer, { filename: "logo.svg", contentType: "image/svg+xml" });
    expect(res.status).toBe(400);
    expect(res.body.message || res.body.error?.message || JSON.stringify(res.body)).toMatch(/svg/i);
  });

  it("rejects a double-extension upload trick (logo.png.exe)", async () => {
    const res = await request
      .post("/api/admin/media/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", PNG_1X1, { filename: "logo.png.exe", contentType: "image/png" });
    expect(res.status).toBe(400);
  });

  it("saves the uploaded logo URL through the branding settings and returns it from GET /api/settings", async () => {
    const uploadRes = await request
      .post("/api/admin/media/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", PNG_1X1, "logo.png");
    const logoUrl = uploadRes.body.data.url;

    const putRes = await request
      .put("/api/admin/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        branding: {
          desktopLogo: logoUrl,
          mobileLogo: logoUrl,
          secondaryLogo: logoUrl,
          favicon: logoUrl,
          logoWidthDesktop: 180,
          logoWidthMobile: 100,
        },
      });
    expect(putRes.status).toBe(200);
    expect(putRes.body.data.branding.desktopLogo).toBe(logoUrl);
    expect(putRes.body.data.branding.secondaryLogo).toBe(logoUrl);

    const getRes = await request.get("/api/settings");
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.branding.desktopLogo).toBe(logoUrl);
    expect(getRes.body.data.branding.mobileLogo).toBe(logoUrl);
    expect(getRes.body.data.branding.favicon).toBe(logoUrl);
    expect(getRes.body.data.branding.logoWidthDesktop).toBe(180);
    expect(getRes.body.data.branding.logoWidthMobile).toBe(100);
  });

  it("rejects a logo width outside the safe min/max bounds so header layout can't be broken", async () => {
    const res = await request
      .put("/api/admin/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ branding: { logoWidthDesktop: 5000 } });
    expect(res.status).toBe(400);
  });

  it("footer logo falls back to the primary logo when unset (contract for the storefront Footer)", async () => {
    const uploadRes = await request
      .post("/api/admin/media/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", PNG_1X1, "logo.png");
    const logoUrl = uploadRes.body.data.url;

    await request
      .put("/api/admin/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ branding: { desktopLogo: logoUrl }, footer: { footerLogo: "" } });

    const getRes = await request.get("/api/settings");
    expect(getRes.body.data.footer.footerLogo).toBe("");
    expect(getRes.body.data.branding.desktopLogo).toBe(logoUrl);
  });
});
