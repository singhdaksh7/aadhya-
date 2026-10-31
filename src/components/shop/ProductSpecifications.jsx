import { productSpecRows } from "../../lib/specifications";

// Customer-facing specification table. Hidden when the product has nothing to show.
// Two columns (label / value) from sm up; stacked label-over-value on phones. Long labels and
// values wrap (break-words) so nothing can overflow the page.
export default function ProductSpecifications({ product }) {
  const rows = productSpecRows(product);
  if (!rows.length) return null;
  return (
    <section data-testid="product-specifications" aria-labelledby="pdp-specs-heading" className="border-t border-[var(--theme-border)] pt-10">
      <h2 id="pdp-specs-heading" className="font-serif-display text-xl sm:text-2xl store-text font-bold">Product Details</h2>
      <dl className="mt-5 divide-y divide-[var(--theme-border)] border-y border-[var(--theme-border)]">
        {rows.map((row, i) => (
          <div key={`${row.label}-${i}`} data-testid="spec-item" className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,5fr)] sm:gap-6">
            <dt className="break-words text-[11px] font-semibold uppercase tracking-wider store-muted sm:pt-0.5">{row.label}</dt>
            <dd className="min-w-0 whitespace-pre-line break-words text-sm leading-relaxed store-text">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
