import React from "react";
import { Button } from "../ui";
import StripItemEditor from "./StripItemEditor";
import { flattenCategories } from "./NavItemEditor";

const selectCls = "w-full rounded-xl border border-charcoal/20 p-2.5 text-xs";
const labelCls = "text-xs font-bold text-charcoal";

const TOGGLES = [
  ["showDesktop", "Show on Desktop"],
  ["showMobile", "Show on Mobile"],
  ["showLabels", "Show Category Labels"],
  ["showArrows", "Show Scroll Arrows (desktop)"],
  ["showPartialNextMobile", "Show Partial Next Item on Mobile"],
  ["showDividers", "Bottom Divider Line"],
];

function SelectField({ id, label, value, onChange, options }) {
  return (
    <div className="space-y-1">
      <label className={labelCls} htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>{text}</option>
        ))}
      </select>
    </div>
  );
}

const SIZE_OPTIONS = [["small", "Small"], ["medium", "Medium"], ["large", "Large"]];

/** Admin tab: Category Scroller Strip (stored under header.circularCategories). */
export default function CategoryStripSettings({ strip, setStrip, categories }) {
  const flatCategories = flattenCategories(categories);
  const items = strip.items || [];

  const updateItem = (index, updates) =>
    setStrip({ items: items.map((item, i) => (i === index ? { ...item, ...updates } : item)) });
  const moveItem = (index, direction) => {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setStrip({ items: next });
  };
  const addItem = () =>
    setStrip({ items: [...items, { id: `strip-${Date.now()}`, enabled: true, categoryId: "", slug: "" }] });

  return (
    <div className="space-y-6 rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
        <div>
          <h3 className="text-sm font-bold text-charcoal uppercase tracking-wider">7. Category Scroller Strip</h3>
          <p className="text-xs text-charcoal-soft mt-0.5">
            Optional image strip shown under the Primary Navigation. Off by default; independent of Mega Menus.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-charcoal cursor-pointer">
          <input
            type="checkbox"
            checked={strip.enabled === true}
            onChange={(e) => setStrip({ enabled: e.target.checked })}
            className="h-4 w-4 rounded text-terracotta"
          />
          Enable Category Strip
        </label>
      </div>

      {!strip.enabled && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs font-medium text-charcoal-soft" data-testid="strip-off-notice">
          The strip is OFF: nothing is rendered on the storefront and the hero starts right after the navigation.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <SelectField
          id="strip-shape" label="Item Shape" value={strip.shape} onChange={(shape) => setStrip({ shape })}
          options={[["CIRCLE", "Circle"], ["SQUARE", "Square"], ["ROUNDED_SQUARE", "Rounded Square"], ["RECTANGLE", "Rectangle / Card"]]}
        />
        <SelectField
          id="strip-mode" label="Category Source Mode" value={strip.mode} onChange={(mode) => setStrip({ mode })}
          options={[["AUTO", "AUTO (Active Store Categories)"], ["MANUAL", "MANUAL (Custom Selected Categories)"]]}
        />
        <div className="space-y-1">
          <label className={labelCls} htmlFor="strip-max">Maximum Items (1 to 24)</label>
          <input id="strip-max" type="number" min={1} max={24} value={strip.maxItems} onChange={(e) => setStrip({ maxItems: Number(e.target.value) })} className={selectCls} />
        </div>

        {strip.mode === "AUTO" && (
          <>
            <SelectField
              id="strip-depth" label="Category Depth" value={strip.rootOnly === false ? "ALL" : "ROOT"}
              onChange={(v) => setStrip({ rootOnly: v === "ROOT" })}
              options={[["ROOT", "Root Categories Only"], ["ALL", "Include Subcategories"]]}
            />
            <SelectField
              id="strip-sort" label="Order" value={strip.sortBy} onChange={(sortBy) => setStrip({ sortBy })}
              options={[["CATEGORY_ORDER", "Store category order"], ["NAME", "Alphabetical (A to Z)"]]}
            />
          </>
        )}

        <SelectField id="strip-dsize" label="Desktop Item Size" value={strip.desktopSize} onChange={(desktopSize) => setStrip({ desktopSize })} options={SIZE_OPTIONS} />
        <SelectField id="strip-msize" label="Mobile Item Size" value={strip.mobileSize} onChange={(mobileSize) => setStrip({ mobileSize })} options={SIZE_OPTIONS} />
        <SelectField
          id="strip-fit" label="Image Fit" value={strip.imageFit} onChange={(imageFit) => setStrip({ imageFit })}
          options={[["cover", "Cover (fill and crop)"], ["contain", "Contain (show whole image)"]]}
        />
        <SelectField
          id="strip-density" label="Spacing Density" value={strip.spacingDensity} onChange={(spacingDensity) => setStrip({ spacingDensity })}
          options={[["comfortable", "Comfortable"], ["compact", "Compact"]]}
        />
        <SelectField
          id="strip-bg" label="Background" value={strip.backgroundMode} onChange={(backgroundMode) => setStrip({ backgroundMode })}
          options={[["surface", "Page background"], ["soft", "Soft surface tint"]]}
        />

        <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-3 pt-1">
          {TOGGLES.map(([key, text]) => (
            <label key={key} className="flex items-center gap-2 text-xs font-semibold text-charcoal cursor-pointer">
              <input type="checkbox" checked={strip[key] !== false} onChange={(e) => setStrip({ [key]: e.target.checked })} className="h-4 w-4 rounded text-terracotta" />
              {text}
            </label>
          ))}
        </div>
      </div>

      {strip.mode === "MANUAL" && (
        <div className="space-y-3 pt-4 border-t border-charcoal/10">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal">Strip Items ({items.length})</h4>
            <Button onClick={addItem} className="bg-charcoal text-white text-xs py-1 px-3">+ Add Category</Button>
          </div>
          {items.length === 0 && (
            <p className="text-xs text-charcoal-soft">No items yet. In MANUAL mode only the categories you add here are shown.</p>
          )}
          {items.map((item, idx) => (
            <StripItemEditor
              key={item.id || idx}
              item={item}
              index={idx}
              total={items.length}
              flatCategories={flatCategories}
              onChange={(updates) => updateItem(idx, updates)}
              onMove={(dir) => moveItem(idx, dir)}
              onDelete={() => setStrip({ items: items.filter((_, i) => i !== idx) })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
