import React from "react";
import ImagePickerInput from "./ImagePickerInput";

const TRUST_BANNER_ICON_OPTIONS = [["truck", "Truck (shipping)"], ["return", "Return arrow"], ["lock", "Lock (secure)"], ["badge", "Badge"], ["shield", "Shield"], ["sparkles", "Sparkles"], ["home", "Home"], ["leaf", "Leaf"], ["heart", "Heart"], ["gift", "Gift"], ["star", "Star"]];

const INPUT = "mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2 text-sm";
const SMALL = "rounded border p-2 text-xs";
const HEX = /^#[0-9a-fA-F]{6}$/;

const NumberField = ({ label, value, onChange, min, max, step, nullable = false }) => (
  <label className="block text-xs font-semibold text-charcoal-soft">{label}
    <input type="number" min={min} max={max} step={step} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? (nullable ? null : undefined) : Number(e.target.value))} className={INPUT} />
  </label>
);

// Section-level controls for the compact trust banner (appearance + review summary).
export function TrustBannerSettings({ value, set }) {
  const bg = HEX.test(value.backgroundColor || "") ? value.backgroundColor : "#F6EFE3";
  return <div className="space-y-4">
    <div className="grid gap-3 rounded-xl border border-charcoal/10 p-3 sm:grid-cols-2">
      <p className="text-xs font-bold uppercase tracking-wider text-charcoal sm:col-span-2">Appearance</p>
      <label className="block text-xs font-semibold text-charcoal-soft">Background colour
        <span className="mt-1 flex items-center gap-2">
          <input type="color" aria-label="Background colour picker" value={bg} onChange={(e) => set("backgroundColor", e.target.value.toUpperCase())} className="h-9 w-12 cursor-pointer rounded border border-charcoal/20" />
          <input aria-label="Background colour" value={value.backgroundColor ?? ""} placeholder="#F6EFE3" onChange={(e) => set("backgroundColor", e.target.value)} className="w-full rounded-xl border border-charcoal/20 px-3 py-2 text-sm" />
        </span>
      </label>
      <NumberField label="Corner radius (px, 0–48)" value={value.borderRadius} onChange={(v) => set("borderRadius", v)} min={0} max={48} />
      <NumberField label="Desktop padding (px, top & bottom)" value={value.paddingDesktop} onChange={(v) => set("paddingDesktop", v)} min={8} max={96} />
      <NumberField label="Mobile padding (px, top & bottom)" value={value.paddingMobile} onChange={(v) => set("paddingMobile", v)} min={8} max={64} />
      <label className="block text-xs font-semibold text-charcoal-soft">Mobile layout
        <select value={value.mobileLayout || "SCROLL"} onChange={(e) => set("mobileLayout", e.target.value)} className={INPUT}><option value="SCROLL">Horizontal swipe row</option><option value="STACKED">Stacked list</option></select>
      </label>
      <NumberField label="Background image strength (0–100)" value={value.backgroundImageOpacity} onChange={(v) => set("backgroundImageOpacity", v)} min={0} max={100} />
      <div className="sm:col-span-2"><ImagePickerInput label="Background texture image (optional)" value={value.backgroundImage} onChange={(url) => set("backgroundImage", url)} pickerTitle="Select banner background" inputClassName="mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2 text-xs" enableCrop aspectOptions={["wide", "banner", "free"]} /></div>
    </div>
    <div className="grid gap-3 rounded-xl border border-charcoal/10 p-3 sm:grid-cols-2">
      <label className="flex items-center gap-2 text-xs font-semibold text-charcoal sm:col-span-2"><input type="checkbox" checked={value.showSummary !== false} onChange={(e) => set("showSummary", e.target.checked)} /> Show review / trust summary</label>
      {value.showSummary !== false && <>
        <label className="block text-xs font-semibold text-charcoal-soft sm:col-span-2">Summary heading<input value={value.summaryTitle ?? ""} onChange={(e) => set("summaryTitle", e.target.value)} className={INPUT} /></label>
        <NumberField label="Review score (0–5, blank hides)" value={value.reviewScore} onChange={(v) => set("reviewScore", v)} min={0} max={5} step={0.1} nullable />
        <NumberField label="Review count (blank hides)" value={value.reviewCount} onChange={(v) => set("reviewCount", v)} min={0} nullable />
        <label className="block text-xs font-semibold text-charcoal-soft sm:col-span-2">Review source label<input value={value.reviewSource ?? ""} placeholder="e.g. Based on verified reviews" onChange={(e) => set("reviewSource", e.target.value)} className={INPUT} /></label>
        <div className="sm:col-span-2"><ImagePickerInput label="Trust icon / logo (optional)" value={value.summaryIcon} onChange={(url) => set("summaryIcon", url)} pickerTitle="Select trust icon" inputClassName="mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2 text-xs" enableCrop aspectOptions={["square", "free"]} /></div>
      </>}
    </div>
    <p className="rounded-lg bg-charcoal/5 p-3 text-[11px] text-charcoal-soft">Item text can use <code>{"{freeShippingThreshold}"}</code>, <code>{"{returnWindowDays}"}</code> and <code>{"{dispatchEstimate}"}</code>. They are filled from Store Settings; an item whose setting is blank is hidden instead of showing half a sentence.</p>
  </div>;
}

// Per-item controls (rendered inside the shared repeatable-item card).
export function TrustBannerItemFields({ item, update }) {
  return <div className="grid gap-2">
    <div className="grid gap-2 sm:grid-cols-2">
      <input aria-label="Trust item title" value={item.title || ""} placeholder="Title (optional if you upload an image)" onChange={(e) => update("title", e.target.value)} className={SMALL} />
      <select aria-label="Trust item icon" value={item.icon || "sparkles"} onChange={(e) => update("icon", e.target.value)} className={SMALL}>{TRUST_BANNER_ICON_OPTIONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
    </div>
    <input aria-label="Trust item description" value={item.description || ""} placeholder="Description (supports {freeShippingThreshold}, {returnWindowDays}, {dispatchEstimate})" onChange={(e) => update("description", e.target.value)} className={SMALL} />
    <ImagePickerInput label="Uploaded image (optional). With no title or description it shows as an image-only badge" value={item.iconImage} onChange={(url) => update("iconImage", url)} pickerTitle="Select item icon" inputClassName="rounded border p-2 text-xs w-full" enableCrop aspectOptions={["square", "free"]} />
    <div className="flex flex-wrap gap-4">
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={item.showOnDesktop !== false} onChange={(e) => update("showOnDesktop", e.target.checked)} /> Show on desktop / tablet</label>
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={item.showOnMobile !== false} onChange={(e) => update("showOnMobile", e.target.checked)} /> Show on mobile</label>
    </div>
  </div>;
}
