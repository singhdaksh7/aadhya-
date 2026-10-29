/**
 * Customer-facing product specifications: an ordered list of free-form
 * { label, value } rows. Legacy rows were stored as a { label: value } object
 * (jsonb does not keep key order), so both shapes are accepted on read.
 */
export const MAX_SPEC_ROWS = 50;

export function normalizeSpecifications(raw) {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.entries(raw).map(([label, value]) => ({ label, value }))
      : [];
  return rows
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      label: typeof row.label === "string" ? row.label.trim() : "",
      value: typeof row.value === "string" ? row.value.trim() : "",
    }))
    .filter((row) => row.label && row.value)
    .slice(0, MAX_SPEC_ROWS);
}
