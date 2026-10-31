import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/lib/prisma.js";
import { resetDb, seedTestAdmin, seedTestProduct } from "./helpers.js";

const app = createApp();
let token;

const preview = async (price, address) => {
  const p = await seedTestProduct({ price });
  const res = await request(app).post("/api/checkout/preview").send({ items: [{ slug: p.slug, quantity: 1 }], ...(address ? { shippingAddress: address } : {}) });
  expect(res.status).toBe(200);
  return res.body.data;
};
const saveShipping = (shipping) => request(app).put("/api/admin/settings").set("Authorization", `Bearer ${token}`).send({ shipping });

beforeEach(async () => {
  await resetDb();
  await seedTestAdmin();
  token = (await request(app).post("/api/admin/auth/login").send({ email: env.admin.email, password: env.admin.password })).body.data.accessToken;
  // The live store's shape: a zone for every state whose own rate says "free above 2499".
  const zone = await prisma.shippingZone.create({ data: { name: "India (all states)", states: ["Karnataka", "Uttar Pradesh"], postalCodes: [] } });
  await prisma.shippingRate.create({ data: { zoneId: zone.id, rate: 150, freeAbove: 2499 } });
});
afterAll(async () => { await resetDb(); await prisma.$disconnect(); });

describe("the Admin free-shipping setting is final", () => {
  const address = { fullName: "T", phone: "9876543210", addressLine1: "1 Rd", city: "Bengaluru", state: "Karnataka", postalCode: "560001", country: "India" };

  it("1,499 is free when the minimum is 1,099, even though the zone rate says 2,499", async () => {
    expect((await saveShipping({ freeShippingThreshold: 1099, standardShippingAmount: 150 })).status).toBe(200);
    expect((await preview(1499, address)).shipping).toBe(0);
    expect((await preview(1098, address)).shipping).toBe(150);
  });

  it("changing the setting to 999 takes effect on the very next checkout, and the public settings agree", async () => {
    await saveShipping({ freeShippingThreshold: 1099, standardShippingAmount: 150 });
    expect((await preview(1000, address)).shipping).toBe(150);
    expect((await saveShipping({ freeShippingThreshold: 999, standardShippingAmount: 150 })).status).toBe(200); // the admin form always saves the whole block
    expect((await preview(1000, address)).shipping).toBe(0);
    expect((await preview(998, address)).shipping).toBe(150);
    const pub = (await request(app).get("/api/settings")).body.data;
    expect(pub.freeShippingThreshold ?? pub.shipping?.freeShippingThreshold).toBe(999);
  });

  it("the fee below the minimum is the standard fee from settings", async () => {
    await saveShipping({ freeShippingThreshold: 1099, standardShippingAmount: 80 });
    expect((await preview(500, address)).shipping).toBe(80);
    await saveShipping({ freeShippingThreshold: 1099, standardShippingAmount: 120 });
    expect((await preview(500, address)).shipping).toBe(120);
  });
});
