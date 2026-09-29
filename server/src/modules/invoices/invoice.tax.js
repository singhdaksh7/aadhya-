// Server-side validation helpers for GST-related invoice fields.
// These are pattern/shape checks only — no external verification against
// any government API is performed or claimed.

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const HSN_PATTERN = /^[0-9]{4,8}$/;
const STATE_CODE_PATTERN = /^\d{2}$/;
export const VALID_GST_RATES = [0, 5, 12, 18, 28];

export function isValidGstin(value) {
  if (typeof value !== "string") return false;
  return GSTIN_PATTERN.test(value.trim().toUpperCase());
}

export function isValidHsnCode(value) {
  if (typeof value !== "string") return false;
  return HSN_PATTERN.test(value.trim());
}

export function isValidGstRate(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return false;
  return VALID_GST_RATES.includes(num);
}

export function isValidStateCode(value) {
  if (typeof value !== "string") return false;
  return STATE_CODE_PATTERN.test(value.trim());
}

// Throws a descriptive Error (caller wraps into ApiError.badRequest as needed)
// rather than returning a boolean, for use in admin settings/product forms
// where a specific message is useful.
export function assertValidGstin(value, fieldName = "gstin") {
  if (value == null || value === "") return;
  if (!isValidGstin(value)) throw new Error(`${fieldName} must be a valid 15-character GSTIN`);
}

export function assertValidHsnCode(value, fieldName = "hsnCode") {
  if (value == null || value === "") return;
  if (!isValidHsnCode(value)) throw new Error(`${fieldName} must be 4-8 digits`);
}

export function assertValidGstRate(value, fieldName = "gstRate") {
  if (value == null) return;
  if (!isValidGstRate(value)) throw new Error(`${fieldName} must be one of ${VALID_GST_RATES.join(", ")}`);
}

export function assertValidStateCode(value, fieldName = "stateCode") {
  if (value == null || value === "") return;
  if (!isValidStateCode(value)) throw new Error(`${fieldName} must be a 2-digit GST state code`);
}
