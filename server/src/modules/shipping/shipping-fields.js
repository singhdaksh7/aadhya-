import { z } from "zod";
import { ApiError } from "../../utils/ApiError.js";
import { LIMITS } from "./package-calc.js";

// Admin-facing product/variant shipping block: kg + cm in, grams + mm stored. Every field optional so drafts
// can be saved incomplete; completeness is enforced only when a real shipment is created.
const field = z.coerce.number().finite().nullable().optional();
export const shippingInputSchema = z.object({ weightKg: field, lengthCm: field, widthCm: field, heightCm: field }).nullable().optional();

function convert(label, value, factor, { min, max }, unit) {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.round(Number(value) * factor);
  if (!Number.isFinite(n) || n < min || n > max) throw ApiError.badRequest(`${label} must be between ${min / (factor === 1000 ? 1000 : 10)} and ${max / (factor === 1000 ? 1000 : 10)} ${unit}.`);
  return n;
}

// undefined => leave columns untouched; null/{} => clear; object => set provided fields.
export function shippingToColumns(shipping) {
  if (shipping === undefined) return {};
  if (shipping === null) return { shipWeightGrams: null, shipLengthMm: null, shipWidthMm: null, shipHeightMm: null };
  const cols = {};
  if ("weightKg" in shipping) cols.shipWeightGrams = convert("Weight", shipping.weightKg, 1000, LIMITS.weightGrams, "kg");
  if ("lengthCm" in shipping) cols.shipLengthMm = convert("Length", shipping.lengthCm, 10, LIMITS.dimensionMm, "cm");
  if ("widthCm" in shipping) cols.shipWidthMm = convert("Width", shipping.widthCm, 10, LIMITS.dimensionMm, "cm");
  if ("heightCm" in shipping) cols.shipHeightMm = convert("Height", shipping.heightCm, 10, LIMITS.dimensionMm, "cm");
  return cols;
}

export const shippingFromRow = (row) => ({
  weightKg: row.shipWeightGrams == null ? null : Number((row.shipWeightGrams / 1000).toFixed(3)),
  lengthCm: row.shipLengthMm == null ? null : Number((row.shipLengthMm / 10).toFixed(1)),
  widthCm: row.shipWidthMm == null ? null : Number((row.shipWidthMm / 10).toFixed(1)),
  heightCm: row.shipHeightMm == null ? null : Number((row.shipHeightMm / 10).toFixed(1)),
});
export const withShipping = (row) => (row ? { ...row, shipping: shippingFromRow(row) } : row);
