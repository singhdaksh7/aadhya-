import { useEffect, useState } from "react";
import { adminListCategories, adminCreateCategory, adminUpdateCategory, adminDeleteCategory } from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";

const emptyForm = {
  id: null,
  name: "",
  slug: "",
  description: "",
  parentId: "",
  image: "",
  icon: "",
  desktopBanner: "",
  mobileBanner: "",
  isFeatured: false,
  sortOrder: "0",
  isActive: true,
  seoTitle: "",
  seoDescription: "",
};

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState("loading");
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    setStatus("loading");
    adminListCategories()
      .then((res) => {
        setCategories(res.data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [reloadToken]);

  const startEdit = (c) =>
    setForm({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description || "",
      parentId: c.parentId || "",
      image: c.image || "",
      icon: c.icon || "",
      desktopBanner: c.desktopBanner || "",
      mobileBanner: c.mobileBanner || "",
      isFeatured: c.isFeatured || false,
      sortOrder: String(c.sortOrder),
      isActive: c.isActive,
      seoTitle: c.seoTitle || "",
      seoDescription: c.seoDescription || "",
    });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const payload = {
      name: form.name,
      slug: form.slug || undefined,
      description: form.description || null,
      parentId: form.parentId || null,
      image: form.image || null,
      icon: form.icon || null,
      desktopBanner: form.desktopBanner || null,
      mobileBanner: form.mobileBanner || null,
      isFeatured: form.isFeatured,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
      seoTitle: form.seoTitle || null,
      seoDescription: form.seoDescription || null,
    };
    try {
      if (form.id) await adminUpdateCategory(form.id, payload);
      else await adminCreateCategory(payload);
      setForm(emptyForm);
      setReloadToken((t) => t + 1);
    } catch (err) {
      setError(err.message || "Could not save this category.");
    }
  };

  const toggleActive = async (c) => {
    await adminUpdateCategory(c.id, { isActive: !c.isActive });
    setReloadToken((t) => t + 1);
  };

  const remove = async (c) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try {
      await adminDeleteCategory(c.id);
      setReloadToken((t) => t + 1);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <h1 className="font-serif-display text-2xl text-charcoal">Category Hierarchy & Subcategories</h1>

      <form onSubmit={onSubmit} className="mt-6 max-w-2xl space-y-4 rounded-2xl border border-charcoal/10 p-6 bg-white">
        <p className="text-base font-semibold text-charcoal">{form.id ? "Edit Category" : "New Category"}</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-charcoal-soft">Category Name *</label>
            <input
              required
              placeholder="e.g. Wall Decor"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-charcoal-soft">Slug (Optional)</label>
            <input
              placeholder="wall-decor"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-charcoal-soft">Parent Category (For Subcategories)</label>
          <select
            value={form.parentId}
            onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
            className={inputCls}
          >
            <option value="">No parent (Top-Level Category)</option>
            {categories
              .filter((c) => c.id !== form.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parentId ? "  └ " : ""}{c.name}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-charcoal-soft">Description</label>
          <textarea
            rows={2}
            placeholder="Brief category summary"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-charcoal-soft">Image URL</label>
            <input
              placeholder="https://..."
              value={form.image}
              onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-charcoal-soft">Desktop Banner URL</label>
            <input
              placeholder="https://..."
              value={form.desktopBanner}
              onChange={(e) => setForm((f) => ({ ...f, desktopBanner: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-charcoal-soft">Sort Order</label>
            <input
              type="number"
              placeholder="0"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="flex items-center gap-6 pt-5">
            <label className="flex items-center gap-2 text-sm text-charcoal font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
                className="accent-terracotta"
              />
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm text-charcoal font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="accent-terracotta"
              />
              Active
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-terracotta font-medium">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button>{form.id ? "Save Changes" : "Create Category"}</Button>
          {form.id && (
            <Button type="button" variant="secondary" onClick={() => setForm(emptyForm)}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-charcoal/10">
        {status === "loading" && <LoadingNotice />}
        {status === "error" && <ErrorNotice message="Unable to load categories." />}
        {status === "ready" && (
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-ivory-dark text-xs uppercase tracking-wide text-charcoal-soft">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/10">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-charcoal">{c.name}</td>
                  <td className="px-4 py-3 text-charcoal-soft">{c.slug}</td>
                  <td className="px-4 py-3 text-charcoal-soft">
                    {categories.find((p) => p.id === c.parentId)?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-charcoal-soft">{c._count?.products ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={c.isActive ? "text-green-deep" : "text-charcoal-soft"}>
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 whitespace-nowrap text-xs">
                      <button
                        onClick={() => startEdit(c)}
                        className="rounded-full border border-charcoal/20 bg-white px-3 py-1 font-medium text-charcoal transition hover:border-terracotta hover:text-terracotta"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(c)}
                        className="rounded-full border border-sage/40 bg-sage-light/50 px-3 py-1 font-medium text-green-deep transition hover:bg-sage-light"
                      >
                        {c.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => remove(c)}
                        className="rounded-full border border-terracotta/20 bg-terracotta/5 px-3 py-1 font-medium text-terracotta transition hover:bg-terracotta hover:text-ivory"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-charcoal/40 focus:outline-none";
