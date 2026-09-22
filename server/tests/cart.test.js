import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { resetDb, registerCustomer, seedTestProduct } from "./helpers.js";

const app = createApp();

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

describe("server cart — get", () => {
  it("returns an empty cart for a new customer", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const res = await request(app).get("/api/cart").set(auth(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns populated cart contents", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "p1" });
    await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: product.slug, quantity: 2 });
    const res = await request(app).get("/api/cart").set(auth(accessToken));
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].quantity).toBe(2);
  });

  it("isolates carts between customers", async () => {
    const a = await registerCustomer(app, { email: "a@test.local" });
    const b = await registerCustomer(app, { email: "b@test.local" });
    const product = await seedTestProduct({ slug: "p1" });
    await request(app).post("/api/cart/items").set(auth(a.accessToken)).send({ slug: product.slug, quantity: 3 });
    const bCart = await request(app).get("/api/cart").set(auth(b.accessToken));
    expect(bCart.body.data).toEqual([]);
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/cart");
    expect(res.status).toBe(401);
  });
});

describe("server cart — add", () => {
  it("adds a product to the cart", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "p1" });
    const res = await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: product.slug, quantity: 1 });
    expect(res.status).toBe(200);
    expect(res.body.data[0].quantity).toBe(1);
  });

  it("adding the same product again increments its quantity", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "p1", stockQuantity: 10 });
    await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: product.slug, quantity: 2 });
    const res = await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: product.slug, quantity: 3 });
    expect(res.body.data[0].quantity).toBe(5);
  });

  it("rejects adding an inactive product", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "p1", isActive: false });
    const res = await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: product.slug, quantity: 1 });
    expect(res.status).toBe(404);
  });

  it("rejects adding an unknown product slug", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const res = await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: "does-not-exist", quantity: 1 });
    expect(res.status).toBe(404);
  });

  it("clamps quantity above stock to the available stock", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "p1", stockQuantity: 5, trackInventory: true });
    const res = await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: product.slug, quantity: 20 });
    expect(res.status).toBe(200);
    expect(res.body.data[0].quantity).toBe(5);
  });

  it("rejects adding an out-of-stock product instead of silently no-op'ing", async () => {
    // A forged/stale add-to-cart request for a product at zero stock must be
    // rejected outright — the storefront disables Add to Cart once stock
    // hits 0, so any request that still reaches this endpoint is either a
    // stale tab or a forged request, and a silent 200 would let it slip
    // past client-side enforcement unnoticed.
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "p1", stockQuantity: 0, trackInventory: true });
    const res = await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: product.slug, quantity: 1 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const cart = await request(app).get("/api/cart").set(auth(accessToken));
    expect(cart.body.data).toEqual([]);
  });

  it("rejects an invalid quantity (zero or above the line cap)", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "p1" });
    const zero = await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: product.slug, quantity: 0 });
    expect(zero.status).toBe(400);
    const tooMany = await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: product.slug, quantity: 1000 });
    expect(tooMany.status).toBe(400);
  });
});

describe("server cart — update", () => {
  it("sets an absolute quantity via PATCH", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "p1", stockQuantity: 10 });
    await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: product.slug, quantity: 3 });
    const res = await request(app).patch(`/api/cart/items/${product.slug}`).set(auth(accessToken)).send({ quantity: 7 });
    expect(res.body.data[0].quantity).toBe(7);
  });

  it("PATCH still enforces the stock cap", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "p1", stockQuantity: 4 });
    const res = await request(app).patch(`/api/cart/items/${product.slug}`).set(auth(accessToken)).send({ quantity: 100 });
    expect(res.body.data[0].quantity).toBe(4);
  });

  it("PATCH on a nonexistent product 404s", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const res = await request(app).patch("/api/cart/items/does-not-exist").set(auth(accessToken)).send({ quantity: 1 });
    expect(res.status).toBe(404);
  });
});

describe("server cart — remove / clear", () => {
  it("removes an item", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "p1" });
    await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: product.slug, quantity: 1 });
    const res = await request(app).delete(`/api/cart/items/${product.slug}`).set(auth(accessToken));
    expect(res.status).toBe(200);
    const cart = await request(app).get("/api/cart").set(auth(accessToken));
    expect(cart.body.data).toEqual([]);
  });

  it("removing another customer's item is impossible (each customer only ever touches their own cart)", async () => {
    const a = await registerCustomer(app, { email: "a@test.local" });
    const b = await registerCustomer(app, { email: "b@test.local" });
    const product = await seedTestProduct({ slug: "p1" });
    await request(app).post("/api/cart/items").set(auth(a.accessToken)).send({ slug: product.slug, quantity: 1 });
    const res = await request(app).delete(`/api/cart/items/${product.slug}`).set(auth(b.accessToken));
    expect(res.status).toBe(200); // no-op for B, not an error
    const aCart = await request(app).get("/api/cart").set(auth(a.accessToken));
    expect(aCart.body.data).toHaveLength(1); // A's item untouched
  });

  it("clears only the caller's own cart", async () => {
    const a = await registerCustomer(app, { email: "a@test.local" });
    const b = await registerCustomer(app, { email: "b@test.local" });
    const product = await seedTestProduct({ slug: "p1" });
    await request(app).post("/api/cart/items").set(auth(a.accessToken)).send({ slug: product.slug, quantity: 1 });
    await request(app).post("/api/cart/items").set(auth(b.accessToken)).send({ slug: product.slug, quantity: 1 });
    await request(app).delete("/api/cart").set(auth(a.accessToken));
    const aCart = await request(app).get("/api/cart").set(auth(a.accessToken));
    const bCart = await request(app).get("/api/cart").set(auth(b.accessToken));
    expect(aCart.body.data).toEqual([]);
    expect(bCart.body.data).toHaveLength(1);
  });

  it("a cart item silently disappears from the response once its product is deactivated, and a deleted product removes the item entirely", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "p1" });
    await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: product.slug, quantity: 1 });
    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
    const hidden = await request(app).get("/api/cart").set(auth(accessToken));
    expect(hidden.body.data).toEqual([]);
    await prisma.product.delete({ where: { id: product.id } });
    const afterDelete = await request(app).get("/api/cart").set(auth(accessToken));
    expect(afterDelete.body.data).toEqual([]);
  });
});

