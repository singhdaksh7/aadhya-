import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";
import { resetDb, registerCustomer, seedTestProduct, VALID_ACCOUNT_ADDRESS } from "./helpers.js";

const app = createApp();

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

async function createAddress(accessToken, overrides = {}) {
  return request(app)
    .post("/api/account/addresses")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ ...VALID_ACCOUNT_ADDRESS, ...overrides });
}

describe("address CRUD", () => {
  it("creates an address and it becomes default automatically (first address)", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const res = await createAddress(accessToken);
    expect(res.status).toBe(201);
    expect(res.body.data.isDefault).toBe(true);
  });

  it("lists addresses ordered with default first", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    await createAddress(accessToken, { label: "Home" });
    await createAddress(accessToken, { label: "Work", isDefault: true });
    const res = await request(app).get("/api/account/addresses").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].label).toBe("Work");
    expect(res.body.data[0].isDefault).toBe(true);
  });

  it("edits an address", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const created = await createAddress(accessToken);
    const res = await request(app)
      .patch(`/api/account/addresses/${created.body.data.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ city: "Mumbai" });
    expect(res.status).toBe(200);
    expect(res.body.data.city).toBe("Mumbai");
  });

  it("deletes an address", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const created = await createAddress(accessToken);
    const res = await request(app).delete(`/api/account/addresses/${created.body.data.id}`).set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const list = await request(app).get("/api/account/addresses").set("Authorization", `Bearer ${accessToken}`);
    expect(list.body.data).toHaveLength(0);
  });

  it("deleting the default address does not auto-promote another address to default (documents current behavior)", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const first = await createAddress(accessToken, { label: "Home" }); // becomes default (first address)
    await createAddress(accessToken, { label: "Work" });
    await request(app).delete(`/api/account/addresses/${first.body.data.id}`).set("Authorization", `Bearer ${accessToken}`);
    const list = await request(app).get("/api/account/addresses").set("Authorization", `Bearer ${accessToken}`);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].isDefault).toBe(false);
  });

  it("only one address can be default at a time when creating a new default", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    await createAddress(accessToken, { label: "Home" }); // default (first)
    await createAddress(accessToken, { label: "Work", isDefault: true });
    const list = await request(app).get("/api/account/addresses").set("Authorization", `Bearer ${accessToken}`);
    const defaults = list.body.data.filter((a) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].label).toBe("Work");
  });

  it("only one address can be default at a time when setting default via PATCH", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const home = await createAddress(accessToken, { label: "Home" });
    const work = await createAddress(accessToken, { label: "Work" });
    await request(app).patch(`/api/account/addresses/${work.body.data.id}`).set("Authorization", `Bearer ${accessToken}`).send({ isDefault: true });
    const list = await request(app).get("/api/account/addresses").set("Authorization", `Bearer ${accessToken}`);
    const defaults = list.body.data.filter((a) => a.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(work.body.data.id);
    void home;
  });

  it("sets a different address as default via the dedicated endpoint", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    await createAddress(accessToken, { label: "Home" });
    const work = await createAddress(accessToken, { label: "Work" });
    const res = await request(app).post(`/api/account/addresses/${work.body.data.id}/default`).set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const list = await request(app).get("/api/account/addresses").set("Authorization", `Bearer ${accessToken}`);
    expect(list.body.data.find((a) => a.id === work.body.data.id).isDefault).toBe(true);
    expect(list.body.data.filter((a) => a.isDefault)).toHaveLength(1);
  });

  it("rejects invalid fields (bad phone / bad postal code)", async () => {
    const { accessToken } = await registerCustomer(app, { email: "a@test.local" });
    const badPhone = await createAddress(accessToken, { phone: "12345" });
    expect(badPhone.status).toBe(400);
    const badPostal = await createAddress(accessToken, { postalCode: "123" });
    expect(badPostal.status).toBe(400);
    const missingLabel = await request(app)
      .post("/api/account/addresses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...VALID_ACCOUNT_ADDRESS, label: "" });
    expect(missingLabel.status).toBe(400);
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/account/addresses");
    expect(res.status).toBe(401);
  });
});

describe("address ownership (IDOR)", () => {
  async function setupTwoCustomers() {
    const a = await registerCustomer(app, { email: "customer-a@test.local" });
    const b = await registerCustomer(app, { email: "customer-b@test.local" });
    const addressA = await createAddress(a.accessToken, { label: "A Home" });
    return { a, b, addressAId: addressA.body.data.id };
  }

  it("customer B cannot view customer A's address list contents", async () => {
    const { b } = await setupTwoCustomers();
    const list = await request(app).get("/api/account/addresses").set("Authorization", `Bearer ${b.accessToken}`);
    expect(list.body.data).toHaveLength(0);
  });

  it("customer B cannot update customer A's address", async () => {
    const { b, addressAId } = await setupTwoCustomers();
    const res = await request(app)
      .patch(`/api/account/addresses/${addressAId}`)
      .set("Authorization", `Bearer ${b.accessToken}`)
      .send({ city: "Hacked" });
    expect(res.status).toBe(404);
  });

  it("customer B cannot delete customer A's address", async () => {
    const { b, addressAId } = await setupTwoCustomers();
    const res = await request(app).delete(`/api/account/addresses/${addressAId}`).set("Authorization", `Bearer ${b.accessToken}`);
    expect(res.status).toBe(404);
  });

  it("customer B cannot set customer A's address as default", async () => {
    const { b, addressAId } = await setupTwoCustomers();
    const res = await request(app).post(`/api/account/addresses/${addressAId}/default`).set("Authorization", `Bearer ${b.accessToken}`);
    expect(res.status).toBe(404);
  });

  it("customer B cannot use customer A's address at checkout via savedAddressId", async () => {
    const { b, addressAId } = await setupTwoCustomers();
    const product = await seedTestProduct({ slug: "idor-product" });
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${b.accessToken}`)
      .send({
        items: [{ slug: product.slug, quantity: 1 }],
        customer: { name: "B", email: "customer-b@test.local", phone: "9876543210" },
        shippingAddress: { fullName: "B", phone: "9876543210", addressLine1: "x", city: "x", state: "x", postalCode: "560001", country: "India" },
        savedAddressId: addressAId,
      });
    // Rejected before an order is created — ownership check runs before pricing — 404, never A's address data.
    expect(res.status).toBe(404);
  });
});
