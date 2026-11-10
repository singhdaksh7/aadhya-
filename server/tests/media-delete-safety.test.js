import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { uploadRootDir } from "../src/modules/uploads/storage.js";
import { resetDb, seedTestAdmin, seedTestCategory, seedTestProduct } from "./helpers.js";
import { env } from "../src/config/env.js";

const app = createApp();
const tick = () => new Promise((r) => setTimeout(r, 80));

describe("Media Library delete is reference-safe", () => {
  let token, category;
  const files = [];
  const mk = (name) => { const f = path.join(uploadRootDir, name); fs.writeFileSync(f, "x"); files.push(f); return { f, url: `/uploads/products/${name}` }; };
  const asset = (url) => prisma.mediaAsset.create({ data: { fileName: path.basename(url), originalName: "o.jpg", url, storageKey: url, mimeType: "image/jpeg", size: 1 } });
  const product = (slug) => seedTestProduct({ category, name: slug, slug });
  const delMedia = (id, q = "") => request(app).delete(`/api/admin/media/${id}${q}`).set("Authorization", `Bearer ${token}`);
  const delImg = (pid, iid) => request(app).delete(`/api/admin/products/${pid}/images/${iid}`).set("Authorization", `Bearer ${token}`);

  beforeEach(async () => {
    await resetDb();
    await seedTestAdmin();
    token = (await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password })).body.data.accessToken;
    category = await seedTestCategory({ name: "Brass" });
  });
  afterEach(() => files.splice(0).forEach((f) => fs.rmSync(f, { force: true })));

  it("deletes record and file for an unused asset", async () => {
    const { f, url } = mk("md-unused.jpg");
    const a = await asset(url);
    expect((await delMedia(a.id)).status).toBe(200);
    await tick();
    expect(fs.existsSync(f)).toBe(false);
    expect(await prisma.mediaAsset.count()).toBe(0);
  });

  it("blocks delete (409, count in message) when a product image uses it, even with force; product stays renderable", async () => {
    const { f, url } = mk("md-used.jpg");
    const a = await asset(url);
    const p1 = await product("p1"); const p2 = await product("p2");
    await prisma.productImage.create({ data: { productId: p1.id, url, isPrimary: true } });
    await prisma.productImage.create({ data: { productId: p2.id, url, isPrimary: true } });
    for (const q of ["", "?force=true"]) {
      const res = await delMedia(a.id, q);
      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe("This image is currently used by 2 products and cannot be deleted.");
      expect(res.body.error.details.productCount).toBe(2);
    }
    await tick();
    expect(fs.existsSync(f)).toBe(true);
    expect(await prisma.mediaAsset.count()).toBe(1);
    const pub = await request(app).get(`/api/products/${p1.slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.data.images[0].url).toBe(url);
  });

  it("blocks delete when only Product.ogImage uses it, and matches an absolute/query form of the url", async () => {
    const { f, url } = mk("md-og.jpg");
    const a = await asset(url);
    const p = await product("p-og");
    await prisma.product.update({ where: { id: p.id }, data: { ogImage: `https://api.example.com${url}?v=2` } });
    expect((await delMedia(a.id)).status).toBe(409);
    await tick();
    expect(fs.existsSync(f)).toBe(true);
  });

  it("ogImage alone keeps the file when the last product image relation is removed", async () => {
    const { f, url } = mk("md-og2.jpg");
    const p = await product("p-og2");
    await prisma.product.update({ where: { id: p.id }, data: { ogImage: url } });
    const img = await prisma.productImage.create({ data: { productId: p.id, url, isPrimary: true } });
    await delImg(p.id, img.id);
    await tick();
    expect(fs.existsSync(f)).toBe(true);
  });

  it("a media asset record keeps the file when a product image relation is removed", async () => {
    const { f, url } = mk("md-lib.jpg");
    await asset(url);
    const p = await product("p-lib");
    const img = await prisma.productImage.create({ data: { productId: p.id, url, isPrimary: true } });
    await delImg(p.id, img.id);
    await tick();
    expect(fs.existsSync(f)).toBe(true);
  });

  it("after the last product reference is removed, the asset can be deleted and the orphan file is cleaned", async () => {
    const { f, url } = mk("md-last.jpg");
    const a = await asset(url);
    const p = await product("p-last");
    const img = await prisma.productImage.create({ data: { productId: p.id, url, isPrimary: true } });
    expect((await delMedia(a.id)).status).toBe(409);
    await delImg(p.id, img.id);
    await tick();
    expect(fs.existsSync(f)).toBe(true); // asset record still references it
    expect((await delMedia(a.id)).status).toBe(200);
    await tick();
    expect(fs.existsSync(f)).toBe(false);
  });
});
