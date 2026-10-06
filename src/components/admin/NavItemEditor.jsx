import React from "react";
import ImagePickerInput from "./ImagePickerInput";
import { DESTINATION_TYPES, normalizeDestinationType } from "../../lib/navModel";

const DESTINATION_LABELS = {
  CATEGORY: "Category",
  COLLECTION: "Collection",
  PAGE: "Page",
  BOOKS: "Books page",
  NEW_ARRIVALS: "New Arrivals",
  CUSTOM_URL: "Custom URL",
};

const inputCls = "w-full rounded-lg border border-charcoal/20 p-1.5 text-xs";
const labelCls = "text-[11px] font-semibold text-charcoal block mb-1";

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Categories flattened depth-first so children appear under their parent. */
export function flattenCategories(categories = []) {
  const active = categories.filter((c) => c.isActive !== false);
  const ids = new Set(active.map((c) => c.id));
  const childrenOf = new Map();
  active.forEach((c) => {
    const key = c.parentId && ids.has(c.parentId) ? c.parentId : "__root__";
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key).push(c);
  });
  const out = [];
  const walk = (key, depth) => {
    (childrenOf.get(key) || []).forEach((c) => {
      out.push({ ...c, depth });
      walk(c.id, depth + 1);
    });
  };
  walk("__root__", 0);
  return out;
}

