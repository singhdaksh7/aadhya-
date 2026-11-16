// Customer-facing product specifications: an ordered list of free-form { label, value } rows.
// Older products stored a { label: value } object, so both shapes are read as rows.
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
    .filter((row) => row.label && row.value);
}

// Labels a custom specification row may use for the dedicated Material / Dimensions fields.
const DEDICATED_SPEC_FIELDS = [
  { field: "materials", label: "Material", aliases: ["material", "materials"] },
  { field: "dimensions", label: "Dimensions", aliases: ["dimension", "dimensions"] },
];
const labelKey = (label) => label.toLowerCase().replace(/[^a-z]/g, "");

// Rows shown on the product page: the dedicated Material and Dimensions fields (when filled in),
// followed by the custom specification rows. When a custom row repeats Material/Dimensions and the
// dedicated field is populated, the dedicated field wins and the duplicate custom row is skipped;
// if the dedicated field is empty the custom row is kept as-is. Empty values never render a row.
export function productSpecRows(product) {
  const custom = normalizeSpecifications(product?.specifications);
  const dedicated = [];
  const hidden = new Set();
  for (const { field, label, aliases } of DEDICATED_SPEC_FIELDS) {
    const value = product?.[field];
    if (typeof value === "string" && value.trim()) {
      dedicated.push({ label, value: value.trim() });
      aliases.forEach((a) => hidden.add(a));
    }
  }
  return [...dedicated, ...custom.filter((row) => !hidden.has(labelKey(row.label)))];
}
