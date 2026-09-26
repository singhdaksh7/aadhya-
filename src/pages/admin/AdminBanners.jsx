import React, { useEffect, useState } from "react";
import {
  adminFetchBanners,
  adminCreateBanner,
  adminUpdateBanner,
  adminDeleteBanner,
} from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";

const PLACEMENTS = [
  { value: "HOME_HERO", label: "Homepage Hero Banner" },
  { value: "HOME_PROMO", label: "Homepage 2-Up Promotional Banner" },
  { value: "SHOP_TOP", label: "Shop Top Banner" },
  { value: "CATEGORY_TOP", label: "Category Top Banner" },
  { value: "GLOBAL_PROMO", label: "Global Promo Bar" },
];

export default function AdminBanners() {
  const [banners, setBanners] = useState([]);
  const [filterPlacement, setFilterPlacement] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);

  const [form, setForm] = useState({
    name: "",
    placement: "HOME_HERO",
    desktopImage: "",
    mobileImage: "",
    eyebrow: "",
    title: "",
    highlightText: "",
    subtitle: "",
    primaryCtaLabel: "",
    primaryCtaUrl: "",
    secondaryCtaLabel: "",
    secondaryCtaUrl: "",
    textPosition: "left",
    textTheme: "dark",
    startDate: "",
    endDate: "",
    isActive: true,
    sortOrder: 0,
  });

  const loadBanners = async () => {
    setStatus("loading");
    try {
      const res = await adminFetchBanners(filterPlacement ? { placement: filterPlacement } : {});
      setBanners(res.banners || res.data || []);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load admin banners:", err);
      setStatus("error");
      setError(err.message || "Could not fetch banners.");
    }
  };

  useEffect(() => {
    loadBanners();
  }, [filterPlacement]);

  const openCreateModal = () => {
    setEditingBanner(null);
    setForm({
      name: "",
      placement: filterPlacement || "HOME_HERO",
      desktopImage: "",
      mobileImage: "",
      eyebrow: "",
      title: "",
      highlightText: "",
      subtitle: "",
      primaryCtaLabel: "",
      primaryCtaUrl: "",
      secondaryCtaLabel: "",
      secondaryCtaUrl: "",
      textPosition: "left",
      textTheme: "dark",
      startDate: "",
      endDate: "",
      isActive: true,
      sortOrder: banners.length * 10,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (b) => {
    setEditingBanner(b);
    setForm({
      name: b.name || "",
      placement: b.placement || "HOME_HERO",
      desktopImage: b.desktopImage || "",
      mobileImage: b.mobileImage || "",
      eyebrow: b.eyebrow || "",
      title: b.title || "",
      highlightText: b.highlightText || "",
      subtitle: b.subtitle || "",
      primaryCtaLabel: b.primaryCtaLabel || "",
      primaryCtaUrl: b.primaryCtaUrl || "",
      secondaryCtaLabel: b.secondaryCtaLabel || "",
      secondaryCtaUrl: b.secondaryCtaUrl || "",
      textPosition: b.textPosition || "left",
      textTheme: b.textTheme || "dark",
      startDate: b.startDate ? new Date(b.startDate).toISOString().slice(0, 16) : "",
      endDate: b.endDate ? new Date(b.endDate).toISOString().slice(0, 16) : "",
      isActive: b.isActive ?? true,
      sortOrder: b.sortOrder || 0,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        sortOrder: Number(form.sortOrder) || 0,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      };

      if (editingBanner) {
        await adminUpdateBanner(editingBanner.id, payload);
      } else {
        await adminCreateBanner(payload);
      }

      setIsModalOpen(false);
      loadBanners();
    } catch (err) {
      alert("Failed to save banner: " + err.message);
    }
  };

  const handleToggleActive = async (banner) => {
    try {
      await adminUpdateBanner(banner.id, { isActive: !banner.isActive });
      loadBanners();
    } catch (err) {
      alert("Failed to toggle banner status: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this banner?")) return;
    try {
      await adminDeleteBanner(id);
      loadBanners();
    } catch (err) {
      alert("Failed to delete banner: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-charcoal/10 pb-4">
        <div>
          <h1 className="font-serif-display text-2xl text-charcoal font-bold">Banners &amp; Visual Hero Media</h1>
          <p className="text-xs text-charcoal-soft mt-1">
            Manage scheduled hero slides, promo banners, and storefront placement images.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterPlacement}
            onChange={(e) => setFilterPlacement(e.target.value)}
            className="rounded-full border border-charcoal/20 bg-white px-4 py-2 text-xs font-semibold text-charcoal focus:border-terracotta focus:outline-none"
          >
            <option value="">All Placements</option>
            {PLACEMENTS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <Button onClick={openCreateModal}>+ Create Banner</Button>
        </div>
      </div>

      {status === "loading" && <LoadingNotice />}
      {status === "error" && <ErrorNotice message={error || "Could not load banners."} />}

      {status === "ready" && (
        <div className="rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
          {banners.length === 0 ? (
            <p className="text-sm text-charcoal-soft italic py-8 text-center">
              No banners found for selected placement. Click "+ Create Banner" to add one.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {banners.map((b) => (
                <div
                  key={b.id}
                  className={`overflow-hidden rounded-2xl border transition flex flex-col justify-between ${
                    b.isActive ? "border-charcoal/15 bg-white shadow-xs" : "border-charcoal/10 bg-gray-50 opacity-60"
                  }`}
                >
                  <div className="relative aspect-video w-full bg-[#FAF6F0] overflow-hidden">
                    {b.desktopImage ? (
                      <img src={b.desktopImage} alt={b.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-charcoal-soft italic">
                        No Image Specified
                      </div>
                    )}
                    <span className="absolute top-3 left-3 rounded-full bg-charcoal/80 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                      {b.placement}
                    </span>
                    {!b.isActive && (
                      <span className="absolute top-3 right-3 rounded-full bg-red-600 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-serif-display text-lg font-bold text-charcoal">{b.name}</h3>
                        <span className="text-xs font-mono text-charcoal-soft">Order: {b.sortOrder}</span>
                      </div>

                      {b.title && <p className="text-sm font-semibold text-terracotta mt-1">{b.title}</p>}
                      {b.subtitle && <p className="text-xs text-charcoal-soft line-clamp-2 mt-1">{b.subtitle}</p>}

                      {(b.startDate || b.endDate) && (
                        <div className="mt-2 text-[11px] text-charcoal-soft bg-[#FAF6F0] rounded-lg p-2 font-mono">
                          {b.startDate && <div>Start: {new Date(b.startDate).toLocaleString()}</div>}
                          {b.endDate && <div>End: {new Date(b.endDate).toLocaleString()}</div>}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-charcoal/10 pt-3 mt-4">
                      <button
                        onClick={() => handleToggleActive(b)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                          b.isActive ? "bg-sage-light text-green-deep" : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {b.isActive ? "Active" : "Disabled"}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(b)}
                          className="text-xs font-semibold border border-charcoal/20 rounded-full px-3.5 py-1.5 text-charcoal hover:bg-[#FAF6F0] transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="text-xs font-semibold text-terracotta hover:underline px-2 py-1.5"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Banner Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4 border border-charcoal/10"
          >
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
              <h3 className="font-serif-display text-xl font-bold text-charcoal">
                {editingBanner ? "Edit Banner" : "Create New Banner"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-xs font-bold text-charcoal-soft hover:text-charcoal"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Internal Banner Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Autumn Brassware Hero"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Placement Placement *</label>
                <select
                  value={form.placement}
                  onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                >
                  {PLACEMENTS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label} ({p.value})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Desktop Image URL *</label>
                <input
                  required
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  value={form.desktopImage}
                  onChange={(e) => setForm((f) => ({ ...f, desktopImage: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Mobile Image URL (Optional)</label>
                <input
                  type="text"
                  placeholder="Fallback to desktop if empty"
                  value={form.mobileImage}
                  onChange={(e) => setForm((f) => ({ ...f, mobileImage: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Eyebrow Tagline</label>
                <input
                  type="text"
                  placeholder="e.g. ARTISANAL HERITAGE"
                  value={form.eyebrow}
                  onChange={(e) => setForm((f) => ({ ...f, eyebrow: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Headline Title</label>
                <input
                  type="text"
                  placeholder="e.g. Sacred Brassware"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Highlight Word (Italic)</label>
                <input
                  type="text"
                  placeholder="e.g. Timeless Craft"
                  value={form.highlightText}
                  onChange={(e) => setForm((f) => ({ ...f, highlightText: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-charcoal-soft">Subtitle Description</label>
              <textarea
                rows={2}
                placeholder="Brief narrative text..."
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                className="w-full rounded-xl border border-charcoal/20 px-4 py-2 text-sm focus:border-terracotta focus:outline-none mt-1"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Primary CTA Button Label</label>
                <input
                  type="text"
                  placeholder="e.g. Explore Collection"
                  value={form.primaryCtaLabel}
                  onChange={(e) => setForm((f) => ({ ...f, primaryCtaLabel: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Primary CTA Link URL</label>
                <input
                  type="text"
                  placeholder="e.g. /shop"
                  value={form.primaryCtaUrl}
                  onChange={(e) => setForm((f) => ({ ...f, primaryCtaUrl: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Start Date (Optional)</label>
                <input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-3 py-2 text-xs focus:border-terracotta focus:outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-charcoal-soft">End Date (Optional)</label>
                <input
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-3 py-2 text-xs focus:border-terracotta focus:outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Sort Order</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-3 py-2 text-xs focus:border-terracotta focus:outline-none mt-1"
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="bannerIsActive"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 text-terracotta rounded border-charcoal/30 focus:ring-terracotta"
                />
                <label htmlFor="bannerIsActive" className="text-xs font-semibold text-charcoal">
                  Active Banner
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-charcoal/10">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full px-5 py-2 text-xs font-semibold text-charcoal-soft hover:text-charcoal"
              >
                Cancel
              </button>
              <Button type="submit">Save Banner</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
