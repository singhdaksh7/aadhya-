import React, { useId, useState } from "react";

function Section({ id, title, summary, open, onToggle, children }) {
  return (
    <div className="border-b border-[var(--theme-border)]">
      <h4>
        <button
          type="button"
          id={`${id}-trigger`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-3 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.18em] store-text transition hover:text-[var(--theme-primary)] focus-visible:outline-none focus-visible:text-[var(--theme-primary)]"
        >
          <span>{title}{summary && <span className="ml-2 font-normal normal-case tracking-normal store-primary">{summary}</span>}</span>
          <span aria-hidden="true" className="text-base leading-none store-muted">{open ? "−" : "+"}</span>
        </button>
      </h4>
      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-trigger`} hidden={!open} className="pb-4">
        {open && children}
      </div>
    </div>
  );
}

const optionCls = (active) =>
  `flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition ${
    active ? "store-bg-primary font-semibold text-white" : "store-muted hover:bg-[var(--theme-border)]/40 hover:text-[var(--theme-text)]"
  }`;

/**
 * Accordion filter panel shared by the desktop sidebar and the mobile drawer.
 * Category options are already scoped to the current category tree by the caller.
 */
export default function CatalogFilters({
  categoryOptions = [], showAllCategories = false, selectedCategory, onSelectCategory,
  collections = [], selectedCollection, onSelectCollection,
  maxPrice, priceMax, onMaxPrice, inStockOnly, onInStockOnly, onReset,
}) {
  const uid = useId().replace(/:/g, "");
  const [open, setOpen] = useState({ category: true, collection: false, price: false, availability: false });
  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  const showPrice = maxPrice < priceMax;

  return (
    <div data-testid="catalog-filters">
      <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-3">
        <h3 className="font-serif-display text-lg font-normal store-text">Filters</h3>
        <button type="button" onClick={onReset} className="text-xs font-semibold store-primary hover:underline">Reset All</button>
      </div>

      <Section id={`${uid}-category`} title="Category" open={open.category} onToggle={() => toggle("category")}>
        <div className="space-y-0.5">
          {showAllCategories && (
            <button type="button" onClick={() => onSelectCategory("all")} aria-pressed={selectedCategory === "all"} className={optionCls(selectedCategory === "all")}>All Categories</button>
          )}
          {categoryOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelectCategory(opt.slug)}
              aria-pressed={selectedCategory === opt.slug}
              style={{ paddingLeft: `${0.625 + opt.depth * 0.9}rem` }}
              className={optionCls(selectedCategory === opt.slug)}
            >
              <span>{opt.name}</span>
              <span className="text-xs opacity-75">{opt.count}</span>
            </button>
          ))}
        </div>
      </Section>

      {collections.length > 0 && (
        <Section id={`${uid}-collection`} title="Collection" open={open.collection} onToggle={() => toggle("collection")}>
          <div className="space-y-0.5">
            <button type="button" onClick={() => onSelectCollection("all")} aria-pressed={selectedCollection === "all"} className={optionCls(selectedCollection === "all")}>All Collections</button>
            {collections.map((col) => (
              <button key={col.id} type="button" onClick={() => onSelectCollection(col.slug)} aria-pressed={selectedCollection === col.slug} className={optionCls(selectedCollection === col.slug)}>{col.name}</button>
            ))}
          </div>
        </Section>
      )}

      <Section id={`${uid}-price`} title="Price" summary={showPrice ? `up to ₹${maxPrice.toLocaleString("en-IN")}` : ""} open={open.price} onToggle={() => toggle("price")}>
        <div className="flex items-center justify-between text-xs store-muted">
          <span>₹1,000</span>
          <span className="font-semibold store-primary">₹{maxPrice.toLocaleString("en-IN")}</span>
        </div>
        <input
          type="range"
          aria-label="Maximum price"
          min="1000"
          max={priceMax}
          step="250"
          value={maxPrice}
          onChange={(e) => onMaxPrice(Number(e.target.value))}
          className="mt-2 w-full cursor-pointer accent-[var(--theme-primary)]"
        />
      </Section>

      <Section id={`${uid}-availability`} title="Availability" open={open.availability} onToggle={() => toggle("availability")}>
        <label className="flex cursor-pointer items-center gap-3 text-[13px] store-text">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => onInStockOnly(e.target.checked)} className="h-4 w-4 rounded border-[var(--theme-border)] accent-[var(--theme-primary)]" />
          <span>In Stock Only</span>
        </label>
      </Section>
    </div>
  );
}
