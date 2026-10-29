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

// Rows shown on the product page. Products without specification rows fall back to their legacy
// materials/dimensions fields (only when filled in), so nothing is lost and nothing is invented.
export function productSpecRows(product) {
  const rows = normalizeSpecifications(product?.specifications);
  if (rows.length) return rows;
  return [
    ["Materials", product?.materials],
    ["Dimensions", product?.dimensions],
  ]
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([label, value]) => ({ label, value: value.trim() }));
}
