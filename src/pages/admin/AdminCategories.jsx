import { useEffect, useState } from "react";
import { adminListCategories, adminCreateCategory, adminUpdateCategory, adminDeleteCategory } from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";

const emptyForm = { id: null, name: "", slug: "", description: "", parentId: "", sortOrder: "0", isActive: true };

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
      sortOrder: String(c.sortOrder),
      isActive: c.isActive,
    });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const payload = {
      name: form.name,
      slug: form.slug || undefined,
      description: form.description || null,
      parentId: form.parentId || null,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
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
      <h1 className="font-serif-display text-2xl text-charcoal">Categories</h1>

      <form onSubmit={onSubmit} className="mt-6 max-w-lg space-y-4 rounded-2xl border border-charcoal/10 p-5">
        <p className="text-sm font-medium text-charcoal">{form.id ? "Edit Category" : "New Category"}</p>
        <input
          required
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className={inputCls}
        />
        <input
          placeholder="Slug (optional)"
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          className={inputCls}
        />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className={inputCls}
        />
        <select
          value={form.parentId}
          onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
          className={inputCls}
        >
          <option value="">No parent (top-level)</option>
          {categories
            .filter((c) => c.id !== form.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
        <input
          type="number"
          placeholder="Sort order"
          value={form.sortOrder}
          onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
          className={inputCls}
        />
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          Active
        </label>

        {error && <p className="text-sm text-terracotta">{error}</p>}

        <div className="flex gap-3">
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
