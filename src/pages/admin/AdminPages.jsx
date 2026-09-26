import React, { useState, useEffect } from "react";
import {
  adminListPages,
  adminCreatePage,
  adminUpdatePage,
  adminDeletePage,
  adminPublishPage,
  resolveProductImageUrl
} from "../../lib/api";
import RichTextEditor from "../../components/cms/RichTextEditor";
import MediaPicker from "../../components/cms/MediaPicker";

export default function AdminPages() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [error, setError] = useState("");

  // Editor Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    pageType: "STANDARD",
    status: "DRAFT",
    featuredImage: "",
    content: "",
    excerpt: "",
    seoTitle: "",
    seoDescription: ""
  });
  const [saving, setSaving] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  useEffect(() => {
    loadPages();
  }, [search, filterType, filterStatus]);

  const loadPages = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await adminListPages({ search, pageType: filterType, status: filterStatus });
      setPages(res.items || res.data || []);
    } catch (err) {
      setError(err.message || "Failed to load pages");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({
      name: "",
      slug: "",
      pageType: "STANDARD",
      status: "DRAFT",
      featuredImage: "",
      content: "",
      excerpt: "",
      seoTitle: "",
      seoDescription: ""
    });
    setIsEditing(true);
  };

  const handleOpenEdit = (page) => {
    setEditingId(page.id);
    setFormData({
      name: page.name || "",
      slug: page.slug || "",
      pageType: page.pageType || "STANDARD",
      status: page.status || "DRAFT",
      featuredImage: page.featuredImage || "",
      content: page.content || "",
      excerpt: page.excerpt || "",
      seoTitle: page.seoTitle || "",
      seoDescription: page.seoDescription || ""
    });
    setIsEditing(true);
  };

  const handleDuplicate = (page) => {
    setEditingId(null);
    setFormData({
      name: `${page.name} (Copy)`,
      slug: `${page.slug}-copy`,
      pageType: page.pageType || "STANDARD",
      status: "DRAFT",
      featuredImage: page.featuredImage || "",
      content: page.content || "",
      excerpt: page.excerpt || "",
      seoTitle: page.seoTitle || "",
      seoDescription: page.seoDescription || ""
    });
    setIsEditing(true);
  };

  const handleTitleChange = (e) => {
    const name = e.target.value;
    const generatedSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setFormData((prev) => ({
      ...prev,
      name,
      slug: editingId ? prev.slug : generatedSlug
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.slug) {
      setError("Name and slug are required.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      if (editingId) {
        await adminUpdatePage(editingId, formData);
      } else {
        await adminCreatePage(formData);
      }
      setIsEditing(false);
      loadPages();
    } catch (err) {
      setError(err.message || "Failed to save page");
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToggle = async (page) => {
    try {
      const nextStatus = page.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
      await adminPublishPage(page.id, nextStatus);
      loadPages();
    } catch (err) {
      setError(err.message || "Failed to update publish state");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this CMS page?")) return;
    try {
      await adminDeletePage(id);
      loadPages();
    } catch (err) {
      setError(err.message || "Failed to delete page");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-charcoal/10 pb-4">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl text-charcoal">CMS Pages</h1>
          <p className="text-xs text-charcoal-soft mt-1">
            Manage custom storefront pages, policy documents, and dynamic layouts.
          </p>
        </div>
        <button
          onClick={handleOpenNew}
          className="rounded-xl bg-terracotta px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-terracotta/90 transition"
        >
          + Create New Page
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-2xl border border-charcoal/10">
        <input
          type="text"
          placeholder="Search by title or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:border-terracotta focus:outline-none"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
        >
          <option value="">All Page Types</option>
          <option value="STANDARD">STANDARD</option>
          <option value="LANDING">LANDING</option>
          <option value="HOME">HOME</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="PUBLISHED">PUBLISHED</option>
          <option value="DRAFT">DRAFT</option>
        </select>
      </div>

      {/* Pages Table / List */}
      <div className="bg-white rounded-2xl border border-charcoal/10 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-xs text-charcoal-soft animate-pulse">
            Loading CMS pages...
          </div>
        ) : pages.length === 0 ? (
          <div className="p-12 text-center text-xs text-charcoal-soft">
            No CMS pages found. Click "+ Create New Page" to add one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-charcoal">
              <thead className="bg-ivory border-b border-charcoal/10 font-semibold uppercase tracking-wider text-[11px] text-charcoal-soft">
                <tr>
                  <th className="px-6 py-3">Title & Slug</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Updated</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/10">
                {pages.map((p) => (
                  <tr key={p.id} className="hover:bg-ivory/50 transition">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-charcoal">{p.name}</p>
                      <p className="text-[11px] text-terracotta font-mono mt-0.5">/pages/{p.slug}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold bg-charcoal/5 text-charcoal">
                        {p.pageType}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                          p.status === "PUBLISHED" ? "bg-sage-light text-green-deep" : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-charcoal-soft text-[11px]">
                      {new Date(p.updatedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => window.open(`/pages/${p.slug}`, "_blank")}
                        className="px-2.5 py-1 rounded-lg border border-charcoal/15 text-[11px] font-medium hover:bg-charcoal/5"
                        title="Preview Public Page"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => handlePublishToggle(p)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                          p.status === "PUBLISHED" ? "border border-yellow-600 text-yellow-700 hover:bg-yellow-50" : "bg-sage text-white hover:bg-sage/90"
                        }`}
                      >
                        {p.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="px-2.5 py-1 rounded-lg bg-charcoal/10 text-[11px] font-medium text-charcoal hover:bg-charcoal/20"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(p)}
                        className="px-2.5 py-1 rounded-lg border border-charcoal/15 text-[11px] font-medium hover:bg-charcoal/5"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 text-[11px] font-medium hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Page Form Modal / Drawer */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-4xl bg-ivory rounded-2xl shadow-2xl border border-charcoal/10 p-6 space-y-6 max-h-[90vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
              <h2 className="font-serif-display text-xl text-charcoal">
                {editingId ? "Edit CMS Page" : "Create New CMS Page"}
              </h2>
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs font-semibold text-charcoal-soft hover:text-charcoal"
              >
                Close ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                    Page Name / Title *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={handleTitleChange}
                    placeholder="e.g. Shipping & Delivery Policy"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:border-terracotta focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })}
                    placeholder="e.g. shipping-policy"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal font-mono focus:border-terracotta focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                    Page Type
                  </label>
                  <select
                    value={formData.pageType}
                    onChange={(e) => setFormData({ ...formData, pageType: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
                  >
                    <option value="STANDARD">STANDARD (Simple Rich Text)</option>
                    <option value="LANDING">LANDING (Section Builder)</option>
                    <option value="HOME">HOME</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                    Publish Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
                  >
                    <option value="DRAFT">DRAFT (Hidden from public)</option>
                    <option value="PUBLISHED">PUBLISHED (Live on storefront)</option>
                  </select>
                </div>
              </div>

              {/* Featured Image */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Featured Header Image (Optional)
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={formData.featuredImage}
                    onChange={(e) => setFormData({ ...formData, featuredImage: e.target.value })}
                    placeholder="https://... or select from Media Library"
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMediaPicker(true)}
                    className="px-3 py-2 text-xs font-semibold rounded-xl border border-charcoal/15 bg-white hover:bg-charcoal/5"
                  >
                    Select Media
                  </button>
                </div>
                {formData.featuredImage && (
                  <div className="mt-2 w-32 h-20 rounded-xl overflow-hidden border border-charcoal/10 bg-white">
                    <img
                      src={resolveProductImageUrl(formData.featuredImage)}
                      alt="Featured Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Page Body Content */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Rich Text Content
                </label>
                <RichTextEditor
                  value={formData.content}
                  onChange={(html) => setFormData({ ...formData, content: html })}
                  placeholder="Compose page content using formatted headings, typography, lists, images..."
                />
              </div>

              {/* SEO Title & Description */}
              <div className="border-t border-charcoal/10 pt-4 space-y-4">
                <p className="font-serif-display text-sm text-charcoal">SEO & Search Optimization</p>
                <div>
                  <label className="block text-[11px] font-semibold text-charcoal-soft mb-1">SEO Title</label>
                  <input
                    type="text"
                    value={formData.seoTitle}
                    onChange={(e) => setFormData({ ...formData, seoTitle: e.target.value })}
                    placeholder="Title for browser tab and search engines"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-charcoal-soft mb-1">SEO Description</label>
                  <textarea
                    rows={2}
                    value={formData.seoDescription}
                    onChange={(e) => setFormData({ ...formData, seoDescription: e.target.value })}
                    placeholder="Summary for search result snippet"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-charcoal/10 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-charcoal/15 text-charcoal hover:bg-charcoal/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 text-xs font-semibold rounded-xl bg-terracotta text-white hover:bg-terracotta/90 transition shadow-sm disabled:opacity-50"
                >
                  {saving ? "Saving Page..." : "Save Page"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Media Picker Modal */}
      <MediaPicker
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={(asset) => {
          setFormData((prev) => ({ ...prev, featuredImage: asset.url }));
        }}
        title="Select Featured Page Image"
      />
    </div>
  );
}
