import React from "react";
import ImagePickerInput from "./ImagePickerInput";

export const EXPLORE_MORE_MAX_ITEMS = 8;
export const EXPLORE_MORE_ICON_OPTIONS = [["sparkles", "Sparkles"], ["gift", "Gift"], ["tag", "Tag"], ["star", "Star"], ["heart", "Heart"], ["leaf", "Leaf"], ["badge", "Badge"], ["home", "Home"]];
export const exploreMoreEmptyItem = (count = 0) => ({ id: crypto.randomUUID(), title: "", subtitle: "", image: "", imageAlt: "", icon: "sparkles", ctaLabel: "", url: "", enabled: true, sortOrder: count + 1 });

// Swap two cards and renumber sortOrder so the saved order always matches the list order.
export function moveExploreItem(items, index, dir) {
  const target = index + dir;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((item, i) => ({ ...item, sortOrder: i + 1 }));
}

const SMALL = "rounded border p-2 text-xs";

export default function ExploreMoreItemFields({ item, update, index, count, onMove }) {
  const urlOk = !item.url || item.url.startsWith("/") || /^https?:\/\//i.test(item.url);
  return <div className="grid gap-2">
    <div className="flex items-center gap-2 text-xs">
      <button type="button" aria-label="Move card up" disabled={index === 0} onClick={() => onMove(-1)} className="rounded border px-2 py-1 disabled:opacity-30">▲</button>
      <button type="button" aria-label="Move card down" disabled={index === count - 1} onClick={() => onMove(1)} className="rounded border px-2 py-1 disabled:opacity-30">▼</button>
    </div>
    <input aria-label="Card title" value={item.title || ""} placeholder="Title" onChange={(e) => update("title", e.target.value)} className={SMALL} />
    <input aria-label="Card subtitle" value={item.subtitle || ""} placeholder="Subtitle (optional)" onChange={(e) => update("subtitle", e.target.value)} className={SMALL} />
    <input aria-label="Card CTA label" value={item.ctaLabel || ""} placeholder="CTA label (e.g. View Offers)" onChange={(e) => update("ctaLabel", e.target.value)} className={SMALL} />
    <input aria-label="Card link" value={item.url || ""} placeholder="Link: /offers or https://..." onChange={(e) => update("url", e.target.value)} className={SMALL} />
    {!urlOk && <p className="text-xs text-terracotta">Link must start with / or http(s)://</p>}
    <ImagePickerInput label="Card image (optional; replaces the icon)" value={item.image} onChange={(url) => update("image", url)} pickerTitle="Select card image" inputClassName="rounded border p-2 text-xs w-full" enableCrop aspectOptions={["wide", "square", "free"]} />
    <input aria-label="Card image alt text" value={item.imageAlt || ""} placeholder="Image alt text" onChange={(e) => update("imageAlt", e.target.value)} className={SMALL} />
    <label className="text-xs text-charcoal-soft">Icon (used when there is no image)
      <select aria-label="Card icon" value={item.icon || "sparkles"} onChange={(e) => update("icon", e.target.value)} className={`${SMALL} mt-1 w-full`}>
        {EXPLORE_MORE_ICON_OPTIONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  </div>;
}
