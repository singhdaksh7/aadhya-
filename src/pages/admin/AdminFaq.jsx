import React, { useState, useEffect } from "react";
import {
  adminListFaqCategories,
  adminCreateFaqCategory,
  adminUpdateFaqCategory,
  adminDeleteFaqCategory,
  adminListFaqItems,
  adminCreateFaqItem,
  adminUpdateFaqItem,
  adminDeleteFaqItem
} from "../../lib/api";
import RichTextEditor from "../../components/cms/RichTextEditor";

export default function AdminFaq() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("items"); // "items" | "categories"
  const [error, setError] = useState("");

  // Category Modal State
  const [isCatEditing, setIsCatEditing] = useState(false);
  const [editingCatId, setEditingCatId] = useState(null);
  const [catFormData, setCatFormData] = useState({ name: "", slug: "", sortOrder: 0, isActive: true });

  // Item Modal State
  const [isItemEditing, setIsItemEditing] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemFormData, setItemFormData] = useState({
    categoryId: "",
    question: "",
    answer: "",
    sortOrder: 0,
    isActive: true
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const [catRes, itemRes] = await Promise.all([
        adminListFaqCategories(),
        adminListFaqItems({ limit: 100 })
      ]);
      const loadedCats = catRes.data || catRes.items || catRes || [];
      const loadedItems = itemRes.data || itemRes.items || itemRes || [];
      setCategories(loadedCats);
      setItems(loadedItems);

      if (loadedCats.length > 0 && !itemFormData.categoryId) {
        setItemFormData((prev) => ({ ...prev, categoryId: loadedCats[0].id }));
      }
    } catch (err) {
      setError(err.message || "Failed to load FAQ data");
    } finally {
      setLoading(false);
    }
  };

  // --- Category Handlers ---
  const handleOpenNewCategory = () => {
    setEditingCatId(null);
    setCatFormData({ name: "", slug: "", sortOrder: categories.length + 1, isActive: true });
    setIsCatEditing(true);
  };

  const handleOpenEditCategory = (cat) => {
    setEditingCatId(cat.id);
    setCatFormData({ name: cat.name, slug: cat.slug, sortOrder: cat.sortOrder || 0, isActive: cat.isActive });
    setIsCatEditing(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!catFormData.name) return;
    try {
      setSaving(true);
      setError("");
      const slug = catFormData.slug || catFormData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (editingCatId) {
        await adminUpdateFaqCategory(editingCatId, { ...catFormData, slug });
      } else {
        await adminCreateFaqCategory({ ...catFormData, slug });
      }
      setIsCatEditing(false);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to save FAQ category");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm("Deleting this category will delete all associated FAQ items. Continue?")) return;
    try {
      await adminDeleteFaqCategory(id);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to delete category");
    }
  };

  // --- Item Handlers ---
  const handleOpenNewItem = () => {
    setEditingItemId(null);
    setItemFormData({
      categoryId: categories[0]?.id || "",
      question: "",
      answer: "",
      sortOrder: items.length + 1,
      isActive: true
    });
    setIsItemEditing(true);
  };

  const handleOpenEditItem = (item) => {
    setEditingItemId(item.id);
    setItemFormData({
      categoryId: item.categoryId,
      question: item.question,
      answer: item.answer,
      sortOrder: item.sortOrder || 0,
      isActive: item.isActive
    });
    setIsItemEditing(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemFormData.question || !itemFormData.answer || !itemFormData.categoryId) {
      setError("Category, Question, and Answer are required.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      if (editingItemId) {
        await adminUpdateFaqItem(editingItemId, itemFormData);
      } else {
        await adminCreateFaqItem(itemFormData);
      }
      setIsItemEditing(false);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to save FAQ item");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleItemActive = async (item) => {
    try {
      await adminUpdateFaqItem(item.id, { isActive: !item.isActive });
      loadData();
    } catch (err) {
      setError(err.message || "Failed to toggle status");
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm("Are you sure you want to delete this FAQ item?")) return;
    try {
      await adminDeleteFaqItem(id);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to delete FAQ item");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-charcoal/10 pb-4">
        <div>
          <h1 className="font-serif-display text-2xl sm:text-3xl text-charcoal">FAQ CMS</h1>
          <p className="text-xs text-charcoal-soft mt-1">
            Manage customer help center questions, shipping details, and policy accordions.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleOpenNewCategory}
            className="rounded-xl border border-charcoal/15 bg-white px-3.5 py-2 text-xs font-semibold text-charcoal hover:bg-charcoal/5 transition"
          >
            + New Category
          </button>
          <button
            onClick={handleOpenNewItem}
            className="rounded-xl bg-terracotta px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-terracotta/90 transition"
          >
            + Add FAQ Question
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 text-red-700 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-charcoal/10 gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("items")}
          className={`pb-3 border-b-2 transition ${
            activeTab === "items" ? "border-terracotta text-terracotta" : "border-transparent text-charcoal-soft hover:text-charcoal"
          }`}
        >
          FAQ Questions & Answers ({items.length})
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`pb-3 border-b-2 transition ${
            activeTab === "categories" ? "border-terracotta text-terracotta" : "border-transparent text-charcoal-soft hover:text-charcoal"
          }`}
        >
          FAQ Categories ({categories.length})
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-charcoal-soft animate-pulse">
          Loading FAQ content...
        </div>
      ) : activeTab === "items" ? (
        /* FAQ Items View */
        <div className="bg-white rounded-2xl border border-charcoal/10 overflow-hidden shadow-sm">
          {items.length === 0 ? (
            <div className="p-12 text-center text-xs text-charcoal-soft">
              No FAQ items found. Click "+ Add FAQ Question" to create one.
            </div>
          ) : (
            <div className="divide-y divide-charcoal/10">
              {items.map((item) => {
                const catName = categories.find((c) => c.id === item.categoryId)?.name || "General";
                return (
                  <div key={item.id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-ivory/40 transition">
                    <div className="space-y-1 max-w-2xl">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-charcoal/5 text-charcoal-soft">
                          {catName}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${item.isActive ? "bg-sage-light text-green-deep" : "bg-gray-200 text-gray-700"}`}>
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                        <span className="text-[10px] text-charcoal-soft font-mono">Sort Order: {item.sortOrder}</span>
                      </div>
                      <h3 className="font-semibold text-sm text-charcoal">{item.question}</h3>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleItemActive(item)}
                        className="px-2.5 py-1 rounded-lg border border-charcoal/15 text-[11px] font-medium hover:bg-charcoal/5"
                      >
                        {item.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleOpenEditItem(item)}
                        className="px-2.5 py-1 rounded-lg bg-charcoal/10 text-[11px] font-medium text-charcoal hover:bg-charcoal/20"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 text-[11px] font-medium hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* FAQ Categories View */
        <div className="bg-white rounded-2xl border border-charcoal/10 overflow-hidden shadow-sm">
          {categories.length === 0 ? (
            <div className="p-12 text-center text-xs text-charcoal-soft">
              No categories found. Click "+ New Category" to create one.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-charcoal">
              <thead className="bg-ivory border-b border-charcoal/10 font-semibold uppercase tracking-wider text-[11px] text-charcoal-soft">
                <tr>
                  <th className="px-6 py-3">Category Name</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Sort Order</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/10">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-ivory/50 transition">
                    <td className="px-6 py-4 font-semibold text-charcoal">{cat.name}</td>
                    <td className="px-4 py-4 text-terracotta font-mono text-[11px]">{cat.slug}</td>
                    <td className="px-4 py-4 font-mono text-[11px]">{cat.sortOrder}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${cat.isActive ? "bg-sage-light text-green-deep" : "bg-gray-200 text-gray-700"}`}>
                        {cat.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditCategory(cat)}
                        className="px-2.5 py-1 rounded-lg bg-charcoal/10 text-[11px] font-medium text-charcoal hover:bg-charcoal/20"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 text-[11px] font-medium hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Category Modal */}
      {isCatEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-ivory rounded-2xl shadow-2xl border border-charcoal/10 p-6 space-y-4">
            <h2 className="font-serif-display text-lg text-charcoal">
              {editingCatId ? "Edit FAQ Category" : "New FAQ Category"}
            </h2>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={catFormData.name}
                  onChange={(e) => setCatFormData({ ...catFormData, name: e.target.value })}
                  placeholder="e.g. Shipping & Delivery"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:border-terracotta focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={catFormData.sortOrder}
                  onChange={(e) => setCatFormData({ ...catFormData, sortOrder: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={catFormData.isActive}
                  onChange={(e) => setCatFormData({ ...catFormData, isActive: e.target.checked })}
                  className="rounded accent-terracotta"
                />
                <label className="text-xs font-semibold text-charcoal">Active on storefront</label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCatEditing(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-charcoal/15 text-charcoal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-terracotta text-white"
                >
                  {saving ? "Saving..." : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {isItemEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-2xl bg-ivory rounded-2xl shadow-2xl border border-charcoal/10 p-6 space-y-4 max-h-[90vh] overflow-y-auto my-auto">
            <h2 className="font-serif-display text-lg text-charcoal">
              {editingItemId ? "Edit FAQ Question" : "Add FAQ Question"}
            </h2>
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Category *
                </label>
                <select
                  value={itemFormData.categoryId}
                  onChange={(e) => setItemFormData({ ...itemFormData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Question *
                </label>
                <input
                  type="text"
                  value={itemFormData.question}
                  onChange={(e) => setItemFormData({ ...itemFormData, question: e.target.value })}
                  placeholder="e.g. How long does express shipping take?"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:border-terracotta focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Rich Answer *
                </label>
                <RichTextEditor
                  value={itemFormData.answer}
                  onChange={(html) => setItemFormData({ ...itemFormData, answer: html })}
                  placeholder="Write clear, helpful answer..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={itemFormData.sortOrder}
                    onChange={(e) => setItemFormData({ ...itemFormData, sortOrder: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-charcoal/15 bg-white text-charcoal focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    checked={itemFormData.isActive}
                    onChange={(e) => setItemFormData({ ...itemFormData, isActive: e.target.checked })}
                    className="rounded accent-terracotta"
                  />
                  <label className="text-xs font-semibold text-charcoal">Active publicly</label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsItemEditing(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-charcoal/15 text-charcoal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-terracotta text-white"
                >
                  {saving ? "Saving..." : "Save Question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
