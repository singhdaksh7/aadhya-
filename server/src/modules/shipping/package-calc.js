// Pure package-preparation maths. No database, no provider calls.
//
// Canonical units: grams for weight, millimetres for length. Admin-facing APIs convert to kg/cm at the
// boundary (see package.service.js). Customer-facing specification strings (Product.dimensions,
// Product.specifications) are NEVER read here.

export const LIMITS = {
  weightGrams: { min: 1, max: 50_000 },
  dimensionMm: { min: 5, max: 1_500 },
};

export const DEFAULT_VOLUMETRIC_DIVISOR = 5000; // cm^3 per kg; display estimate only, configurable

const isPosInt = (n) => Number.isInteger(n) && n > 0;

// Variant -> product -> missing. Each field inherits independently so a variant may override only weight.
export function resolveItemShipping({ variant, product, bookFormat }) {
  const pick = (key, fallbacks = []) => {
    for (const [source, row, field] of [["variant", variant, key], ["bookFormat", bookFormat, fallbacks[0]], ["product", product, key]]) {
      if (!row || !field) continue;
      const v = row[field];
      if (isPosInt(v)) return { value: v, source };
    }
    return { value: null, source: "missing" };
  };
  const weight = pick("shipWeightGrams", ["weightGrams"]);
  const length = pick("shipLengthMm");
  const width = pick("shipWidthMm");
  const height = pick("shipHeightMm");
  return {
    weightGrams: weight.value,
    lengthMm: length.value,
    widthMm: width.value,
    heightMm: height.value,
    complete: [weight, length, width, height].every((f) => f.value != null),
    sources: { weight: weight.source, length: length.source, width: width.source, height: height.source },
  };
}

export function validatePackage(pkg) {
  const errors = [];
  const check = (label, value, { min, max }, unit) => {
    if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) errors.push(`${label} must be a valid number.`);
    else if (value < min || value > max) errors.push(`${label} must be between ${min} and ${max} ${unit}.`);
  };
  check("Weight", pkg?.weightGrams, LIMITS.weightGrams, "g");
  check("Length", pkg?.lengthMm, LIMITS.dimensionMm, "mm");
  check("Width", pkg?.widthMm, LIMITS.dimensionMm, "mm");
  check("Height", pkg?.heightMm, LIMITS.dimensionMm, "mm");
  return errors;
}

// Volumetric weight in grams. An ESTIMATE: couriers differ, so the divisor is configurable and Shiprocket's
// own applied weight (returned with serviceability/charges) is what actually bills.
export function volumetricWeightGrams({ lengthMm, widthMm, heightMm }, divisor = DEFAULT_VOLUMETRIC_DIVISOR) {
  if (![lengthMm, widthMm, heightMm].every(isPosInt) || !(divisor > 0)) return null;
  const cm3 = (lengthMm / 10) * (widthMm / 10) * (heightMm / 10);
  return Math.round((cm3 / divisor) * 1000);
}

const sortedDims = (i) => [i.lengthMm, i.widthMm, i.heightMm].sort((a, b) => b - a);

/**
 * Suggest one package for an order.
 * lines: [{ key, name, quantity, shipping: resolveItemShipping(...) }]
 * Returns { weightGrams, lengthMm, widthMm, heightMm, source, productWeightGrams, tareGrams,
 *           requiresConfirmation, warnings[], missing[] }
 *
 * Strategy (deliberately conservative, deterministic):
 *  - one unit of one product            -> that product's own box (AUTO_SINGLE)
 *  - n units of one product              -> same footprint, height multiplied by n (AUTO_ESTIMATE)
 *  - mixed products                      -> each item's dimensions sorted largest-first; footprint is the max
 *                                           of the largest and of the middle dimensions across all units, height is the sum of
 *                                           the smallest dimensions (everything stacked flat). Always flagged for review.
 *  - any item with missing data          -> no dimensions suggested; Admin must enter them.
 * Weight is always sum(item weight x qty) + tare.
 */
export function suggestPackage(lines, { tareGrams = 0 } = {}) {
  const warnings = [];
  const missing = [];
  const tare = Number.isInteger(tareGrams) && tareGrams >= 0 ? tareGrams : 0;
  const active = lines.filter((l) => l.quantity > 0);

  let productWeight = 0;
  let weightComplete = true;
  for (const l of active) {
    if (l.shipping.weightGrams == null) { weightComplete = false; missing.push(`${l.name}: weight`); continue; }
    productWeight += l.shipping.weightGrams * l.quantity;
  }
  const dimsComplete = active.every((l) => [l.shipping.lengthMm, l.shipping.widthMm, l.shipping.heightMm].every((v) => v != null));
  for (const l of active) if ([l.shipping.lengthMm, l.shipping.widthMm, l.shipping.heightMm].some((v) => v == null)) missing.push(`${l.name}: dimensions`);

  const base = { productWeightGrams: weightComplete ? productWeight : null, tareGrams: tare, warnings, missing };
  const weightGrams = weightComplete && active.length ? productWeight + tare : null;
  if (!active.length) return { ...base, weightGrams: null, lengthMm: null, widthMm: null, heightMm: null, source: null, requiresConfirmation: true, warnings: ["Order has no physical items to ship."] };
  if (!weightComplete) warnings.push("Some items have no shipping weight. Enter the package weight manually.");
  if (!dimsComplete) {
    warnings.push("Some items have no package dimensions. Enter the package size manually or choose a preset.");
    return { ...base, weightGrams, lengthMm: null, widthMm: null, heightMm: null, source: null, requiresConfirmation: true };
  }

  const distinct = active.length;
  const units = active.reduce((n, l) => n + l.quantity, 0);
  if (distinct === 1) {
    const { lengthMm, widthMm, heightMm } = active[0].shipping;
    if (units === 1) return { ...base, weightGrams, lengthMm, widthMm, heightMm, source: "AUTO_SINGLE", requiresConfirmation: !weightComplete };
    warnings.push(`${units} units of the same item are assumed stacked along their height. Check the box before confirming.`);
    return { ...base, weightGrams, lengthMm, widthMm, heightMm: heightMm * units, source: "AUTO_ESTIMATE", requiresConfirmation: true };
  }

  let L = 0, W = 0, H = 0;
  for (const l of active) {
    const [a, b, c] = sortedDims(l.shipping);
    L = Math.max(L, a); W = Math.max(W, b); H += c * l.quantity;
  }
  warnings.push("Mixed items: size is a conservative estimate with everything stacked flat. Confirm or choose a preset.");
  return { ...base, weightGrams, lengthMm: L, widthMm: W, heightMm: H, source: "AUTO_ESTIMATE", requiresConfirmation: true };
}

// Which source label applies to what the Admin is confirming?
export function classifyConfirmation(confirmed, suggestion) {
  const same = suggestion && suggestion.source
    && suggestion.weightGrams === confirmed.weightGrams && suggestion.lengthMm === confirmed.lengthMm
    && suggestion.widthMm === confirmed.widthMm && suggestion.heightMm === confirmed.heightMm;
  return same ? suggestion.source : "MANUAL_OVERRIDE";
}

// Shiprocket expects kg and cm.
export const toShiprocketPackage = (pkg) => ({
  weight: Number((pkg.weightGrams / 1000).toFixed(3)),
  length: Number((pkg.lengthMm / 10).toFixed(1)),
  breadth: Number((pkg.widthMm / 10).toFixed(1)),
  height: Number((pkg.heightMm / 10).toFixed(1)),
});
