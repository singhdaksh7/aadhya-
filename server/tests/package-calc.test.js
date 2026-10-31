import { describe, it, expect } from "vitest";
import { resolveItemShipping, suggestPackage, validatePackage, volumetricWeightGrams, classifyConfirmation, toShiprocketPackage } from "../src/modules/shipping/package-calc.js";
import { shippingToColumns, shippingFromRow } from "../src/modules/shipping/shipping-fields.js";

const full = { shipWeightGrams: 400, shipLengthMm: 280, shipWidthMm: 230, shipHeightMm: 60 };
const line = (name, quantity, shipping) => ({ key: name, name, quantity, shipping });

describe("resolveItemShipping", () => {
  it("uses the variant, falling back per-field to the product", () => {
    const r = resolveItemShipping({ variant: { shipWeightGrams: 900 }, product: full });
    expect(r).toMatchObject({ weightGrams: 900, lengthMm: 280, widthMm: 230, heightMm: 60, complete: true });
    expect(r.sources).toMatchObject({ weight: "variant", length: "product" });
  });
  it("reports missing data instead of inventing defaults", () => {
    const r = resolveItemShipping({ product: { shipWeightGrams: 400 } });
    expect(r.complete).toBe(false);
    expect(r.lengthMm).toBeNull();
    expect(r.sources.length).toBe("missing");
  });
  it("uses a book format weight when nothing else sets it", () => {
    expect(resolveItemShipping({ product: {}, bookFormat: { weightGrams: 350 } }).weightGrams).toBe(350);
  });
});

describe("validatePackage", () => {
  const ok = { weightGrams: 1200, lengthMm: 300, widthMm: 200, heightMm: 100 };
  it("accepts sensible values", () => expect(validatePackage(ok)).toEqual([]));
  it.each([
    [{ ...ok, weightGrams: 0 }], [{ ...ok, lengthMm: -5 }], [{ ...ok, widthMm: NaN }],
    [{ ...ok, heightMm: 99999 }], [{ ...ok, weightGrams: "heavy" }], [{ ...ok, lengthMm: 10.5 }],
  ])("rejects %j", (pkg) => expect(validatePackage(pkg).length).toBeGreaterThan(0));
});

describe("suggestPackage", () => {
  it("single product: its own box plus configurable tare", () => {
    const s = suggestPackage([line("Bag", 1, resolveItemShipping({ product: full }))], { tareGrams: 150 });
    expect(s).toMatchObject({ weightGrams: 550, lengthMm: 280, widthMm: 230, heightMm: 60, source: "AUTO_SINGLE", requiresConfirmation: false });
  });
  it("tare is not hardcoded", () => {
    expect(suggestPackage([line("Bag", 1, resolveItemShipping({ product: full }))]).weightGrams).toBe(400);
  });
  it("same item x3: weight multiplies, height stacks, needs confirmation", () => {
    const s = suggestPackage([line("Bag", 3, resolveItemShipping({ product: full }))], { tareGrams: 100 });
    expect(s).toMatchObject({ weightGrams: 1300, lengthMm: 280, widthMm: 230, heightMm: 180, source: "AUTO_ESTIMATE", requiresConfirmation: true });
  });
  it("mixed items: never sums every dimension; flat-stack estimate flagged for review", () => {
    const a = resolveItemShipping({ product: { shipWeightGrams: 500, shipLengthMm: 300, shipWidthMm: 200, shipHeightMm: 50 } });
    const b = resolveItemShipping({ product: { shipWeightGrams: 250, shipLengthMm: 150, shipWidthMm: 250, shipHeightMm: 100 } });
    const s = suggestPackage([line("A", 1, a), line("B", 2, b)], { tareGrams: 0 });
    expect(s.weightGrams).toBe(1000);
    expect([s.lengthMm, s.widthMm, s.heightMm]).toEqual([300, 200, 50 + 100 * 2]);
    expect(s.lengthMm).toBeLessThan(300 + 150); // not a naive sum of lengths
    expect(s).toMatchObject({ source: "AUTO_ESTIMATE", requiresConfirmation: true });
  });
  it("missing dimensions: no dimensions suggested, Admin must enter them", () => {
    const s = suggestPackage([line("Bag", 1, resolveItemShipping({ product: { shipWeightGrams: 400 } }))]);
    expect(s.lengthMm).toBeNull();
    expect(s.requiresConfirmation).toBe(true);
    expect(s.missing.join()).toMatch(/dimensions/);
  });
  it("missing weight: no total weight", () => {
    const s = suggestPackage([line("Bag", 1, resolveItemShipping({ product: { shipLengthMm: 100, shipWidthMm: 100, shipHeightMm: 100 } }))]);
    expect(s.weightGrams).toBeNull();
  });
});

describe("confirmation + units", () => {
  const sug = { source: "AUTO_SINGLE", weightGrams: 550, lengthMm: 280, widthMm: 230, heightMm: 60 };
  it("unchanged suggestion keeps its auto source; any edit is MANUAL_OVERRIDE", () => {
    expect(classifyConfirmation({ weightGrams: 550, lengthMm: 280, widthMm: 230, heightMm: 60 }, sug)).toBe("AUTO_SINGLE");
    expect(classifyConfirmation({ weightGrams: 600, lengthMm: 280, widthMm: 230, heightMm: 60 }, sug)).toBe("MANUAL_OVERRIDE");
  });
  it("volumetric weight is an estimate from a configurable divisor", () => {
    expect(volumetricWeightGrams({ lengthMm: 300, widthMm: 200, heightMm: 100 }, 5000)).toBe(1200);
    expect(volumetricWeightGrams({ lengthMm: 300, widthMm: 200, heightMm: 100 }, 4000)).toBe(1500);
  });
  it("Shiprocket receives kg and cm", () => {
    expect(toShiprocketPackage({ weightGrams: 1350, lengthMm: 280, widthMm: 230, heightMm: 60 })).toEqual({ weight: 1.35, length: 28, breadth: 23, height: 6 });
  });
  it("admin boundary converts kg/cm to g/mm and rejects bad numbers", () => {
    expect(shippingToColumns({ weightKg: 0.4, lengthCm: 28, widthCm: 23, heightCm: 6 })).toEqual({ shipWeightGrams: 400, shipLengthMm: 280, shipWidthMm: 230, shipHeightMm: 60 });
    expect(shippingToColumns({ weightKg: null })).toEqual({ shipWeightGrams: null });
    expect(shippingToColumns(undefined)).toEqual({});
    expect(() => shippingToColumns({ lengthCm: -3 })).toThrow();
    expect(() => shippingToColumns({ weightKg: 9999 })).toThrow();
    expect(shippingFromRow({ shipWeightGrams: 400, shipLengthMm: 280, shipWidthMm: null, shipHeightMm: 60 })).toEqual({ weightKg: 0.4, lengthCm: 28, widthCm: null, heightCm: 6 });
  });
});