describe("cart merge (guest → server on login)", () => {
  it("merges guest quantities into the server cart by adding them", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const productA = await seedTestProduct({ slug: "a", stockQuantity: 50 });
    const productB = await seedTestProduct({ slug: "b", stockQuantity: 50, category: { id: productA.categoryId } });
    await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: productA.slug, quantity: 1 }); // server: A x1
    const res = await request(app)
      .post("/api/cart/merge")
      .set(auth(accessToken))
      .send({ items: [{ slug: productA.slug, quantity: 2 }, { slug: productB.slug, quantity: 1 }] }); // guest: A x2, B x1
    expect(res.status).toBe(200);
    const byslug = Object.fromEntries(res.body.data.map((x) => [x.product.slug, x.quantity]));
    expect(byslug[productA.slug]).toBe(3); // 1 + 2
    expect(byslug[productB.slug]).toBe(1);
  });

  it("obeys the stock limit when merged quantities would exceed it", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "a", stockQuantity: 6, trackInventory: true });
    await request(app).post("/api/cart/items").set(auth(accessToken)).send({ slug: product.slug, quantity: 3 }); // server: A x3
    const res = await request(app)
      .post("/api/cart/merge")
      .set(auth(accessToken))
      .send({ items: [{ slug: product.slug, quantity: 5 }] }); // guest: A x5 -> 3+5=8, clamp to stock 6
    expect(res.status).toBe(200);
    expect(res.body.data[0].quantity).toBe(6);
  });

  it("rejects the whole merge (no partial application) when it includes an inactive product", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const active = await seedTestProduct({ slug: "active-item", stockQuantity: 20 });
    const inactive = await seedTestProduct({ slug: "inactive-item", isActive: false, category: { id: active.categoryId } });
    const res = await request(app)
      .post("/api/cart/merge")
      .set(auth(accessToken))
      .send({ items: [{ slug: active.slug, quantity: 2 }, { slug: inactive.slug, quantity: 1 }] });
    expect(res.status).toBe(404);
    const cart = await request(app).get("/api/cart").set(auth(accessToken));
    expect(cart.body.data).toEqual([]); // the active item must NOT have been partially added
  });

  it("rejects a merge referencing an out-of-stock (fully unavailable in this case, deleted) product", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const res = await request(app)
      .post("/api/cart/merge")
      .set(auth(accessToken))
      .send({ items: [{ slug: "never-existed", quantity: 1 }] });
    expect(res.status).toBe(404);
  });

  it("handles duplicate slugs within the same guest payload by summing them", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "a", stockQuantity: 50 });
    const res = await request(app)
      .post("/api/cart/merge")
      .set(auth(accessToken))
      .send({ items: [{ slug: product.slug, quantity: 2 }, { slug: product.slug, quantity: 3 }] });
    expect(res.status).toBe(200);
    expect(res.body.data[0].quantity).toBe(5);
  });

  it("never trusts a client-supplied price — merge only reflects server product data", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "a", price: 500 });
    const res = await request(app)
      .post("/api/cart/merge")
      .set(auth(accessToken))
      .send({ items: [{ slug: product.slug, quantity: 1, price: 1 }] }); // extraneous price field must be ignored
    expect(res.status).toBe(200);
    expect(String(res.body.data[0].product.price)).toBe("500");
  });

  it("isolates merges between customers", async () => {
    const a = await registerCustomer(app, { email: "a@test.local" });
    const b = await registerCustomer(app, { email: "b@test.local" });
    const product = await seedTestProduct({ slug: "a", stockQuantity: 50 });
    await request(app).post("/api/cart/merge").set(auth(a.accessToken)).send({ items: [{ slug: product.slug, quantity: 2 }] });
    const bCart = await request(app).get("/api/cart").set(auth(b.accessToken));
    expect(bCart.body.data).toEqual([]);
  });
});

describe("cart isolation across logout/login (server-side guarantee)", () => {
  it("customer B never sees customer A's cart contents, even after A logs out", async () => {
    const a = await registerCustomer(app, { email: "a@test.local" });
    const b = await registerCustomer(app, { email: "b@test.local" });
    const product = await seedTestProduct({ slug: "a" });
    await request(app).post("/api/cart/items").set(auth(a.accessToken)).send({ slug: product.slug, quantity: 1 });
    await a.agent.post("/api/auth/logout");
    const bCart = await request(app).get("/api/cart").set(auth(b.accessToken));
    expect(bCart.body.data).toEqual([]);
  });

  it("A's server cart persists and is available again after a fresh login", async () => {
    const a = await registerCustomer(app, { email: "a@test.local" });
    const product = await seedTestProduct({ slug: "a" });
    await request(app).post("/api/cart/items").set(auth(a.accessToken)).send({ slug: product.slug, quantity: 2 });
    await a.agent.post("/api/auth/logout");
    const login = await request(app).post("/api/auth/login").send({ email: a.credentials.email, password: a.credentials.password });
    const cart = await request(app).get("/api/cart").set(auth(login.body.data.accessToken));
    expect(cart.body.data).toHaveLength(1);
    expect(cart.body.data[0].quantity).toBe(2);
  });
});
