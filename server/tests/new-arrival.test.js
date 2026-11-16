import { describe, it, expect } from "vitest";
import {
  NEW_ARRIVAL_WINDOW_MS,
  isEffectiveNewArrival,
  isWithinAutoNewArrivalWindow,
  newArrivalWhere,
} from "../src/modules/products/newArrival.js";
import { serializePublicProduct } from "../src/modules/products/product.service.js";

const NOW = new Date("2026-11-16T10:00:00.000Z");
const ago = (ms) => new Date(NOW.getTime() - ms);
const DAY = 24 * 60 * 60 * 1000;

describe("hybrid New Arrival rule (auto 7-day window OR manual flag)", () => {
  it("a product created now is an effective New Arrival", () => {
    expect(isEffectiveNewArrival({ isNewArrival: false, createdAt: NOW }, NOW)).toBe(true);
  });
  it("a 6-day-old product is a New Arrival", () => {
    expect(isEffectiveNewArrival({ isNewArrival: false, createdAt: ago(6 * DAY) }, NOW)).toBe(true);
  });
  it("is inclusive at exactly 7 days and expires right after", () => {
    expect(isWithinAutoNewArrivalWindow({ createdAt: ago(NEW_ARRIVAL_WINDOW_MS) }, NOW)).toBe(true);
    expect(isWithinAutoNewArrivalWindow({ createdAt: ago(NEW_ARRIVAL_WINDOW_MS + 1) }, NOW)).toBe(false);
  });
  it("a product older than 7 days without the manual flag is not a New Arrival", () => {
    expect(isEffectiveNewArrival({ isNewArrival: false, createdAt: ago(10 * DAY) }, NOW)).toBe(false);
  });
  it("an old product with the manual flag stays a New Arrival", () => {
    expect(isEffectiveNewArrival({ isNewArrival: true, createdAt: ago(100 * DAY) }, NOW)).toBe(true);
  });
  it("a new product with the manual flag off is still automatically a New Arrival", () => {
    expect(isEffectiveNewArrival({ isNewArrival: false, createdAt: ago(3 * DAY) }, NOW)).toBe(true);
  });
  it("editing an old product (updatedAt = now) does not restart the window", () => {
    expect(isEffectiveNewArrival({ isNewArrival: false, createdAt: ago(30 * DAY), updatedAt: NOW }, NOW)).toBe(false);
  });
  it("tolerates missing/invalid timestamps", () => {
    expect(isEffectiveNewArrival({ isNewArrival: false }, NOW)).toBe(false);
    expect(isEffectiveNewArrival({ isNewArrival: false, createdAt: "garbage" }, NOW)).toBe(false);
    expect(isEffectiveNewArrival(null, NOW)).toBe(false);
  });
  it("the Prisma where fragment mirrors the helper (list/home/collection queries)", () => {
    const cutoff = new Date(NOW.getTime() - NEW_ARRIVAL_WINDOW_MS);
    expect(newArrivalWhere(true, NOW)).toEqual({ OR: [{ isNewArrival: true }, { createdAt: { gte: cutoff } }] });
    expect(newArrivalWhere(false, NOW)).toEqual({ isNewArrival: false, createdAt: { lt: cutoff } });
  });
  it("public serialization (cards, badge, PDP, search) exposes the effective flag and keeps the manual one", () => {
    const base = { id: "1", price: 10, images: [], variants: [], reviews: [] };
    const fresh = serializePublicProduct({ ...base, isNewArrival: false, createdAt: new Date() });
    expect(fresh.isNewArrival).toBe(true);
    expect(fresh.isNewArrivalManual).toBe(false);
    const old = serializePublicProduct({ ...base, isNewArrival: false, createdAt: ago(60 * DAY) });
    expect(old.isNewArrival).toBe(false);
    const pinned = serializePublicProduct({ ...base, isNewArrival: true, createdAt: ago(60 * DAY) });
    expect(pinned.isNewArrival).toBe(true);
    expect(pinned.isNewArrivalManual).toBe(true);
  });
});
