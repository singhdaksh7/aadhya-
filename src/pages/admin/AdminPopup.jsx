import React, { useEffect, useState } from "react";
import { adminGetPromoPopup, adminUpdatePromoPopup } from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import ImagePickerInput from "../../components/admin/ImagePickerInput";

export const EMPTY_POPUP = {
  enabled: false,
  title: "",
  description: "",
  desktopImage: "",
  mobileImage: "",
  ctaLabel: "",
  ctaUrl: "",
  dismissLabel: "Maybe later",
  delaySeconds: 5,
  frequency: "SESSION",
  days: 7,
  startDate: "",
  endDate: "",
  targeting: "HOME",
  routes: [],
};

const INPUT = "mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2 text-sm";
const LABEL = "block text-xs font-semibold text-charcoal-soft";

/** ISO string -> value for <input type="datetime-local"> (local time, no seconds). */
export function isoToLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value -> ISO string ("" stays "" = no limit). */
export function localInputToIso(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** One route per line (or comma separated); trims, drops blanks, de-duplicates, forces a leading slash. */
export function parseRoutes(text) {
  const seen = new Set();
  return String(text || "")
    .split(/[\n,]/)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => (r.startsWith("/") ? r : `/${r}`))
    .filter((r) => (seen.has(r) ? false : seen.add(r)));
}

export function popupFormError(form) {
  if (form.enabled && !form.title.trim()) return "Title is required while the popup is enabled.";
  if (form.ctaLabel.trim() && !form.ctaUrl.trim()) return "Add a CTA URL for the CTA button.";
  if (form.targeting === "SELECTED" && form.routes.length === 0) return "Add at least one page for selected-page targeting.";
  if (form.startDate && form.endDate && Date.parse(form.endDate) <= Date.parse(form.startDate)) return "End date must be after the start date.";
  return "";
}

