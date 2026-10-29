import ImagePickerInput from "./ImagePickerInput";

export const MAX_CATEGORY_BANNERS = 20;

let counter = 0;
export const newBannerId = () => `bn_${Date.now().toString(36)}_${(counter += 1)}`;

export const blankBanner = () => ({
  id: newBannerId(),
  enabled: true,
  desktopImage: "",
  mobileImage: "",
  title: "",
  subtitle: "",
  ctaLabel: "",
  ctaUrl: "",
  sortOrder: 0,
});

/** Editor list for a category: its banners (sorted), else the legacy single banner promoted to banner #1. */
export function bannersFromCategory(c) {
  const list = Array.isArray(c?.banners) ? c.banners : [];
  if (list.length > 0) {
    return [...list]
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((b) => ({ ...blankBanner(), ...b, desktopImage: b.desktopImage || "", mobileImage: b.mobileImage || "", title: b.title || "", subtitle: b.subtitle || "", ctaLabel: b.ctaLabel || "", ctaUrl: b.ctaUrl || "" }));
  }
  if (c?.desktopBanner || c?.mobileBanner) {
    return [{ ...blankBanner(), id: "legacy-1", desktopImage: c.desktopBanner || "", mobileImage: c.mobileBanner || "" }];
  }
  return [];
}

/** API payload: trimmed, empty strings -> null, sortOrder = list position. */
export function bannersToPayload(list) {
  return list.map((b, i) => ({
    id: b.id,
    enabled: b.enabled !== false,
    desktopImage: b.desktopImage?.trim() || null,
    mobileImage: b.mobileImage?.trim() || null,
    title: b.title?.trim() || null,
    subtitle: b.subtitle?.trim() || null,
    ctaLabel: b.ctaLabel?.trim() || null,
    ctaUrl: b.ctaUrl?.trim() || null,
    sortOrder: i,
  }));
}

const inputCls = "w-full rounded-xl border border-charcoal/15 px-3 py-2 text-sm focus:border-charcoal/40 focus:outline-none";

export default function CategoryBannersEditor({ banners, onChange, autoplay, onAutoplayChange, intervalMs, onIntervalChange }) {
  const update = (i, patch) => onChange(banners.map((b, n) => (n === i ? { ...b, ...patch } : b)));
  const remove = (i) => onChange(banners.filter((_, n) => n !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= banners.length) return;
    const next = [...banners];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const atCap = banners.length >= MAX_CATEGORY_BANNERS;

  return (
    <fieldset className="space-y-3 rounded-xl border border-charcoal/10 p-4" data-testid="category-banners-editor">
      <legend className="px-1 text-sm font-semibold text-charcoal">Banners ({banners.length}/{MAX_CATEGORY_BANNERS})</legend>
      <p className="text-xs text-charcoal-soft">
        0 banners hides the section (or inherits the parent&apos;s); 1 shows a static banner; 2+ becomes a carousel.
      </p>

      {banners.map((b, i) => (
        <div key={b.id} data-testid="banner-row" className="space-y-3 rounded-xl border border-charcoal/10 bg-white/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold">Banner {i + 1}</span>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex cursor-pointer items-center gap-1">
                <input type="checkbox" checked={b.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} aria-label={`Enable banner ${i + 1}`} />
                Enabled
              </label>
              <button type="button" className="admin-btn admin-btn--ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move banner ${i + 1} up`}>Up</button>
              <button type="button" className="admin-btn admin-btn--ghost" disabled={i === banners.length - 1} onClick={() => move(i, 1)} aria-label={`Move banner ${i + 1} down`}>Down</button>
              <button type="button" className="admin-btn admin-btn--ghost text-terracotta" onClick={() => remove(i)} aria-label={`Remove banner ${i + 1}`}>Remove</button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ImagePickerInput label="Desktop image" sizeHint="1600 × 400 px (4:1 wide) — shown in a fixed wide frame" value={b.desktopImage} onChange={(url) => update(i, { desktopImage: url })} pickerTitle="Select desktop banner" inputClassName={inputCls} enableCrop aspectOptions={["wide", "free"]} />
            <ImagePickerInput label="Mobile image" sizeHint="1200 × 600 px (2:1) — shown in a fixed frame" value={b.mobileImage} onChange={(url) => update(i, { mobileImage: url })} pickerTitle="Select mobile banner" inputClassName={inputCls} enableCrop aspectOptions={["wide", "free"]} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input aria-label={`Banner ${i + 1} title`} placeholder="Title (optional)" maxLength={120} value={b.title} onChange={(e) => update(i, { title: e.target.value })} className={inputCls} />
            <input aria-label={`Banner ${i + 1} subtitle`} placeholder="Subtitle (optional)" maxLength={240} value={b.subtitle} onChange={(e) => update(i, { subtitle: e.target.value })} className={inputCls} />
            <input aria-label={`Banner ${i + 1} CTA label`} placeholder="CTA label (optional)" maxLength={60} value={b.ctaLabel} onChange={(e) => update(i, { ctaLabel: e.target.value })} className={inputCls} />
            <input aria-label={`Banner ${i + 1} CTA destination`} placeholder="CTA destination, e.g. /shop/category/vases" value={b.ctaUrl} onChange={(e) => update(i, { ctaUrl: e.target.value })} className={inputCls} />
          </div>
        </div>
      ))}

      <button type="button" className="admin-btn admin-btn--ghost" disabled={atCap} onClick={() => onChange([...banners, blankBanner()])}>
        + Add banner
      </button>
      {atCap && <p className="text-xs text-charcoal-soft">Maximum of {MAX_CATEGORY_BANNERS} banners reached.</p>}

      {banners.length > 1 && (
        <div className="flex flex-wrap items-center gap-4 border-t border-charcoal/10 pt-3 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={autoplay} onChange={(e) => onAutoplayChange(e.target.checked)} />
            Autoplay
          </label>
          <label className="flex items-center gap-2">
            Interval (seconds)
            <input
              type="number" min={2} max={30} step={1} className={`${inputCls} w-24`} aria-label="Autoplay interval seconds"
              value={Math.round(intervalMs / 1000)}
              onChange={(e) => onIntervalChange(Math.min(30000, Math.max(2000, (Number(e.target.value) || 5) * 1000)))}
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}
