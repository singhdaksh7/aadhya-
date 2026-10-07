import React from "react";
import ImagePickerInput from "./ImagePickerInput";

const inputCls = "w-full rounded-lg border border-charcoal/20 p-1.5 text-xs";
const labelCls = "text-[11px] font-semibold text-charcoal block mb-1";

/** One MANUAL category-strip item: category, label, thumbnails, badge, destination, order, remove. */
export default function StripItemEditor({ item, index, total, flatCategories, onChange, onMove, onDelete }) {
  const selected = flatCategories.find((c) => c.id === item.categoryId || (item.slug && c.slug === item.slug));
  const title = item.displayLabelOverride || selected?.name || "Select a category";

  const handleCategory = (categoryId) => {
    const cat = flatCategories.find((c) => c.id === categoryId);
    onChange(cat ? { categoryId: cat.id, slug: cat.slug } : { categoryId: "", slug: "" });
  };

  return (
    <div className="rounded-xl border border-charcoal/15 bg-white p-4 space-y-3" data-testid={`strip-item-editor-${index}`}>
      <div className="flex items-center justify-between gap-2 border-b border-charcoal/10 pb-2">
        <label className="flex items-center gap-2 text-xs font-bold text-charcoal cursor-pointer">
          <input
            type="checkbox"
            aria-label={`Enable strip item ${index + 1}`}
            checked={item.enabled !== false}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            className="h-4 w-4 rounded text-terracotta"
          />
          Item #{index + 1}: {title}
        </label>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="rounded p-1 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-30" title="Move Up" aria-label="Move strip item up">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="rounded p-1 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-30" title="Move Down" aria-label="Move strip item down">↓</button>
          <button type="button" onClick={onDelete} className="rounded p-1 text-xs text-red-600 hover:bg-red-50 ml-2" title="Remove Item" aria-label="Remove strip item">✕</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor={`strip-cat-${item.id}`}>Category</label>
          <select id={`strip-cat-${item.id}`} value={item.categoryId || ""} onChange={(e) => handleCategory(e.target.value)} className={inputCls}>
            <option value="">Select a category…</option>
            {flatCategories.map((c) => (
              <option key={c.id} value={c.id}>{`${"— ".repeat(c.depth)}${c.name}`}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor={`strip-label-${item.id}`}>Display Label Override</label>
          <input id={`strip-label-${item.id}`} type="text" value={item.displayLabelOverride || ""} onChange={(e) => onChange({ displayLabelOverride: e.target.value })} placeholder={selected?.name || "Category name"} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor={`strip-badge-${item.id}`}>Badge Text</label>
          <input id={`strip-badge-${item.id}`} type="text" value={item.badgeText || ""} onChange={(e) => onChange({ badgeText: e.target.value })} placeholder="NEW" className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor={`strip-dest-${item.id}`}>Destination Override</label>
          <input id={`strip-dest-${item.id}`} type="text" value={item.destinationOverride || ""} onChange={(e) => onChange({ destinationOverride: e.target.value })} placeholder={selected ? `/shop/category/${selected.slug}` : "/shop"} className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ImagePickerInput
          label="Thumbnail Image Override"
          value={item.imageOverride || ""}
          onChange={(url) => onChange({ imageOverride: url })}
          placeholder="Defaults to the category image"
        />
        <ImagePickerInput
          label="Mobile Thumbnail Override (optional)"
          value={item.mobileImageOverride || ""}
          onChange={(url) => onChange({ mobileImageOverride: url })}
          placeholder="Defaults to the thumbnail above"
        />
      </div>
    </div>
  );
}
