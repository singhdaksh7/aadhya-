import React, { useEffect, useState } from "react";
import {
  adminFetchHomepage,
  adminCreatePageSection,
  adminUpdatePageSection,
  adminDeletePageSection,
  adminDuplicatePageSection,
  adminReorderPageSections,
  adminPublishHomepage,
} from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";

const SECTION_TYPE_LABELS = {
  HERO: "Hero Banner Carousel",
  PROMO_TICKER: "Promo / Coupon Ticker",
  CATEGORY_CIRCLES: "Circular Category Bar",
  TRUST_BADGES: "Trust & Service Strip",
  NEW_ARRIVALS: "New Arrivals Grid",
  MULTI_BANNER: "2-Up Promo Banners",
  BEST_SELLERS: "Best Sellers Grid",
  COLLECTION: "Featured Collection Banner",
  SHOP_THE_LOOK: "Shop the Look / Lifestyle Edit",
  BOOKS: "Bookshelf Section",
  IMAGE_TEXT: "Editorial Brand Story",
  NEWSLETTER: "Newsletter Circle Subscription",
  RICH_TEXT: "Rich Text Banner",
  CTA: "Call-to-Action Block",
  FAQ_PREVIEW: "FAQ Preview",
  BLOG_PREVIEW: "Blog Spotlights",
};

