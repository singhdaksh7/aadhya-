import React from "react";
import ImagePickerInput from "./ImagePickerInput";

export const MAX_MILESTONES = 12;
const INPUT = "mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2 text-sm";
const SMALL = "w-full rounded border p-2 text-xs";
const ICONS = [["", "No icon"], ["sparkles", "Sparkles"], ["badge", "Badge"], ["home", "Home"], ["shield", "Shield"], ["leaf", "Leaf"], ["heart", "Heart"]];

// Reassigns sortOrder from array position so the storefront (which sorts by sortOrder) matches the editor.
const renumber = (list) => list.map((m, i) => ({ ...m, sortOrder: i + 1 }));

// Admin controls for the OUR_JOURNEY section: heading, illustration, background and milestones.
export default function OurJourneyFields({ value, set }) {
  const list = Array.isArray(value.milestones) ? value.milestones : [];
  const setList = (next) => set("milestones", renumber(next));
  const update = (i, key, val) => setList(list.map((m, idx) => (idx === i ? { ...m, [key]: val } : m)));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
  };
  const add = () => list.length < MAX_MILESTONES && setList([...list, { id: crypto.randomUUID(), date: "", title: "", description: "", icon: "", image: "", enabled: true }]);

  return <div className="space-y-4">
    <div className="grid gap-3 rounded-xl border border-charcoal/10 p-3 sm:grid-cols-2">
      <label className="block text-xs font-semibold text-charcoal-soft">Eyebrow<input aria-label="Journey eyebrow" value={value.eyebrow ?? ""} onChange={(e) => set("eyebrow", e.target.value)} className={INPUT} /></label>
      <label className="block text-xs font-semibold text-charcoal-soft">Title<input aria-label="Journey title" value={value.title ?? ""} onChange={(e) => set("title", e.target.value)} className={INPUT} /></label>
      <label className="block text-xs font-semibold text-charcoal-soft sm:col-span-2">Subtitle<input aria-label="Journey subtitle" value={value.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value)} className={INPUT} /></label>
      <label className="block text-xs font-semibold text-charcoal-soft">Background
        <select aria-label="Journey background" value={value.background || "PLAIN"} onChange={(e) => set("background", e.target.value)} className={INPUT}><option value="PLAIN">Plain page background</option><option value="SURFACE">Soft surface</option></select>
      </label>
      <label className="block text-xs font-semibold text-charcoal-soft">Illustration alt text<input aria-label="Journey image alt" value={value.imageAlt ?? ""} onChange={(e) => set("imageAlt", e.target.value)} className={INPUT} /></label>
      <label className="block text-xs font-semibold text-charcoal-soft">Image position (beside the timeline on desktop)<select aria-label="Journey image position" value={value.imagePosition || "RIGHT"} onChange={(e) => set("imagePosition", e.target.value)} className={INPUT}><option value="RIGHT">Right side</option><option value="LEFT">Left side</option></select></label>
      <div className="sm:col-span-2"><ImagePickerInput label="Section image / illustration (optional)" value={value.image} onChange={(url) => set("image", url)} pickerTitle="Select journey image" inputClassName="mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2 text-xs" enableCrop aspectOptions={["wide", "banner", "free"]} /></div>
    </div>
    <div className="space-y-3 border-t border-charcoal/10 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-charcoal">Milestones ({list.length}/{MAX_MILESTONES})</p>
        <button type="button" onClick={add} disabled={list.length >= MAX_MILESTONES} className="rounded-full border border-terracotta px-3 py-1 text-xs text-terracotta disabled:opacity-40">+ Add milestone</button>
      </div>
      {list.length === 0 && <p className="text-xs text-charcoal-soft">No milestones: the section is hidden on the storefront until you add at least one.</p>}
      {list.map((m, i) => (
        <div key={m.id || i} data-testid="journey-editor-item" className="rounded-xl border border-charcoal/10 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <label className="text-xs"><input type="checkbox" aria-label={`Milestone ${i + 1} enabled`} checked={m.enabled !== false} onChange={(e) => update(i, "enabled", e.target.checked)} /> Enabled</label>
            <span className="text-xs text-charcoal-soft">Order {i + 1}</span>
            <span className="ml-auto flex gap-2">
              <button type="button" aria-label={`Move milestone ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded border px-2 py-1 text-xs disabled:opacity-30">Up</button>
              <button type="button" aria-label={`Move milestone ${i + 1} down`} disabled={i === list.length - 1} onClick={() => move(i, 1)} className="rounded border px-2 py-1 text-xs disabled:opacity-30">Down</button>
              <button type="button" aria-label={`Delete milestone ${i + 1}`} onClick={() => setList(list.filter((_, idx) => idx !== i))} className="text-xs text-terracotta">Delete</button>
            </span>
          </div>
          <div className="grid gap-2">
            <div className="grid gap-2 sm:grid-cols-3">
              <input aria-label={`Milestone ${i + 1} date`} value={m.date || ""} placeholder="Year / date text" onChange={(e) => update(i, "date", e.target.value)} className={SMALL} />
              <input aria-label={`Milestone ${i + 1} title`} value={m.title || ""} placeholder="Title" onChange={(e) => update(i, "title", e.target.value)} className={`${SMALL} sm:col-span-2`} />
            </div>
            <textarea aria-label={`Milestone ${i + 1} description`} rows="2" value={m.description || ""} placeholder="Description" onChange={(e) => update(i, "description", e.target.value)} className={SMALL} />
            <select aria-label={`Milestone ${i + 1} icon`} value={m.icon || ""} onChange={(e) => update(i, "icon", e.target.value)} className={SMALL}>{ICONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            <ImagePickerInput label="Milestone image (optional)" value={m.image} onChange={(url) => update(i, "image", url)} pickerTitle="Select milestone image" inputClassName="rounded border p-2 text-xs w-full" enableCrop aspectOptions={["wide", "square", "free"]} />
          </div>
        </div>
      ))}
    </div>
  </div>;
}
