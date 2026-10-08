import React, { useId, useState } from "react";
import { FACET_TYPES } from "../../lib/catalogFilterEngine";

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
 * Accordion filter panel shared by the desktop sidebar and the mobile drawer. The groups (which
 * filters exist, their order, labels, open state and selection mode) come from the admin config;
 * the caller supplies the data for each kind of group.
 */
export default function CatalogFilters({
  groups = [], device = "desktop",
  categoryOptions = [], showAllCategories = false, selectedCategory, onSelectCategory,
  collections = [], selectedCollection, onSelectCollection,
  maxPrice, priceMax, onMaxPrice, inStockOnly, onInStockOnly,
  facetOptions = {}, facetSelections = {}, onToggleFacet = () => {},
  onReset,
}) {
  const uid = useId().replace(/:/g, "");
  const [openState, setOpenState] = useState({});
  const isOpen = (g) => (openState[g.id] ?? g.defaultOpen);
  const toggle = (g) => setOpenState((prev) => ({ ...prev, [g.id]: !isOpen(g) }));
  const showPrice = maxPrice < priceMax;

  const visible = groups.filter((g) => (device === "mobile" ? g.showMobile : g.showDesktop)).filter((g) => {
    if (g.type === "COLLECTION") return collections.length > 0;
    if (FACET_TYPES.has(g.type)) return (facetOptions[g.id] || []).length > 0;
    return true;
  });

  const renderBody = (g) => {
    if (g.type === "CATEGORY") {
      return (
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
      );
    }
    if (g.type === "COLLECTION") {
      return (
        <div className="space-y-0.5">
          <button type="button" onClick={() => onSelectCollection("all")} aria-pressed={selectedCollection === "all"} className={optionCls(selectedCollection === "all")}>All Collections</button>
          {collections.map((col) => (
            <button key={col.id} type="button" onClick={() => onSelectCollection(col.slug)} aria-pressed={selectedCollection === col.slug} className={optionCls(selectedCollection === col.slug)}>{col.name}</button>
          ))}
        </div>
      );
    }
    if (g.type === "PRICE") {
      return (
        <>
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
        </>
      );
    }
    if (g.type === "AVAILABILITY") {
      return (
        <label className="flex cursor-pointer items-center gap-3 text-[13px] store-text">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => onInStockOnly(e.target.checked)} className="h-4 w-4 rounded border-[var(--theme-border)] accent-[var(--theme-primary)]" />
          <span>In Stock Only</span>
        </label>
      );
    }
    // Facet groups (attribute / brand / author / language / format / publisher)
    const options = facetOptions[g.id] || [];
    const selected = facetSelections[g.id] || [];
    if (g.selection === "SINGLE") {
      return (
        <div className="space-y-0.5" role="group" aria-label={g.label}>
          {options.map((o) => (
            <button key={o.value} type="button" onClick={() => onToggleFacet(g, o.value)} aria-pressed={selected.includes(o.value)} className={optionCls(selected.includes(o.value))}>
              <span>{o.label}</span><span className="text-xs opacity-75">{o.count}</span>
            </button>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-1" role="group" aria-label={g.label}>
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-1 py-1 text-[13px] store-text hover:bg-[var(--theme-border)]/30">
            <span className="flex items-center gap-2.5">
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => onToggleFacet(g, o.value)} className="h-4 w-4 rounded border-[var(--theme-border)] accent-[var(--theme-primary)]" />
              <span>{o.label}</span>
            </span>
            <span className="text-xs store-muted">{o.count}</span>
          </label>
        ))}
      </div>
    );
  };

  return (
    <div data-testid="catalog-filters" data-device={device}>
      <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-3">
        <h3 className="font-serif-display text-lg font-normal store-text">Filters</h3>
        <button type="button" onClick={onReset} className="text-xs font-semibold store-primary hover:underline">Reset All</button>
      </div>
      {visible.map((g) => (
        <Section
          key={g.id}
          id={`${uid}-${g.id}`}
          title={g.label}
          summary={g.type === "PRICE" && showPrice ? `up to ₹${maxPrice.toLocaleString("en-IN")}` : (FACET_TYPES.has(g.type) && (facetSelections[g.id] || []).length ? `(${facetSelections[g.id].length})` : "")}
          open={isOpen(g)}
          onToggle={() => toggle(g)}
        >
          {renderBody(g)}
        </Section>
      ))}
    </div>
  );
}
