import React, { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetchHomepage, adminFetchSiteSettings, adminListCategories, adminListPages, adminUpdateSiteSettings, resolveMediaUrl } from "../../lib/api";
import { refreshSiteSettings } from "../../hooks/useSiteSettings";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import ImagePickerInput from "../../components/admin/ImagePickerInput";
import { SCOPES, expandBothSides, frameStyle, imageStyle, normalizeDecoration, wrapperStyle } from "../../lib/decorations";

const FIELD = "mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2 text-sm";
const list = (res) => res?.items || res?.data?.items || res?.data || (Array.isArray(res) ? res : []);

const newDecoration = (count = 0) => ({
  id: crypto.randomUUID(), enabled: true, name: "New decoration", image: "", alt: "", scope: "HOME", targetId: "",
  side: "LEFT", mirrorBoth: true, vertical: "CENTER", width: 260, maxWidth: 0, widthTablet: 0, widthMobile: 0, offsetX: -40, offsetY: 0,
  opacity: 1, rotation: 0, flipH: false, flipV: false, layer: "MIDDLE", positionMode: "ABSOLUTE",
  focalX: 50, focalY: 50, zoom: 1, frameAspect: 0, showDesktop: true, showTablet: true, showMobile: false, sortOrder: count + 1,
});

function Num({ label, value, onChange, min, max, step = 1, hint }) {
  return (
    <label className="block text-xs font-semibold text-charcoal-soft">{label}
      <input type="number" aria-label={label} min={min} max={max} step={step} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className={FIELD} />
      {hint && <span className="mt-0.5 block text-[10px] font-normal">{hint}</span>}
    </label>
  );
}
const Check = ({ label, checked, onChange }) => <label className="flex items-center gap-2 text-xs font-semibold text-charcoal"><input type="checkbox" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>;
const Pick = ({ label, value, onChange, options }) => (
  <label className="block text-xs font-semibold text-charcoal-soft">{label}
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={FIELD}>{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
  </label>
);

// Shows the real result of the settings (side, size, offset, crop, opacity, rotation, flip) over a mock page.
function Preview({ item, device }) {
  const normalized = normalizeDecoration({ ...item, enabled: true });
  const width = { desktop: 1280, tablet: 820, mobile: 390 }[device];
  const shown = normalized && (device === "desktop" ? normalized.showDesktop : device === "tablet" ? normalized.showTablet : normalized.showMobile);
  const px = normalized && { desktop: normalized.width, tablet: normalized.widthTablet, mobile: normalized.widthMobile }[device];
  const scale = Math.min(1, 560 / width);
  return (
    <div>
      <div className="relative mx-auto overflow-hidden rounded-lg border border-charcoal/15 bg-[#faf6f0]" style={{ width: width * scale, height: 260 * scale + 40 }} data-testid="decoration-preview">
        <div style={{ width, height: 260 + 40 / scale, transform: `scale(${scale})`, transformOrigin: "top left" }} className="relative overflow-hidden">
          <div className="mx-auto mt-10 max-w-3xl space-y-3 px-6" aria-hidden="true">
            <div className="h-6 w-1/3 rounded bg-charcoal/10" /><div className="h-3 w-full rounded bg-charcoal/10" /><div className="h-3 w-5/6 rounded bg-charcoal/10" /><div className="h-24 w-full rounded bg-charcoal/10" />
          </div>
          {normalized && shown && item.image && expandBothSides([normalized]).map((copy) => (
            <div key={copy.id} className="pointer-events-none absolute" style={{ ...wrapperStyle(copy), width: px }}>
              <div className="overflow-hidden" style={frameStyle(copy)}>
                <img src={resolveMediaUrl(item.image)} alt="" className={`block w-full ${copy.frameAspect > 0 ? "h-full object-cover" : "h-auto"}`} style={imageStyle(copy)} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-1 text-center text-[10px] text-charcoal-soft">{!item.image ? "Choose an image to preview." : shown ? `${device} view at ${width}px wide` : `Hidden on ${device}`}</p>
    </div>
  );
}

function Editor({ item, onChange, targets }) {
  const set = (patch) => onChange({ ...item, ...patch });
  const [device, setDevice] = useState("desktop");
  const targetOptions = item.scope === "CATEGORY" ? targets.categories.map((c) => [c.slug, c.name])
    : item.scope === "PAGE" ? targets.pages.map((p) => [p.slug, p.name || p.title || p.slug])
    : item.scope === "HOME_SECTION" ? targets.sections.map((s) => [s.id, `${s.name || s.type} (${s.type})`]) : null;
  return (
    <div className="space-y-5" data-testid="decoration-editor">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-charcoal-soft">Admin label<input aria-label="Admin label" value={item.name} onChange={(e) => set({ name: e.target.value })} className={FIELD} /></label>
        <div className="pt-6"><Check label="Enabled" checked={item.enabled !== false} onChange={(v) => set({ enabled: v })} /></div>
        <div className="sm:col-span-2"><ImagePickerInput label="Artwork image (PNG / WebP with transparency works best)" value={item.image} onChange={(url) => set({ image: url })} pickerTitle="Select artwork" inputClassName="mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2 text-xs" /></div>
        <label className="block text-xs font-semibold text-charcoal-soft sm:col-span-2">Alt text (leave blank for purely decorative)<input aria-label="Alt text" value={item.alt} onChange={(e) => set({ alt: e.target.value })} className={FIELD} /></label>
      </div>

      <fieldset className="grid gap-3 rounded-xl border border-charcoal/10 p-3 sm:grid-cols-2"><legend className="px-1 text-xs font-bold uppercase tracking-wider text-charcoal">Where it appears</legend>
        <Pick label="Placement" value={item.scope} onChange={(v) => set({ scope: v, targetId: "" })} options={SCOPES} />
        {targetOptions && <Pick label="Target" value={item.targetId} onChange={(v) => set({ targetId: v })} options={[["", "Select…"], ...targetOptions]} />}
        {targetOptions && !item.targetId && <p className="text-[11px] text-terracotta sm:col-span-2">Choose a target, otherwise this decoration will not show.</p>}
        <Pick label="Position mode" value={item.positionMode} onChange={(v) => set({ positionMode: v })} options={[["ABSOLUTE", "Scrolls with the page / section (recommended)"], ["FIXED", "Stays fixed on screen"]]} />
        <Pick label="Layer" value={item.layer} onChange={(v) => set({ layer: v })} options={[["BEHIND", "Behind section content"], ["MIDDLE", "Decorative middle layer"], ["ABOVE", "Above content (still not clickable)"]]} />
      </fieldset>

      <fieldset className="grid gap-3 rounded-xl border border-charcoal/10 p-3 sm:grid-cols-2"><legend className="px-1 text-xs font-bold uppercase tracking-wider text-charcoal">Position</legend>
        <Pick label="Side" value={item.side} onChange={(v) => set({ side: v })} options={[["LEFT", "Left edge"], ["RIGHT", "Right edge"], ["BOTH", "Both edges (a pair)"]]} />
        {item.side === "BOTH" && <Check label="Mirror the right-hand copy" checked={item.mirrorBoth !== false} onChange={(v) => set({ mirrorBoth: v })} />}
        <Pick label="Vertical anchor" value={item.vertical} onChange={(v) => set({ vertical: v })} options={[["TOP", "Top"], ["CENTER", "Center"], ["BOTTOM", "Bottom"]]} />
        <Num label="X offset (px, negative pushes it off the edge)" value={item.offsetX} onChange={(v) => set({ offsetX: v })} min={-800} max={800} />
        <Num label="Y offset (px)" value={item.offsetY} onChange={(v) => set({ offsetY: v })} min={-1500} max={1500} />
      </fieldset>

      <fieldset className="grid gap-3 rounded-xl border border-charcoal/10 p-3 sm:grid-cols-2"><legend className="px-1 text-xs font-bold uppercase tracking-wider text-charcoal">Size</legend>
        <Num label="Desktop width (px)" value={item.width} onChange={(v) => set({ width: v })} min={20} max={1200} />
        <Num label="Max width (px, 0 = no limit)" value={item.maxWidth} onChange={(v) => set({ maxWidth: v })} min={0} max={1600} />
        <Num label="Tablet width (px, 0 = automatic)" value={item.widthTablet} onChange={(v) => set({ widthTablet: v })} min={0} max={1200} />
        <Num label="Mobile width (px, 0 = automatic)" value={item.widthMobile} onChange={(v) => set({ widthMobile: v })} min={0} max={800} />
      </fieldset>

      <fieldset className="grid gap-3 rounded-xl border border-charcoal/10 p-3 sm:grid-cols-2"><legend className="px-1 text-xs font-bold uppercase tracking-wider text-charcoal">Appearance</legend>
        <Num label="Opacity (0.1 – 1)" value={item.opacity} onChange={(v) => set({ opacity: v })} min={0.1} max={1} step={0.05} />
        <Num label="Rotation (degrees, -180 to 180)" value={item.rotation} onChange={(v) => set({ rotation: v })} min={-180} max={180} />
        <Check label="Flip horizontally" checked={item.flipH === true} onChange={(v) => set({ flipH: v })} />
        <Check label="Flip vertically" checked={item.flipV === true} onChange={(v) => set({ flipV: v })} />
      </fieldset>

      <fieldset className="grid gap-3 rounded-xl border border-charcoal/10 p-3 sm:grid-cols-2"><legend className="px-1 text-xs font-bold uppercase tracking-wider text-charcoal">Crop (never changes the original file)</legend>
        <Num label="Focal point X (%)" value={item.focalX} onChange={(v) => set({ focalX: v })} min={0} max={100} />
        <Num label="Focal point Y (%)" value={item.focalY} onChange={(v) => set({ focalY: v })} min={0} max={100} />
        <Num label="Zoom (0.5 – 3)" value={item.zoom} onChange={(v) => set({ zoom: v })} min={0.5} max={3} step={0.1} />
        <Num label="Visible frame ratio (width ÷ height, 0 = natural)" value={item.frameAspect} onChange={(v) => set({ frameAspect: v })} min={0} max={5} step={0.1} />
      </fieldset>

      <fieldset className="rounded-xl border border-charcoal/10 p-3"><legend className="px-1 text-xs font-bold uppercase tracking-wider text-charcoal">Devices</legend>
        <div className="flex flex-wrap gap-5">
          <Check label="Show on desktop" checked={item.showDesktop !== false} onChange={(v) => set({ showDesktop: v })} />
          <Check label="Show on tablet" checked={item.showTablet !== false} onChange={(v) => set({ showTablet: v })} />
          <Check label="Show on mobile" checked={item.showMobile === true} onChange={(v) => set({ showMobile: v })} />
        </div>
        <p className="mt-2 text-[11px] text-charcoal-soft">Mobile is off by default so large artwork never crowds a phone screen.</p>
      </fieldset>

      <div>
        <div className="mb-2 flex gap-2">{["desktop", "tablet", "mobile"].map((d) => <button key={d} type="button" onClick={() => setDevice(d)} aria-pressed={device === d} className={`rounded-full border px-3 py-1 text-xs font-semibold ${device === d ? "border-terracotta text-terracotta" : "border-charcoal/20 text-charcoal-soft"}`}>{d}</button>)}</div>
        <Preview item={item} device={device} />
      </div>
    </div>
  );
}

export default function AdminDecorations() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [targets, setTargets] = useState({ categories: [], pages: [], sections: [] });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await adminFetchSiteSettings();
        const data = res?.data || res;
        const loaded = Array.isArray(data?.decorations?.items) ? data.decorations.items : [];
        if (!alive) return;
        setItems(loaded); setSelectedId(loaded[0]?.id || null); setStatus("ready");
      } catch (err) { if (alive) { setStatus("error"); setMessage(err.message || "Could not load decorations."); } }
      Promise.all([adminListCategories(true), adminListPages({ limit: 100 }), adminFetchHomepage()]).then(([cats, pages, home]) => {
        if (!alive) return;
        const sections = home?.sections || home?.data?.sections || home?.page?.sections || [];
        setTargets({ categories: list(cats), pages: list(pages), sections });
      }).catch(() => {});
    })();
    return () => { alive = false; };
  }, []);

  const selected = useMemo(() => items.find((i) => i.id === selectedId) || null, [items, selectedId]);
  const update = useCallback((next) => setItems((current) => current.map((i) => (i.id === next.id ? next : i))), []);
  const add = () => { const item = newDecoration(items.length); setItems([...items, item]); setSelectedId(item.id); };
  const duplicate = (item) => { const copy = { ...item, id: crypto.randomUUID(), name: `${item.name} (copy)` }; const index = items.findIndex((i) => i.id === item.id); const next = [...items]; next.splice(index + 1, 0, copy); setItems(next); setSelectedId(copy.id); };
  const remove = (item) => { if (!window.confirm(`Delete "${item.name}"?`)) return; const next = items.filter((i) => i.id !== item.id); setItems(next); setSelectedId(next[0]?.id || null); };
  const move = (index, dir) => { const to = index + dir; if (to < 0 || to >= items.length) return; const next = [...items]; [next[index], next[to]] = [next[to], next[index]]; setItems(next); };

  const save = async () => {
    setSaving(true); setMessage("");
    try {
      await adminUpdateSiteSettings({ decorations: { items: items.map((item, index) => ({ ...item, sortOrder: index + 1 })) } });
      await refreshSiteSettings();
      setMessage("Saved. The storefront now uses these decorations.");
    } catch (err) { setMessage(`Could not save: ${err.message}`); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__eyebrow">Content</p>
          <h1 className="admin-page-header__title">Decorative Artwork</h1>
          <p className="admin-page-header__desc">Place botanical motifs, line art or emblems along the edges of any page or homepage section. Artwork never blocks clicks and never adds page scroll. Nothing shows until you add a decoration.</p>
        </div>
        <div className="admin-page-header__actions"><button type="button" onClick={add} className="admin-btn admin-btn--ghost">+ Add Decoration</button><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></div>
      </div>
      {status === "loading" && <LoadingNotice />}
      {status === "error" && <ErrorNotice message={message} />}
      {message && status === "ready" && <p role="status" className="text-xs font-semibold text-charcoal">{message}</p>}
      {status === "ready" && (
        <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="admin-card space-y-2 p-3" data-testid="decoration-list">
            {items.length === 0 && <p className="p-3 text-center text-sm italic text-charcoal-soft">No decorations yet. Click “+ Add Decoration”.</p>}
            {items.map((item, index) => (
              <div key={item.id} className={`rounded-xl border p-3 ${item.id === selectedId ? "border-terracotta bg-[#FAF6F0]" : "border-charcoal/10"} ${item.enabled === false ? "opacity-60" : ""}`}>
                <button type="button" onClick={() => setSelectedId(item.id)} className="block w-full text-left">
                  <span className="block truncate text-sm font-semibold text-charcoal">{item.name || "Untitled"}</span>
                  <span className="block text-[11px] text-charcoal-soft">{SCOPES.find(([v]) => v === item.scope)?.[1] || item.scope} · {item.side === "BOTH" ? "both sides" : item.side === "RIGHT" ? "right" : "left"}{item.enabled === false ? " · disabled" : ""}</span>
                </button>
                <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                  <button type="button" aria-label={`Move ${item.name} up`} disabled={index === 0} onClick={() => move(index, -1)} className="rounded border px-2 py-0.5 disabled:opacity-30">▲</button>
                  <button type="button" aria-label={`Move ${item.name} down`} disabled={index === items.length - 1} onClick={() => move(index, 1)} className="rounded border px-2 py-0.5 disabled:opacity-30">▼</button>
                  <button type="button" aria-label={`Duplicate ${item.name}`} onClick={() => duplicate(item)} className="rounded border px-2 py-0.5">Duplicate</button>
                  <button type="button" aria-label={`Delete ${item.name}`} onClick={() => remove(item)} className="rounded border px-2 py-0.5 text-terracotta">Delete</button>
                </div>
              </div>
            ))}
            <p className="px-1 pt-1 text-[10px] text-charcoal-soft">Items lower in the list paint above earlier ones.</p>
          </div>
          <div className="admin-card p-5">{selected ? <Editor item={selected} onChange={update} targets={targets} /> : <p className="py-10 text-center text-sm text-charcoal-soft">Select or add a decoration to edit it.</p>}</div>
        </div>
      )}
    </div>
  );
}
