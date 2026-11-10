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
const tick = () => new Promise((r) => setTimeout(r, 80)); // local fs.rm is fire-and-forget

describe("Product duplication: images and shared files", () => {
  let token;
  let source;
  const files = [];
  const urls = ["dup-img-a.jpg", "dup-img-b.jpg", "dup-img-c.jpg"].map((n) => `/uploads/products/${n}`);
  const onDisk = (url) => fs.existsSync(path.join(uploadRootDir, path.basename(url)));
  const auth = (r) => r.set("Authorization", `Bearer ${token}`);
  const duplicate = (id) => auth(request(app).post(`/api/admin/products/${id}/duplicate`));

  beforeEach(async () => {
    await resetDb();
    await seedTestAdmin();
    token = (await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password })).body.data.accessToken;
    const category = await seedTestCategory({ name: "Brass" });
    source = await seedTestProduct({ category, name: "Urli", slug: "urli", sku: "URLI-1" });
    for (const u of urls) {
      const f = path.join(uploadRootDir, path.basename(u));
      fs.writeFileSync(f, "x");
      files.push(f);
    }
    // Deliberately out-of-order insert + primary on the middle sortOrder-0 image
    await prisma.productImage.create({ data: { productId: source.id, url: urls[1], altText: "B", sortOrder: 1, isPrimary: false } });
    await prisma.productImage.create({ data: { productId: source.id, url: urls[0], altText: "A", sortOrder: 0, isPrimary: true } });
    await prisma.productImage.create({ data: { productId: source.id, url: urls[2], altText: "C", sortOrder: 2, isPrimary: false } });
    await prisma.productVariant.create({ data: { productId: source.id, name: "L", sku: "URLI-1-L", stockQuantity: 4 } });
  });

  afterEach(() => files.splice(0).forEach((f) => fs.rmSync(f, { force: true })));

  it("clones every image as new rows with same url, order, alt text and exactly one primary", async () => {
    const before = await prisma.productImage.findMany({ where: { productId: source.id }, orderBy: { sortOrder: "asc" } });
    const res = await duplicate(source.id);
    expect(res.status).toBe(201);
    const dup = res.body.data;
    expect(dup.images.map((i) => i.url)).toEqual(urls);
    expect(dup.images.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
    expect(dup.images.map((i) => i.altText)).toEqual(["A", "B", "C"]);
    expect(dup.images.filter((i) => i.isPrimary)).toHaveLength(1);
    expect(dup.images[0].isPrimary).toBe(true);
    // new child ids, owned by the duplicate
    const beforeIds = new Set(before.map((i) => i.id));
    dup.images.forEach((i) => { expect(beforeIds.has(i.id)).toBe(false); expect(i.productId).toBe(dup.id); });
    // source untouched
    const after = await prisma.productImage.findMany({ where: { productId: source.id }, orderBy: { sortOrder: "asc" } });
    expect(after).toEqual(before);
    // variants cloned with new ids/SKUs
    expect(dup.variants).toHaveLength(1);
    expect(dup.variants[0].id).not.toBe((await prisma.productVariant.findFirst({ where: { productId: source.id } })).id);
    expect(dup.variants[0].sku).toBe("URLI-1-L-COPY");
  });

  it("gives a stored url verbatim (canonical path, not a resolved absolute url)", async () => {
    const dup = (await duplicate(source.id)).body.data;
    dup.images.forEach((i) => expect(i.url.startsWith("/uploads/products/")).toBe(true));
  });

  it("deleting the duplicate product does NOT delete files the original still uses", async () => {
    const dup = (await duplicate(source.id)).body.data;
    const del = await auth(request(app).delete(`/api/admin/products/${dup.id}`));
    expect(del.status).toBeLessThan(300);
    await tick();
    urls.forEach((u) => expect(onDisk(u)).toBe(true));
    expect(await prisma.productImage.count({ where: { productId: source.id } })).toBe(3);
  });

  it("removing an image from the duplicate removes only that relation and keeps the shared file", async () => {
    const dup = (await duplicate(source.id)).body.data;
    const del = await auth(request(app).delete(`/api/admin/products/${dup.id}/images/${dup.images[0].id}`));
    expect(del.status).toBeLessThan(300);
    await tick();
    expect(onDisk(urls[0])).toBe(true);
    expect(await prisma.productImage.count({ where: { productId: source.id } })).toBe(3);
    const rest = await prisma.productImage.findMany({ where: { productId: dup.id }, orderBy: { sortOrder: "asc" } });
    expect(rest).toHaveLength(2);
    expect(rest.filter((i) => i.isPrimary)).toHaveLength(1); // primary re-assigned
  });

  it("still removes the file once no product references it any more", async () => {
    const solo = await seedTestProduct({ name: "Solo", slug: "solo" });
    const f = path.join(uploadRootDir, "dup-img-solo.jpg");
    fs.writeFileSync(f, "x"); files.push(f);
    const img = await prisma.productImage.create({ data: { productId: solo.id, url: "/uploads/products/dup-img-solo.jpg", isPrimary: true } });
    await auth(request(app).delete(`/api/admin/products/${solo.id}/images/${img.id}`));
    await tick();
    expect(fs.existsSync(f)).toBe(false);
  });

  it("deleting the original keeps files used by a duplicate", async () => {
    const dup = (await duplicate(source.id)).body.data;
    await auth(request(app).delete(`/api/admin/products/${source.id}`));
    await tick();
    urls.forEach((u) => expect(onDisk(u)).toBe(true));
    expect(await prisma.productImage.count({ where: { productId: dup.id } })).toBe(3);
  });

  it("title/price-only update of the duplicate keeps its images", async () => {
    const dup = (await duplicate(source.id)).body.data;
    const up = await auth(request(app).patch(`/api/admin/products/${dup.id}`)).send({ name: "Renamed", price: 999 });
    expect(up.status).toBe(200);
    expect(up.body.data.images).toHaveLength(3);
  });

  it("rolls back the whole duplicate if cloning images fails", async () => {
    const { duplicateProduct } = await import("../src/modules/products/product.service.js");
    const origTx = prisma.$transaction.bind(prisma);
    let n = 0;
    prisma.$transaction = (fn, ...rest) => origTx(async (tx) => fn(new Proxy(tx, {
      get: (t, k) => k === "productImage"
        ? { create: (args) => { if (++n === 2) throw new Error("boom"); return t.productImage.create(args); } }
        : t[k],
    })), ...rest);
    const before = await prisma.product.count();
    try {
      await expect(duplicateProduct(source.id, null)).rejects.toThrow("boom");
    } finally { prisma.$transaction = origTx; }
    expect(await prisma.product.count()).toBe(before);
    expect(await prisma.productVariant.count({ where: { sku: { endsWith: "-COPY" } } })).toBe(0);
  });
});
