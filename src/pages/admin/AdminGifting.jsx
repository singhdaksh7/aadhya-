import React, { useEffect, useState } from "react";
import AdminHomepageBuilder, { sectionTypeLabels } from "./AdminHomepageBuilder";
import GiftingSectionFields from "../../components/admin/GiftingSectionFields";
import ImagePickerInput from "../../components/admin/ImagePickerInput";
import { Button } from "../../components/ui";
import {
  adminFetchGiftingPage,
  adminCreateGiftingSection,
  adminReorderGiftingSections,
  adminRestoreGiftingDefaults,
  adminPublishPage,
  adminUpdatePage,
} from "../../lib/api";

export const GIFTING_SECTION_TYPES = [
  "GIFTING_HERO",
  "GIFTS_BY_OCCASION",
  "CURATED_STORIES",
  "GIFTS_BY_FESTIVAL",
  "GIFTING_BENEFITS",
  "GIFTS_BY_CRAFT",
  "FEATURED_GIFTS",
  "GIFTS_BY_BUDGET",
  "GIFTING_SEO",
  "GIFTING_FAQ",
];

const INPUT_CLS = "mt-1 w-full rounded-xl border border-charcoal/20 px-3 py-2 text-sm";

/** Page name / SEO title / SEO description / social share image of the /gifting page. */
export function GiftingPageSettings({ page, onSaved }) {
  const [form, setForm] = useState({ name: "", seoTitle: "", seoDescription: "", featuredImage: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      name: page?.name || "",
      seoTitle: page?.seoTitle || "",
      seoDescription: page?.seoDescription || "",
      featuredImage: page?.featuredImage || "",
    });
  }, [page?.id, page?.name, page?.seoTitle, page?.seoDescription, page?.featuredImage]);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await adminUpdatePage(page.id, {
        name: form.name.trim() || "Artisan Gifting",
        seoTitle: form.seoTitle.trim() || null,
        seoDescription: form.seoDescription.trim() || null,
        featuredImage: form.featuredImage.trim() || null,
      });
      setMessage("Page settings saved.");
      onSaved?.();
    } catch (err) {
      setError(err.message || "Failed to save page settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="admin-card p-5 space-y-4" data-testid="gifting-page-settings">
      <div className="flex items-center justify-between gap-3">
        <h2 className="admin-card__title">Page settings &amp; SEO</h2>
        <span className="text-xs text-charcoal-soft">URL: /gifting (fixed)</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block text-xs font-semibold text-charcoal-soft">
          Page name
          <input value={form.name} onChange={set("name")} maxLength={200} className={INPUT_CLS} />
        </label>
        <label className="block text-xs font-semibold text-charcoal-soft">
          SEO title (browser tab and search results)
          <input value={form.seoTitle} onChange={set("seoTitle")} maxLength={200} className={INPUT_CLS} />
        </label>
      </div>
      <label className="block text-xs font-semibold text-charcoal-soft">
        SEO description
        <textarea rows="3" value={form.seoDescription} onChange={set("seoDescription")} maxLength={500} className="mt-1 w-full rounded-xl border border-charcoal/20 p-3 text-sm" />
      </label>
      <div>
        <span className="block text-xs font-semibold text-charcoal-soft mb-1">Share image (Open Graph / featured image)</span>
        <ImagePickerInput value={form.featuredImage} onChange={(url) => setForm((prev) => ({ ...prev, featuredImage: url }))} />
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-terracotta">{error}</p>}
      {message && <p role="status" className="text-xs font-semibold text-green-deep">{message}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving || !page?.id}>{saving ? "Saving..." : "Save page settings"}</Button>
      </div>
    </form>
  );
}

async function restoreDefaults(reload) {
  const ok = window.confirm(
    "Restore the default gifting layout?\n\nAny default section that is currently missing will be added back with its original content. Sections that already exist (and your edits to them) are NOT changed or removed."
  );
  if (!ok) return;
  try {
    const res = await adminRestoreGiftingDefaults();
    const restored = (res?.restoredTypes || res?.data?.restoredTypes || []).length;
    window.alert(restored ? `Restored ${restored} default section${restored === 1 ? "" : "s"}.` : "Nothing to restore: every default section already exists.");
    reload();
  } catch (err) {
    window.alert("Restore failed: " + err.message);
  }
}

const GIFTING_CONFIG = {
  title: "Gifting",
  eyebrow: "Storefront page",
  description: "Edit everything on the /gifting page: page SEO, section order, visibility and all text, images and links.",
  noun: "gifting page",
  layoutTitle: "Gifting Page Layout",
  previewHref: "/gifting",
  previewLabel: "View page",
  publishLabel: "Publish Gifting Page",
  typeLabels: sectionTypeLabels(GIFTING_SECTION_TYPES),
  defaultNewType: "GIFTS_BY_OCCASION",
  load: async () => { const res = await adminFetchGiftingPage(); return res?.data || res; },
  create: (data) => adminCreateGiftingSection(data),
  reorder: (ids) => adminReorderGiftingSections(ids),
  publish: (page) => adminPublishPage(page.id, "PUBLISHED"),
  Fields: GiftingSectionFields,
  renderHeaderActions: ({ reload }) => (
    <button type="button" onClick={() => restoreDefaults(reload)} className="admin-btn admin-btn--ghost">
      Restore default gifting layout
    </button>
  ),
  renderAfterHeader: ({ page, reload }) => <GiftingPageSettings page={page} onSaved={reload} />,
};

export default function AdminGifting() {
  return <AdminHomepageBuilder config={GIFTING_CONFIG} />;
}
