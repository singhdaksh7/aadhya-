import React, { useState } from "react";
import ImagePickerInput from "./ImagePickerInput";
import { adminUploadMedia } from "../../lib/api";

export const MAX_REELS = 24;
export const MAX_REEL_PRODUCTS = 12;
export const MAX_REEL_CATEGORIES = 12;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const btn = "rounded border border-charcoal/15 px-2 py-0.5 text-xs disabled:opacity-30";
const input = "mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2 text-sm";
const newReel = () => ({ id: crypto.randomUUID(), title: "", videoUrl: "", coverImage: "", ctaLabel: "Shop Now", productIds: [], categoryIds: [], enabled: true, published: false });

function VideoField({ value, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const upload = async (file) => {
    if (!file) return;
    setError("");
    if (!["video/mp4", "video/webm"].includes(file.type)) return setError("Only MP4 or WebM videos are supported.");
    if (file.size > MAX_VIDEO_BYTES) return setError("Video must be 30 MB or smaller.");
    try {
      setBusy(true);
      const res = await adminUploadMedia(file, { title: file.name });
      onChange((res.data || res).url);
    } catch (err) {
      setError(err.message || "Video upload failed");
    } finally {
      setBusy(false);
    }
  };
  return <div className="text-xs font-semibold text-charcoal-soft">
    <label>Reel video (MP4 or WebM, max 30 MB)
      <input type="text" aria-label="Video URL" placeholder="Upload below or paste a direct .mp4 / .webm URL" value={value || ""} onChange={(e) => onChange(e.target.value)} className={input} />
    </label>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label className="cursor-pointer rounded-full border border-charcoal/20 bg-white px-3 py-1 text-xs font-semibold text-charcoal hover:border-terracotta">
        {busy ? "Uploading…" : value ? "Replace video" : "Upload video"}
        <input type="file" aria-label="Upload video file" accept="video/mp4,video/webm" disabled={busy} className="sr-only" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {value && <button type="button" onClick={() => onChange("")} className="rounded-full border border-terracotta/20 px-3 py-1 text-xs font-semibold text-terracotta">Remove video</button>}
    </div>
    {error && <p role="alert" className="mt-1 text-terracotta">{error}</p>}
  </div>;
}

export default function ShoppableReelsFields({ value = {}, onChange, products = [], categories = [] }) {
  const reels = Array.isArray(value.reels) ? value.reels : [];
  const setReels = (next) => onChange({ ...value, reels: next.map((reel, index) => ({ ...reel, sortOrder: index + 1 })) });
  const patch = (index, change) => setReels(reels.map((reel, i) => (i === index ? { ...reel, ...change } : reel)));
  const move = (index, dir) => { const next = [...reels]; [next[index + dir], next[index]] = [next[index], next[index + dir]]; setReels(next); };
  return <div className="space-y-4 border-t border-charcoal/10 pt-4">
    <label className="flex items-center gap-2 text-xs font-semibold text-charcoal"><input type="checkbox" checked={value.showArrows !== false} onChange={(e) => onChange({ ...value, showArrows: e.target.checked })} /> Show carousel arrows (desktop)</label>
    <div className="flex items-center justify-between">
      <p className="text-xs font-bold uppercase tracking-wider text-charcoal">Reels ({reels.length}/{MAX_REELS})</p>
      <button type="button" disabled={reels.length >= MAX_REELS} onClick={() => setReels([...reels, newReel()])} className="rounded-full border border-charcoal/20 px-3 py-1 text-xs font-semibold disabled:opacity-40">Add reel</button>
    </div>
    {reels.length === 0 && <p className="text-xs text-charcoal-soft">No reels yet. The section stays hidden on the storefront until at least one reel is published.</p>}
    {reels.map((reel, index) => {
      const ids = reel.productIds || [];
      const catIds = reel.categoryIds || [];
      return <fieldset key={reel.id || index} data-testid="reel-editor" className="space-y-3 rounded-xl border border-charcoal/10 p-3">
        <legend className="px-1 text-xs font-bold text-charcoal">Reel {index + 1}{reel.published ? "" : " (draft)"}</legend>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1 text-xs font-semibold text-charcoal"><input type="checkbox" aria-label={`Reel ${index + 1} enabled`} checked={reel.enabled !== false} onChange={(e) => patch(index, { enabled: e.target.checked })} /> Enabled</label>
          <label className="flex items-center gap-1 text-xs font-semibold text-charcoal"><input type="checkbox" aria-label={`Reel ${index + 1} published`} checked={reel.published === true} onChange={(e) => patch(index, { published: e.target.checked })} /> Published</label>
          <span className="ml-auto flex gap-1">
            <button type="button" aria-label={`Move reel ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)} className={btn}>▲</button>
            <button type="button" aria-label={`Move reel ${index + 1} down`} disabled={index === reels.length - 1} onClick={() => move(index, 1)} className={btn}>▼</button>
            <button type="button" aria-label={`Remove reel ${index + 1}`} onClick={() => setReels(reels.filter((_, i) => i !== index))} className={`${btn} text-terracotta`}>Remove</button>
          </span>
        </div>
        <label className="block text-xs font-semibold text-charcoal-soft">Reel title<input aria-label={`Reel ${index + 1} title`} value={reel.title || ""} onChange={(e) => patch(index, { title: e.target.value })} className={input} /></label>
        <VideoField value={reel.videoUrl} onChange={(url) => patch(index, { videoUrl: url })} />
        <ImagePickerInput label="Cover / poster image" value={reel.coverImage} onChange={(url) => patch(index, { coverImage: url })} pickerTitle="Select reel cover image" inputClassName={input} />
        <label className="block text-xs font-semibold text-charcoal-soft">CTA label<input aria-label={`Reel ${index + 1} CTA label`} value={reel.ctaLabel || ""} onChange={(e) => patch(index, { ctaLabel: e.target.value })} className={input} /></label>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-charcoal-soft">Linked products ({ids.length}/{MAX_REEL_PRODUCTS}) — one goes straight to the product, several open a "Shop this reel" tray</p>
          <select aria-label={`Reel ${index + 1} add product`} value="" disabled={ids.length >= MAX_REEL_PRODUCTS} onChange={(e) => { if (e.target.value && !ids.includes(e.target.value)) patch(index, { productIds: [...ids, e.target.value] }); }} className="w-full rounded-xl border border-charcoal/20 px-3 py-2 text-sm">
            <option value="">+ Add a product…</option>
            {products.map((product) => <option key={product.id} value={product.id} disabled={!product.isActive}>{product.name}{product.sku ? ` • ${product.sku}` : ""} • {product.isActive ? "Active" : "Inactive"}</option>)}
          </select>
          {ids.map((id) => { const product = products.find((p) => p.id === id); return <div key={id} className="flex items-center gap-2 rounded border border-charcoal/10 p-2 text-xs"><span className="flex-1 truncate">{product ? product.name : id}{product && !product.isActive && <span className="ml-1 text-terracotta">(inactive)</span>}</span><button type="button" aria-label={`Unlink ${product ? product.name : id}`} onClick={() => patch(index, { productIds: ids.filter((x) => x !== id) })} className="text-terracotta">Remove</button></div>; })}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-charcoal-soft">Linked categories ({catIds.length}/{MAX_REEL_CATEGORIES}) — a single category goes straight to it; with other links they appear in the tray</p>
          <select aria-label={`Reel ${index + 1} add category`} value="" disabled={catIds.length >= MAX_REEL_CATEGORIES} onChange={(e) => { if (e.target.value && !catIds.includes(e.target.value)) patch(index, { categoryIds: [...catIds, e.target.value] }); }} className="w-full rounded-xl border border-charcoal/20 px-3 py-2 text-sm">
            <option value="">+ Link a category…</option>
            {categories.map((category) => <option key={category.id} value={category.id} disabled={category.isActive === false}>{category.name} • {category.isActive === false ? "Inactive" : "Active"}</option>)}
          </select>
          {catIds.map((id) => { const category = categories.find((c) => c.id === id); const inactive = category && category.isActive === false; return <div key={id} className="flex items-center gap-2 rounded border border-charcoal/10 p-2 text-xs"><span className="flex-1 truncate">{category ? category.name : id}{inactive && <span className="ml-1 text-terracotta">(inactive)</span>}</span><button type="button" aria-label={`Unlink category ${category ? category.name : id}`} onClick={() => patch(index, { categoryIds: catIds.filter((x) => x !== id) })} className="text-terracotta">Remove</button></div>; })}
        </div>
      </fieldset>;
    })}
  </div>;
}
