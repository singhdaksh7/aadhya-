// Free-form customer-facing specification rows (label + value). Order is the display order.
// Rows are edited as-is (blank rows allowed while typing); blank rows are dropped on save.
export const emptySpecRow = () => ({ label: "", value: "" });

export function moveRow(rows, from, to) {
  if (to < 0 || to >= rows.length) return rows;
  const next = rows.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function SpecificationsEditor({ rows, onChange }) {
  const update = (i, patch) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const inputCls = "w-full rounded-xl border border-charcoal/15 bg-white px-3 py-2 text-sm";
  const btnCls = "rounded-lg border border-charcoal/15 px-2 py-1 text-xs text-charcoal-soft disabled:opacity-40";

  return (
    <fieldset className="rounded-2xl border border-charcoal/10 p-4" data-testid="spec-editor">
      <legend className="px-2 text-xs font-medium uppercase tracking-wide text-charcoal-soft">Product Specifications</legend>
      <p className="mb-3 text-xs text-charcoal-soft">
        Shown to customers as a table on the product page, in this order. Use any label, e.g. Materials, Dimensions, Handle, Care Instructions.
      </p>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_2fr_auto]" data-testid="spec-row">
            <input aria-label={`Specification label ${i + 1}`} value={row.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Label (e.g. Materials)" maxLength={120} className={inputCls} />
            <div className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
              <textarea aria-label={`Specification value ${i + 1}`} rows={1} value={row.value} onChange={(e) => update(i, { value: e.target.value })} placeholder="Value" maxLength={1000} className={inputCls} />
            </div>
            <div className="flex items-start gap-1">
              <button type="button" aria-label={`Move specification ${i + 1} up`} disabled={i === 0} onClick={() => onChange(moveRow(rows, i, i - 1))} className={btnCls}>↑</button>
              <button type="button" aria-label={`Move specification ${i + 1} down`} disabled={i === rows.length - 1} onClick={() => onChange(moveRow(rows, i, i + 1))} className={btnCls}>↓</button>
              <button type="button" aria-label={`Delete specification ${i + 1}`} onClick={() => onChange(rows.filter((_, idx) => idx !== i))} className={`${btnCls} text-red-700`}>✕</button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...rows, emptySpecRow()])} disabled={rows.length >= 50} className="mt-3 rounded-full border border-charcoal/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-charcoal hover:bg-charcoal/5 disabled:opacity-40">
        + Add specification
      </button>
    </fieldset>
  );
}
