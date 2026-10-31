import { useEffect, useState } from "react";
import { adminListVariants, adminCreateVariant, adminUpdateVariant, adminDeleteVariant } from "../../lib/api";
import { Button } from "../../components/ui";

const inputCls = "w-full rounded-xl border border-charcoal/15 px-3 py-2 text-sm focus:border-charcoal/40 focus:outline-none";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">{label}</span>
      {children}
    </label>
  );
}

const emptyDraft = { id: null, name: "", sku: "", stockQuantity: "0", priceOverride: "", isActive: true, weightKg: "", lengthCm: "", widthCm: "", heightCm: "" };
const str = (v) => (v == null ? "" : String(v));
const num = (v) => (v === "" ? null : Number(v));

const toDraft = (v) => ({
  id: v.id, name: v.name || "", sku: v.sku || "", stockQuantity: str(v.stockQuantity ?? 0), priceOverride: str(v.priceOverride),
  isActive: v.isActive !== false,
  weightKg: str(v.shipping?.weightKg), lengthCm: str(v.shipping?.lengthCm), widthCm: str(v.shipping?.widthCm), heightCm: str(v.shipping?.heightCm),
});

export const toVariantPayload = (d) => ({
  name: d.name.trim(),
  sku: d.sku.trim(),
  stockQuantity: Number(d.stockQuantity || 0),
  priceOverride: num(d.priceOverride),
  isActive: d.isActive,
  // Blank means "inherit from the product", which the API stores as null.
  shipping: { weightKg: num(d.weightKg), lengthCm: num(d.lengthCm), widthCm: num(d.widthCm), heightCm: num(d.heightCm) },
});

// Compact variants manager for an existing product. productShipping holds the product's own values
// (strings) and is shown as the placeholder because variants inherit it (variant, then product, then missing).
export default function ProductVariantsSection({ productId, productShipping = {} }) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = () => adminListVariants(productId)
    .then((res) => setVariants(res.data || []))
    .catch((e) => setError(e.message || "Failed to load variants"))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, [productId]);

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    if (!draft.name.trim() || !draft.sku.trim()) { setError("Variant name and SKU are required."); return; }
    setSaving(true); setError(null);
    try {
      const payload = toVariantPayload(draft);
      if (draft.id) await adminUpdateVariant(productId, draft.id, payload);
      else await adminCreateVariant(productId, payload);
      setDraft(null);
      await load();
    } catch (e) {
      setError(e.message || "Failed to save variant");
    } finally { setSaving(false); }
  };

  const remove = async (variant) => {
    if (!window.confirm(`Delete variant "${variant.name}"?`)) return;
    setError(null);
    try { await adminDeleteVariant(productId, variant.id); await load(); }
    catch (e) { setError(e.message || "Failed to delete variant"); }
  };

  const ship = (key) => ({ placeholder: productShipping[key] ? `Product: ${productShipping[key]}` : "Not set on product" });
  // Enter inside this block must not submit the surrounding product form.
  const blockEnter = (e) => { if (e.key === "Enter" && e.target.tagName === "INPUT") e.preventDefault(); };

  return (
    <section id="sec-variants" data-testid="variants-section" className="admin-card space-y-4 p-5" onKeyDown={blockEnter}>
      <div className="flex items-center justify-between border-b border-charcoal/10 pb-2">
        <h2 className="admin-card__title">Variants</h2>
        {!draft && <Button type="button" variant="secondary" onClick={() => { setError(null); setDraft(emptyDraft); }}>Add variant</Button>}
      </div>
      {loading ? <p className="text-sm text-charcoal-soft">Loading variants…</p> : variants.length === 0 && !draft ? (
        <p className="text-sm text-charcoal-soft">No variants. The product is sold as a single item.</p>
      ) : (
        <ul className="divide-y divide-charcoal/10">
          {variants.map((v) => (
            <li key={v.id} data-testid="variant-row" className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 break-words"><strong>{v.name}</strong> <span className="text-charcoal-soft">{v.sku} · stock {v.stockQuantity}{v.priceOverride != null ? ` · ₹${v.priceOverride}` : ""}{v.isActive === false ? " · inactive" : ""}</span></span>
              <span className="flex gap-3 text-xs">
                <button type="button" className="underline" onClick={() => { setError(null); setDraft(toDraft(v)); }}>Edit</button>
                <button type="button" className="text-terracotta underline" onClick={() => remove(v)}>Delete</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {draft && (
        <div data-testid="variant-editor" className="space-y-4 rounded-2xl border border-charcoal/10 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Variant name"><input aria-label="Variant name" value={draft.name} onChange={(e) => set("name", e.target.value)} className={inputCls} /></Field>
            <Field label="Variant SKU"><input aria-label="Variant SKU" value={draft.sku} onChange={(e) => set("sku", e.target.value)} className={inputCls} /></Field>
            <Field label="Stock quantity"><input aria-label="Variant stock" type="number" min="0" value={draft.stockQuantity} onChange={(e) => set("stockQuantity", e.target.value)} className={inputCls} /></Field>
            <Field label="Price override (optional)"><input aria-label="Variant price override" inputMode="decimal" value={draft.priceOverride} onChange={(e) => set("priceOverride", e.target.value)} placeholder="Blank = product price" className={inputCls} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => set("isActive", e.target.checked)} /> Active</label>
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-charcoal-soft">Shipping &amp; Package Details</h3>
            <p className="text-xs text-charcoal-soft">Leave blank to inherit the product&apos;s values</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Weight (kg)"><input aria-label="Variant weight kg" inputMode="decimal" value={draft.weightKg} onChange={(e) => set("weightKg", e.target.value)} {...ship("weightKg")} className={inputCls} /></Field>
              <Field label="Length (cm)"><input aria-label="Variant length cm" inputMode="decimal" value={draft.lengthCm} onChange={(e) => set("lengthCm", e.target.value)} {...ship("lengthCm")} className={inputCls} /></Field>
              <Field label="Width (cm)"><input aria-label="Variant width cm" inputMode="decimal" value={draft.widthCm} onChange={(e) => set("widthCm", e.target.value)} {...ship("widthCm")} className={inputCls} /></Field>
              <Field label="Height (cm)"><input aria-label="Variant height cm" inputMode="decimal" value={draft.heightCm} onChange={(e) => set("heightCm", e.target.value)} {...ship("heightCm")} className={inputCls} /></Field>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : draft.id ? "Save variant" : "Add variant"}</Button>
            <Button type="button" variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-terracotta">{error}</p>}
    </section>
  );
}