export default function AdminHomepageBuilder() {
  const [page, setPage] = useState(null);
  const [sections, setSections] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [newSectionType, setNewSectionType] = useState("NEW_ARRIVALS");
  const [newSectionName, setNewSectionName] = useState("");

  // Edit settings form state
  const [editName, setEditName] = useState("");
  const [editIsEnabled, setEditIsEnabled] = useState(true);
  const [editSettingsJson, setEditSettingsJson] = useState("{}");
  const [editContentJson, setEditContentJson] = useState("{}");
  const [jsonError, setJsonError] = useState("");

  const loadHomepage = async () => {
    setStatus("loading");
    try {
      const res = await adminFetchHomepage();
      const pageData = res.page || res.data?.page || res;
      const sectionData = res.sections || res.data?.sections || pageData.sections || [];
      setPage(pageData);
      setSections(sectionData);
      setStatus("ready");
    } catch (err) {
      console.error("Error loading admin homepage:", err);
      setStatus("error");
      setError(err.message || "Failed to load homepage builder.");
    }
  };

  useEffect(() => {
    loadHomepage();
  }, []);

  const handlePublish = async () => {
    try {
      await adminPublishHomepage();
      alert("Homepage published successfully!");
      loadHomepage();
    } catch (err) {
      alert("Publish failed: " + err.message);
    }
  };

  const handleAddSection = async (e) => {
    e.preventDefault();
    try {
      const name = newSectionName.trim() || SECTION_TYPE_LABELS[newSectionType] || newSectionType;
      await adminCreatePageSection({
        type: newSectionType,
        name,
        settings: {},
        content: {},
        isEnabled: true,
        sortOrder: sections.length * 10,
      });
      setIsAddModalOpen(false);
      setNewSectionName("");
      loadHomepage();
    } catch (err) {
      alert("Failed to add section: " + err.message);
    }
  };

  const handleToggleEnable = async (sec) => {
    try {
      await adminUpdatePageSection(sec.id, { isEnabled: !sec.isEnabled });
      loadHomepage();
    } catch (err) {
      alert("Failed to update section state: " + err.message);
    }
  };

  const handleMove = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const updated = [...sections];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const sectionIds = updated.map((s) => s.id);
    setSections(updated);

    try {
      await adminReorderPageSections(sectionIds);
    } catch (err) {
      alert("Failed to save section order: " + err.message);
      loadHomepage();
    }
  };

  const handleDuplicate = async (id) => {
    try {
      await adminDuplicatePageSection(id);
      loadHomepage();
    } catch (err) {
      alert("Failed to duplicate section: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to remove this section from the homepage?")) return;
    try {
      await adminDeletePageSection(id);
      loadHomepage();
    } catch (err) {
      alert("Failed to delete section: " + err.message);
    }
  };

  const startEdit = (sec) => {
    setEditingSection(sec);
    setEditName(sec.name || "");
    setEditIsEnabled(sec.isEnabled);
    setEditSettingsJson(JSON.stringify(sec.settings || {}, null, 2));
    setEditContentJson(JSON.stringify(sec.content || {}, null, 2));
    setJsonError("");
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setJsonError("");
    let parsedSettings = {};
    let parsedContent = {};
    try {
      parsedSettings = editSettingsJson ? JSON.parse(editSettingsJson) : {};
    } catch {
      setJsonError("Invalid JSON format in Section Settings.");
      return;
    }
    try {
      parsedContent = editContentJson ? JSON.parse(editContentJson) : {};
    } catch {
      setJsonError("Invalid JSON format in Section Content.");
      return;
    }

    try {
      await adminUpdatePageSection(editingSection.id, {
        name: editName,
        isEnabled: editIsEnabled,
        settings: parsedSettings,
        content: parsedContent,
      });
      setEditingSection(null);
      loadHomepage();
    } catch (err) {
      setJsonError("Failed to save changes: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-charcoal/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif-display text-2xl text-charcoal font-bold">Homepage Builder</h1>
            <span className="rounded-full bg-terracotta/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-terracotta">
              {page?.status || "DRAFT"}
            </span>
          </div>
          <p className="text-xs text-charcoal-soft mt-1">
            Reorder, enable/disable, and configure sections for the public storefront homepage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-charcoal/20 px-5 py-2.5 text-xs font-semibold text-charcoal hover:bg-[#FAF6F0] transition"
          >
            Preview Storefront
          </a>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="rounded-full border border-terracotta text-terracotta hover:bg-terracotta hover:text-white px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition"
          >
            + Add Section
          </button>
          <Button onClick={handlePublish}>Publish Homepage</Button>
        </div>
      </div>

      {status === "loading" && <LoadingNotice />}
      {status === "error" && <ErrorNotice message={error || "Could not load homepage sections."} />}

      {status === "ready" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif-display text-lg text-charcoal font-bold">
                Homepage Layout Flow ({sections.length} Sections)
              </h2>
              <span className="text-xs text-charcoal-soft italic">
                Changes saved as draft until published.
              </span>
            </div>

            {sections.length === 0 ? (
              <p className="text-sm text-charcoal-soft italic py-8 text-center">
                No sections defined for homepage. Click "+ Add Section" to build layout.
              </p>
            ) : (
              <div className="space-y-3">
                {sections.map((sec, index) => (
                  <div
                    key={sec.id}
                    className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 transition ${
                      sec.isEnabled
                        ? "border-charcoal/15 bg-white shadow-xs"
                        : "border-charcoal/10 bg-gray-50 opacity-60"
                    }`}
                  >
                    {/* Left details */}
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <button
                          disabled={index === 0}
                          onClick={() => handleMove(index, -1)}
                          className="text-xs text-charcoal hover:text-terracotta disabled:opacity-20 px-1"
                          title="Move Up"
                        >
                          ▲
                        </button>
                        <button
                          disabled={index === sections.length - 1}
                          onClick={() => handleMove(index, 1)}
                          className="text-xs text-charcoal hover:text-terracotta disabled:opacity-20 px-1"
                          title="Move Down"
                        >
                          ▼
                        </button>
                      </div>

                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-[#FAF6F0] text-xs font-bold text-charcoal font-mono">
                        {index + 1}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-serif-display text-base text-charcoal font-bold">
                            {sec.name}
                          </h3>
                          <span className="text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5 bg-sage-light text-green-deep">
                            {sec.type}
                          </span>
                          {!sec.isEnabled && (
                            <span className="text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5 bg-gray-200 text-gray-700">
                              Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-charcoal-soft mt-0.5">
                          {SECTION_TYPE_LABELS[sec.type] || sec.type}
                        </p>
                      </div>
                    </div>

                    {/* Right action controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleEnable(sec)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                          sec.isEnabled
                            ? "bg-sage-light text-green-deep hover:bg-sage/20"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {sec.isEnabled ? "Enabled" : "Disabled"}
                      </button>

                      <button
                        onClick={() => startEdit(sec)}
                        className="text-xs font-semibold border border-charcoal/20 rounded-full px-3 py-1.5 text-charcoal hover:bg-[#FAF6F0] transition"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleDuplicate(sec.id)}
                        className="text-xs font-semibold border border-charcoal/20 rounded-full px-3 py-1.5 text-charcoal hover:bg-[#FAF6F0] transition"
                      >
                        Duplicate
                      </button>

                      <button
                        onClick={() => handleDelete(sec.id)}
                        className="text-xs font-semibold text-terracotta hover:underline px-2 py-1.5"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Section Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 p-4">
          <form
            onSubmit={handleAddSection}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4 border border-charcoal/10"
          >
            <h3 className="font-serif-display text-xl font-bold text-charcoal">Add Homepage Section</h3>

            <div>
              <label className="text-xs font-semibold text-charcoal-soft">Section Type *</label>
              <select
                value={newSectionType}
                onChange={(e) => setNewSectionType(e.target.value)}
                className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
              >
                {Object.entries(SECTION_TYPE_LABELS).map(([type, label]) => (
                  <option key={type} value={type}>
                    {label} ({type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-charcoal-soft">Display Title (Optional)</label>
              <input
                type="text"
                placeholder="Custom internal or storefront section title"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-full px-5 py-2 text-xs font-semibold text-charcoal-soft hover:text-charcoal"
              >
                Cancel
              </button>
              <Button type="submit">Add Section</Button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Section Modal */}
      {editingSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4 border border-charcoal/10"
          >
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
              <h3 className="font-serif-display text-xl font-bold text-charcoal">
                Edit Section: {editingSection.type}
              </h3>
              <button
                type="button"
                onClick={() => setEditingSection(null)}
                className="text-xs font-bold text-charcoal-soft hover:text-charcoal"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Section Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="editIsEnabled"
                  checked={editIsEnabled}
                  onChange={(e) => setEditIsEnabled(e.target.checked)}
                  className="h-4 w-4 text-terracotta rounded border-charcoal/30 focus:ring-terracotta"
                />
                <label htmlFor="editIsEnabled" className="text-xs font-semibold text-charcoal">
                  Section Enabled on Storefront
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-charcoal-soft">
                Settings JSON (Presentation &amp; Layout Controls)
              </label>
              <textarea
                rows={6}
                value={editSettingsJson}
                onChange={(e) => setEditSettingsJson(e.target.value)}
                className="w-full font-mono text-xs rounded-xl border border-charcoal/20 p-3 focus:border-terracotta focus:outline-none mt-1 bg-[#FAF6F0]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-charcoal-soft">
                Content JSON (Headings, Subtitles, CTA Labels &amp; Links)
              </label>
              <textarea
                rows={6}
                value={editContentJson}
                onChange={(e) => setEditContentJson(e.target.value)}
                className="w-full font-mono text-xs rounded-xl border border-charcoal/20 p-3 focus:border-terracotta focus:outline-none mt-1 bg-[#FAF6F0]"
              />
            </div>

            {jsonError && <p className="text-xs text-terracotta font-semibold">{jsonError}</p>}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-charcoal/10">
              <button
                type="button"
                onClick={() => setEditingSection(null)}
                className="rounded-full px-5 py-2 text-xs font-semibold text-charcoal-soft hover:text-charcoal"
              >
                Cancel
              </button>
              <Button type="submit">Save Section Changes</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