export default function AdminPopup() {
  const [form, setForm] = useState(EMPTY_POPUP);
  const [routesText, setRoutesText] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    adminGetPromoPopup()
      .then((res) => {
        if (!active) return;
        const data = { ...EMPTY_POPUP, ...(res?.data || res || {}) };
        setForm(data);
        setRoutesText((data.routes || []).join("\n"));
        setStatus("ready");
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Could not load the popup settings.");
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const set = (patch) => {
    setMessage("");
    setForm((f) => ({ ...f, ...patch }));
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      enabled: form.enabled,
      title: form.title.trim(),
      description: form.description.trim(),
      desktopImage: form.desktopImage || "",
      mobileImage: form.mobileImage || "",
      ctaLabel: form.ctaLabel.trim(),
      ctaUrl: form.ctaUrl.trim(),
      dismissLabel: form.dismissLabel.trim(),
      delaySeconds: Math.max(0, Math.min(300, Math.round(Number(form.delaySeconds) || 0))),
      frequency: form.frequency,
      days: Math.max(1, Math.min(365, Math.round(Number(form.days) || 1))),
      startDate: form.startDate || "",
      endDate: form.endDate || "",
      targeting: form.targeting,
      routes: form.targeting === "SELECTED" ? parseRoutes(routesText) : [],
    };
    const problem = popupFormError(payload);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await adminUpdatePromoPopup(payload);
      const data = { ...EMPTY_POPUP, ...(res?.data || res || {}) };
      setForm(data);
      setRoutesText((data.routes || []).join("\n"));
      setMessage("Popup saved.");
    } catch (err) {
      setError(err.message || "Could not save the popup.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") return <LoadingNotice />;
  if (status === "error") return <ErrorNotice message={error} />;

  return (
    <form onSubmit={save} className="space-y-6" data-testid="admin-popup-form">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-charcoal/10 pb-4">
        <div>
          <h1 className="font-serif-display text-2xl font-bold text-charcoal">Popup / Promotions</h1>
          <p className="mt-1 text-xs text-charcoal-soft">
            A single promotional popup for the storefront (for example the Gifting campaign). It only appears while enabled and inside the schedule below.
          </p>
        </div>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save popup"}</Button>
      </div>

      {error && <p role="alert" className="text-xs font-semibold text-terracotta">{error}</p>}
      {message && <p role="status" className="text-xs font-semibold text-green-700">{message}</p>}

      <div className="space-y-4 rounded-2xl border border-charcoal/10 bg-white p-6">
        <label className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Popup enabled
        </label>
        <label className={LABEL}>
          Title
          <input type="text" maxLength={120} value={form.title} onChange={(e) => set({ title: e.target.value })} className={INPUT} />
        </label>
        <label className={LABEL}>
          Description
          <textarea rows={3} maxLength={500} value={form.description} onChange={(e) => set({ description: e.target.value })} className={INPUT} />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-xs font-semibold text-charcoal-soft">Desktop image</span>
            <ImagePickerInput value={form.desktopImage || ""} onChange={(url) => set({ desktopImage: url })} />
          </div>
          <div>
            <span className="mb-1 block text-xs font-semibold text-charcoal-soft">Mobile image (optional)</span>
            <ImagePickerInput value={form.mobileImage || ""} onChange={(url) => set({ mobileImage: url })} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className={LABEL}>
            CTA label
            <input type="text" maxLength={60} value={form.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} className={INPUT} />
          </label>
          <label className={LABEL}>
            CTA URL
            <input type="text" placeholder="/gifting" value={form.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} className={INPUT} />
          </label>
          <label className={LABEL}>
            Dismiss button label
            <input type="text" maxLength={60} value={form.dismissLabel} onChange={(e) => set({ dismissLabel: e.target.value })} className={INPUT} />
          </label>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-charcoal/10 bg-white p-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-charcoal">Timing &amp; frequency</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className={LABEL}>
            Delay before showing (seconds)
            <input type="number" min={0} max={300} value={form.delaySeconds} onChange={(e) => set({ delaySeconds: e.target.value })} className={INPUT} />
          </label>
          <label className={LABEL}>
            Show again
            <select value={form.frequency} onChange={(e) => set({ frequency: e.target.value })} className={INPUT}>
              <option value="SESSION">Once per browser session</option>
              <option value="DAILY">Once a day</option>
              <option value="EVERY_X_DAYS">Every X days</option>
            </select>
          </label>
          {form.frequency === "EVERY_X_DAYS" && (
            <label className={LABEL}>
              Days between showings
              <input type="number" min={1} max={365} value={form.days} onChange={(e) => set({ days: e.target.value })} className={INPUT} />
            </label>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={LABEL}>
            Start date (optional)
            <input type="datetime-local" value={isoToLocalInput(form.startDate)} onChange={(e) => set({ startDate: localInputToIso(e.target.value) })} className={INPUT} />
          </label>
          <label className={LABEL}>
            End date (optional)
            <input type="datetime-local" value={isoToLocalInput(form.endDate)} onChange={(e) => set({ endDate: localInputToIso(e.target.value) })} className={INPUT} />
          </label>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-charcoal/10 bg-white p-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-charcoal">Where it appears</h2>
        <label className={LABEL}>
          Targeting
          <select value={form.targeting} onChange={(e) => set({ targeting: e.target.value })} className={INPUT}>
            <option value="HOME">Homepage only</option>
            <option value="ALL">All storefront pages</option>
            <option value="SELECTED">Selected pages</option>
          </select>
        </label>
        {form.targeting === "SELECTED" && (
          <label className={LABEL}>
            Pages (one path per line; use /shop/* to include everything under /shop)
            <textarea rows={4} value={routesText} onChange={(e) => { setMessage(""); setRoutesText(e.target.value); }} placeholder={"/\n/gifting"} className={INPUT} />
          </label>
        )}
        <p className="text-[11px] text-charcoal-soft">The popup never appears in the admin, the cart, checkout, payment or order pages.</p>
      </div>
    </form>
  );
}