export default function NavItemEditor({ item, index, total, categories, onChange, onMove, onDelete }) {
  const type = normalizeDestinationType(item.destinationType);
  const megaMode = item.megaMenuMode || (item.enableMegaMenu === false ? "DISABLED" : "AUTO_FROM_CATEGORY");
  const flatCategories = flattenCategories(categories);
  const columns = Array.isArray(item.manualColumns) ? item.manualColumns : [];
  const promo = item.promoCard || {};

  const setPromo = (updates) => onChange({ promoCard: { ...promo, ...updates } });

  const setColumns = (next) => onChange({ manualColumns: next });
  const updateColumn = (cIdx, updates) =>
    setColumns(columns.map((col, i) => (i === cIdx ? { ...col, ...updates } : col)));
  const updateLink = (cIdx, lIdx, updates) =>
    updateColumn(cIdx, {
      links: (columns[cIdx].links || []).map((l, i) => (i === lIdx ? { ...l, ...updates } : l)),
    });
  const moveInArray = (arr, from, dir) => {
    const to = from + dir;
    if (to < 0 || to >= arr.length) return arr;
    const next = [...arr];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  };

  const handleCategoryChange = (categoryId) => {
    const cat = flatCategories.find((c) => c.id === categoryId);
    if (!cat) {
      onChange({ categoryId: "", categorySlug: "" });
      return;
    }
    onChange({
      categoryId: cat.id,
      categorySlug: cat.slug,
      destination: `/shop/category/${cat.slug}`,
      ...(!item.label || item.label === "New Collection" ? { label: cat.name } : {}),
    });
  };

  const handleTypeChange = (nextType) => {
    const updates = { destinationType: nextType };
    if (nextType === "BOOKS") updates.destination = "/books";
    if (nextType === "NEW_ARRIVALS") updates.destination = "/new-arrivals";
    if (nextType !== "CATEGORY") {
      updates.categoryId = "";
      updates.categorySlug = "";
      // AUTO needs a category; fall back to a plain link
      if (megaMode === "AUTO_FROM_CATEGORY") updates.megaMenuMode = "DISABLED";
    }
    onChange(updates);
  };

  return (
    <div className="rounded-xl border border-charcoal/15 bg-white p-4 space-y-4" data-testid={`nav-item-editor-${index}`}>
      <div className="flex items-center justify-between gap-2 border-b border-charcoal/10 pb-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            aria-label={`Enable ${item.label || "item"}`}
            checked={item.enabled !== false}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            className="h-4 w-4 rounded text-terracotta"
          />
          <span className="text-xs font-bold text-charcoal">
            Nav Item #{index + 1}: {item.label || "Untitled"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="rounded p-1 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-30" title="Move Up">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="rounded p-1 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-30" title="Move Down">↓</button>
          <button type="button" onClick={onDelete} className="rounded p-1 text-xs text-red-600 hover:bg-red-50 ml-2" title="Delete Item">✕</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelCls} htmlFor={`nav-label-${item.id}`}>Menu Label</label>
          <input id={`nav-label-${item.id}`} type="text" value={item.label || ""} onChange={(e) => onChange({ label: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor={`nav-type-${item.id}`}>Destination Type</label>
          <select id={`nav-type-${item.id}`} value={type} onChange={(e) => handleTypeChange(e.target.value)} className={inputCls}>
            {DESTINATION_TYPES.map((t) => (
              <option key={t} value={t}>{DESTINATION_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor={`nav-badge-${item.id}`}>Optional Badge Text</label>
          <input id={`nav-badge-${item.id}`} type="text" value={item.badge || ""} onChange={(e) => onChange({ badge: e.target.value })} placeholder="NEW or SALE" className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {type === "CATEGORY" && (
          <div>
            <label className={labelCls} htmlFor={`nav-cat-${item.id}`}>Category</label>
            <select id={`nav-cat-${item.id}`} value={item.categoryId || ""} onChange={(e) => handleCategoryChange(e.target.value)} className={inputCls}>
              <option value="">Select a category…</option>
              {flatCategories.map((c) => (
                <option key={c.id} value={c.id}>{`${"— ".repeat(c.depth)}${c.name}`}</option>
              ))}
            </select>
          </div>
        )}
        {(type === "CUSTOM_URL" || type === "COLLECTION" || type === "PAGE" || type === "BOOKS" || (type === "CATEGORY" && !item.categoryId)) && (
          <div>
            <label className={labelCls} htmlFor={`nav-dest-${item.id}`}>
              {type === "COLLECTION" ? "Collection slug or URL" : type === "PAGE" ? "Page slug or URL" : "Destination"}
            </label>
            <input id={`nav-dest-${item.id}`} type="text" value={item.destination || ""} onChange={(e) => onChange({ destination: e.target.value })} placeholder={type === "BOOKS" ? "/books" : "/shop/category/ceramics"} className={inputCls} />
          </div>
        )}
        <div className="flex items-end gap-4 pb-1">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-charcoal cursor-pointer">
            <input type="checkbox" checked={item.showDesktop !== false} onChange={(e) => onChange({ showDesktop: e.target.checked })} className="h-4 w-4 rounded text-terracotta" />
            Desktop
          </label>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-charcoal cursor-pointer">
            <input type="checkbox" checked={item.showMobile !== false} onChange={(e) => onChange({ showMobile: e.target.checked })} className="h-4 w-4 rounded text-terracotta" />
            Mobile
          </label>
        </div>
      </div>

      {/* Mega menu */}
      <div className="space-y-3 rounded-lg border border-charcoal/10 bg-ivory-dark/20 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor={`nav-mega-${item.id}`}>Mega Menu</label>
            <select
              id={`nav-mega-${item.id}`}
              value={megaMode}
              onChange={(e) => onChange({ megaMenuMode: e.target.value, enableMegaMenu: e.target.value !== "DISABLED" })}
              className={inputCls}
            >
              <option value="DISABLED">Disabled (click navigation only)</option>
              <option value="AUTO_FROM_CATEGORY">Auto from Category</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>
          {megaMode === "AUTO_FROM_CATEGORY" && (
            <div>
              <label className={labelCls} htmlFor={`nav-mega-cat-${item.id}`}>Category for menu</label>
              <select id={`nav-mega-cat-${item.id}`} value={item.categoryId || ""} onChange={(e) => {
                const cat = flatCategories.find((c) => c.id === e.target.value);
                onChange(cat ? { categoryId: cat.id, categorySlug: cat.slug } : { categoryId: "", categorySlug: "" });
              }} className={inputCls}>
                <option value="">Select a category…</option>
                {flatCategories.map((c) => (
                  <option key={c.id} value={c.id}>{`${"— ".repeat(c.depth)}${c.name}`}</option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-charcoal-soft">Shows this category&apos;s active subcategories, in category order.</p>
            </div>
          )}
        </div>

        {megaMode === "MANUAL" && (
          <div className="space-y-3">
            {columns.map((col, cIdx) => (
              <div key={col.id || cIdx} className="rounded-lg border border-charcoal/15 bg-white p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input type="checkbox" aria-label="Enable column" checked={col.enabled !== false} onChange={(e) => updateColumn(cIdx, { enabled: e.target.checked })} className="h-4 w-4 rounded text-terracotta" />
                  <input type="text" aria-label="Column Heading" placeholder="Column Heading" value={col.heading || ""} onChange={(e) => updateColumn(cIdx, { heading: e.target.value })} className={inputCls} />
                  <button type="button" onClick={() => setColumns(moveInArray(columns, cIdx, -1))} disabled={cIdx === 0} className="rounded p-1 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-30" title="Move column up">↑</button>
                  <button type="button" onClick={() => setColumns(moveInArray(columns, cIdx, 1))} disabled={cIdx === columns.length - 1} className="rounded p-1 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-30" title="Move column down">↓</button>
                  <button type="button" onClick={() => setColumns(columns.filter((_, i) => i !== cIdx))} className="rounded p-1 text-xs text-red-600 hover:bg-red-50" title="Remove column">✕</button>
                </div>

                {(col.links || []).map((link, lIdx) => (
                  <div key={link.id || lIdx} className="flex items-center gap-2 pl-6">
                    <input type="checkbox" aria-label="Enable link" checked={link.enabled !== false} onChange={(e) => updateLink(cIdx, lIdx, { enabled: e.target.checked })} className="h-4 w-4 rounded text-terracotta" />
                    <input type="text" aria-label="Link Label" placeholder="Link Label" value={link.label || ""} onChange={(e) => updateLink(cIdx, lIdx, { label: e.target.value })} className={inputCls} />
                    <input type="text" aria-label="Link Destination" placeholder="/shop/category/fiction" value={link.destination || ""} onChange={(e) => updateLink(cIdx, lIdx, { destination: e.target.value })} className={inputCls} />
                    <button type="button" onClick={() => updateColumn(cIdx, { links: moveInArray(col.links, lIdx, -1) })} disabled={lIdx === 0} className="rounded p-1 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-30" title="Move link up">↑</button>
                    <button type="button" onClick={() => updateColumn(cIdx, { links: moveInArray(col.links, lIdx, 1) })} disabled={lIdx === (col.links || []).length - 1} className="rounded p-1 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-30" title="Move link down">↓</button>
                    <button type="button" onClick={() => updateColumn(cIdx, { links: col.links.filter((_, i) => i !== lIdx) })} className="rounded p-1 text-xs text-red-600 hover:bg-red-50" title="Remove link">✕</button>
                  </div>
                ))}

                <div className="pl-6">
                  <button
                    type="button"
                    disabled={(col.links || []).length >= 12}
                    onClick={() => updateColumn(cIdx, { links: [...(col.links || []), { id: uid("link"), label: "", destination: "", enabled: true }] })}
                    className="text-[11px] font-bold text-terracotta hover:underline disabled:opacity-40"
                  >
                    + Add Link
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              disabled={columns.length >= 6}
              onClick={() => setColumns([...columns, { id: uid("col"), heading: "", enabled: true, links: [] }])}
              className="text-xs font-bold text-terracotta hover:underline disabled:opacity-40"
            >
              + Add Column
            </button>
          </div>
        )}

        {megaMode !== "DISABLED" && (
          <div className="space-y-3 border-t border-charcoal/10 pt-3">
            <label className="flex items-center gap-2 text-xs font-bold text-charcoal cursor-pointer">
              <input type="checkbox" checked={promo.enabled === true} onChange={(e) => setPromo({ enabled: e.target.checked })} className="h-4 w-4 rounded text-terracotta" />
              Show promo card for this menu
            </label>
            {promo.enabled === true && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ImagePickerInput label="Promo Image" value={promo.image || ""} onChange={(url) => setPromo({ image: url })} placeholder="Upload or choose promo image" />
                <div className="space-y-2">
                  <input type="text" aria-label="Promo Eyebrow" placeholder="Eyebrow" value={promo.eyebrow || ""} onChange={(e) => setPromo({ eyebrow: e.target.value })} className={inputCls} />
                  <input type="text" aria-label="Promo Title" placeholder="Title" value={promo.title || ""} onChange={(e) => setPromo({ title: e.target.value })} className={inputCls} />
                  <textarea aria-label="Promo Description" placeholder="Description" rows={2} value={promo.description || ""} onChange={(e) => setPromo({ description: e.target.value })} className={inputCls} />
                  <div className="flex gap-2">
                    <input type="text" aria-label="Promo CTA Label" placeholder="CTA label" value={promo.ctaLabel || ""} onChange={(e) => setPromo({ ctaLabel: e.target.value })} className={inputCls} />
                    <input type="text" aria-label="Promo CTA Destination" placeholder="/shop" value={promo.ctaUrl || ""} onChange={(e) => setPromo({ ctaUrl: e.target.value })} className={inputCls} />
                  </div>
                  <input type="text" aria-label="Promo Alt Text" placeholder="Image alt text" value={promo.altText || ""} onChange={(e) => setPromo({ altText: e.target.value })} className={inputCls} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
