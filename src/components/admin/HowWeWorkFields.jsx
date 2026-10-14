import React from "react";
import ImagePickerInput from "./ImagePickerInput";

export const HOW_WE_WORK_MAX_ITEMS = 8;
export const HOW_WE_WORK_ICON_OPTIONS = [["sparkles", "Sparkles"], ["badge", "Badge"], ["home", "Home"], ["shield", "Shield"], ["leaf", "Leaf"], ["heart", "Heart"]];
export const howWeWorkEmptyItem = (count = 0) => ({ id: crypto.randomUUID(), title: "", description: "", icon: "sparkles", iconImage: "", enabled: true, sortOrder: count + 1 });

const INPUT = "mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2 text-sm";
const SMALL = "rounded border p-2 text-xs";
const HEX = /^#[0-9a-fA-F]{6}$/;
const LABEL = "block text-xs font-semibold text-charcoal-soft";

const ColorField = ({ label, value, fallback, onChange }) => (
  <label className={LABEL}>{label}
    <span className="mt-1 flex items-center gap-2">
      <input type="color" aria-label={`${label} picker`} value={HEX.test(value || "") ? value : fallback} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-9 w-12 cursor-pointer rounded border border-charcoal/20" />
      <input aria-label={label} value={value ?? ""} placeholder={fallback} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-charcoal/20 px-3 py-2 text-sm" />
    </span>
  </label>
);

// Section-level appearance + image controls (text fields come from the shared list).
export function HowWeWorkSettings({ value, set }) {
  return <div className="space-y-4">
    <div className="grid gap-3 rounded-xl border border-charcoal/10 p-3 sm:grid-cols-2">
      <p className="text-xs font-bold uppercase tracking-wider text-charcoal sm:col-span-2">Appearance</p>
      <label className={LABEL}>Background
        <select value={value.background || "SURFACE"} onChange={(e) => set("background", e.target.value)} className={INPUT}>
          <option value="SURFACE">Soft surface</option><option value="PLAIN">Plain page background</option><option value="CUSTOM">Custom colour</option>
        </select>
      </label>
      {value.background === "CUSTOM" && <ColorField label="Background colour" value={value.backgroundColor} fallback="#F6EFE3" onChange={(v) => set("backgroundColor", v)} />}
      <label className="flex items-center gap-2 text-xs font-semibold text-charcoal"><input type="checkbox" checked={value.showBorder !== false} onChange={(e) => set("showBorder", e.target.checked)} /> Show border</label>
      {value.showBorder !== false && <ColorField label="Border colour (blank = theme)" value={value.borderColor} fallback="#D9D2C5" onChange={(v) => set("borderColor", v)} />}
      <label className={LABEL}>Corner radius (px, 0-48)
        <input type="number" min={0} max={48} value={value.borderRadius ?? 24} onChange={(e) => set("borderRadius", e.target.value === "" ? undefined : Number(e.target.value))} className={INPUT} />
      </label>
    </div>
    <div className="grid gap-3 rounded-xl border border-charcoal/10 p-3 sm:grid-cols-2">
      <p className="text-xs font-bold uppercase tracking-wider text-charcoal sm:col-span-2">Supporting image</p>
      <div className="sm:col-span-2"><ImagePickerInput label="Supporting image" value={value.image} onChange={(url) => set("image", url)} pickerTitle="Select supporting image" inputClassName="mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2 text-xs" enableCrop aspectOptions={["square", "wide", "free"]} /></div>
      <label className={LABEL}>Image alt text<input aria-label="Image alt text" value={value.imageAlt ?? ""} onChange={(e) => set("imageAlt", e.target.value)} className={INPUT} /></label>
      <label className={LABEL}>Image position
        <select value={value.imagePosition || "RIGHT"} onChange={(e) => set("imagePosition", e.target.value)} className={INPUT}><option value="RIGHT">Right of the points</option><option value="LEFT">Left of the points</option></select>
      </label>
      <p className="text-[11px] text-charcoal-soft sm:col-span-2">On phones the heading and points come first and the image follows. Without an image the points use the full width.</p>
    </div>
    <p className="text-[11px] text-charcoal-soft">Up to {HOW_WE_WORK_MAX_ITEMS} points. Use Sort order to reorder them.</p>
  </div>;
}

// Per-point controls (rendered inside the shared repeatable-item card).
export function HowWeWorkItemFields({ item, update }) {
  return <div className="grid gap-2">
    <div className="grid gap-2 sm:grid-cols-2">
      <input aria-label="Point title" value={item.title || ""} placeholder="Title" onChange={(e) => update("title", e.target.value)} className={SMALL} />
      <select aria-label="Point icon" value={item.icon || "sparkles"} onChange={(e) => update("icon", e.target.value)} className={SMALL}>{HOW_WE_WORK_ICON_OPTIONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
    </div>
    <textarea aria-label="Point description" rows="2" value={item.description || ""} placeholder="Description" onChange={(e) => update("description", e.target.value)} className={SMALL} />
    <ImagePickerInput label="Uploaded icon (optional, replaces the glyph)" value={item.iconImage} onChange={(url) => update("iconImage", url)} pickerTitle="Select point icon" inputClassName="rounded border p-2 text-xs w-full" enableCrop aspectOptions={["square", "free"]} />
  </div>;
}
