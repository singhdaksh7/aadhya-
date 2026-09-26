import React, { useEffect, useState } from "react";
import {
  adminListMenus,
  adminCreateMenu,
  adminAddMenuItem,
  adminDeleteMenuItem,
  adminListCategories,
  adminListCollections,
} from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";

export default function AdminNavigation() {
  const [categories, setCategories] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  // New item form state
  const [itemForm, setItemForm] = useState({
    title: "",
    type: "CUSTOM",
    url: "",
    targetId: "",
    sortOrder: "0",
    badgeText: "",
  });

  const loadData = async () => {
    setStatus("loading");
    try {
      const [menusRes, catsRes, colsRes] = await Promise.all([
        adminListMenus(),
        adminListCategories(),
        adminListCollections(),
      ]);
      setCategories(catsRes.data || []);
      setCollections(colsRes.data || []);
      
      const headerMenu = (menusRes.data || []).find((m) => m.code === "HEADER_MAIN") || menusRes.data?.[0];
      setSelectedMenu(headerMenu || null);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateHeaderMenu = async () => {
    try {
      await adminCreateMenu({ code: "HEADER_MAIN", title: "Main Header Menu" });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!selectedMenu) return;
    setError(null);
    try {
      let finalUrl = itemForm.url;
      if (itemForm.type === "CATEGORY") {
        const cat = categories.find((c) => c.slug === itemForm.targetId || c.id === itemForm.targetId);
        finalUrl = cat ? `/shop/category/${cat.slug}` : `/shop`;
      } else if (itemForm.type === "COLLECTION") {
        const col = collections.find((c) => c.slug === itemForm.targetId || c.id === itemForm.targetId);
        finalUrl = col ? `/collections/${col.slug}` : `/collections`;
      }

      await adminAddMenuItem(selectedMenu.id, {
        title: itemForm.title,
        type: itemForm.type,
        url: finalUrl,
        targetId: itemForm.targetId || null,
        sortOrder: Number(itemForm.sortOrder) || 0,
        badgeText: itemForm.badgeText || null,
      });

      setItemForm({ title: "", type: "CUSTOM", url: "", targetId: "", sortOrder: "0", badgeText: "" });
      loadData();
    } catch (err) {
      setError(err.message || "Failed to add menu item");
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm("Are you sure you want to remove this navigation item?")) return;
    try {
      await adminDeleteMenuItem(itemId);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-2xl text-charcoal font-bold">Header Navigation & Mega Menu</h1>
          <p className="text-xs text-charcoal-soft mt-1">Control public navbar links, categories, collections, and custom storefront URLs.</p>
        </div>
        {!selectedMenu && (
          <Button onClick={handleCreateHeaderMenu}>Initialize Default Header Menu</Button>
        )}
      </div>

      {status === "loading" && <LoadingNotice />}
      {status === "error" && <ErrorNotice message="Could not load navigation settings." />}

      {status === "ready" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Menu Items List */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs">
              <h2 className="font-serif-display text-lg text-charcoal font-bold mb-4">Active Header Menu Items</h2>
              {(!selectedMenu || !selectedMenu.items || selectedMenu.items.length === 0) ? (
                <p className="text-sm text-charcoal-soft italic py-4">No custom menu items configured yet. Default storefront navigation links are active.</p>
              ) : (
                <div className="space-y-2">
                  {selectedMenu.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl border border-charcoal/10 p-3.5 bg-[#FAF6F0] hover:bg-white transition"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-charcoal">{item.title}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 bg-terracotta/10 text-terracotta">
                            {item.type}
                          </span>
                          {item.badgeText && (
                            <span className="text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 bg-sage-light text-green-deep">
                              {item.badgeText}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-charcoal-soft font-mono">{item.url || "—"}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-xs font-semibold text-terracotta hover:underline px-2 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Add Menu Item Form */}
          <div className="lg:col-span-5">
            <form onSubmit={handleAddItem} className="rounded-2xl border border-charcoal/10 bg-white p-6 space-y-4 shadow-xs">
              <h3 className="font-serif-display text-base text-charcoal font-bold">Add Navigation Link</h3>

              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Link Label *</label>
                <input
                  required
                  placeholder="e.g. Wall Art & Decor"
                  value={itemForm.title}
                  onChange={(e) => setItemForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Link Type</label>
                <select
                  value={itemForm.type}
                  onChange={(e) => setItemForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                >
                  <option value="CUSTOM">Custom URL</option>
                  <option value="CATEGORY">Category Catalog</option>
                  <option value="COLLECTION">Collection Page</option>
                </select>
              </div>

              {itemForm.type === "CATEGORY" && (
                <div>
                  <label className="text-xs font-semibold text-charcoal-soft">Select Category</label>
                  <select
                    value={itemForm.targetId}
                    onChange={(e) => {
                      const slug = e.target.value;
                      const cat = categories.find((c) => c.slug === slug);
                      setItemForm((f) => ({
                        ...f,
                        targetId: slug,
                        title: f.title || cat?.name || "",
                      }));
                    }}
                    className="w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                  >
                    <option value="">-- Choose Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {itemForm.type === "COLLECTION" && (
                <div>
                  <label className="text-xs font-semibold text-charcoal-soft">Select Collection</label>
                  <select
                    value={itemForm.targetId}
                    onChange={(e) => {
                      const slug = e.target.value;
                      const col = collections.find((c) => c.slug === slug);
                      setItemForm((f) => ({
                        ...f,
                        targetId: slug,
                        title: f.title || col?.name || "",
                      }));
                    }}
                    className="w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                  >
                    <option value="">-- Choose Collection --</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {itemForm.type === "CUSTOM" && (
                <div>
                  <label className="text-xs font-semibold text-charcoal-soft">URL Path</label>
                  <input
                    placeholder="/shop or /about"
                    value={itemForm.url}
                    onChange={(e) => setItemForm((f) => ({ ...f, url: e.target.value }))}
                    className="w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-charcoal-soft">Sort Order</label>
                  <input
                    type="number"
                    value={itemForm.sortOrder}
                    onChange={(e) => setItemForm((f) => ({ ...f, sortOrder: e.target.value }))}
                    className="w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-charcoal-soft">Badge Tag (Optional)</label>
                  <input
                    placeholder="NEW / HOT"
                    value={itemForm.badgeText}
                    onChange={(e) => setItemForm((f) => ({ ...f, badgeText: e.target.value }))}
                    className="w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                  />
                </div>
              </div>

              {error && <p className="text-xs text-terracotta font-medium">{error}</p>}

              <Button className="w-full mt-2">Add Link to Menu</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
