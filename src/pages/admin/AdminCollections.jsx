import { useEffect, useState } from "react";
import {
  adminListCollections,
  adminCreateCollection,
  adminUpdateCollection,
  adminSetCollectionProducts,
  adminDeleteCollection,
  adminListProducts,
} from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";

const COLLECTION_TYPES = [
  { value: "MANUAL", label: "Manual Selection" },
  { value: "CATEGORY", label: "Category Based" },
  { value: "TAG", label: "Tag Based" },
  { value: "FEATURED", label: "Featured Products" },
  { value: "BEST_SELLER", label: "Best Sellers" },
  { value: "NEW_ARRIVAL", label: "New Arrivals" },
  { value: "TRENDING", label: "Trending Products" },
  { value: "PRICE_RANGE", label: "Price Range" },
];

const emptyForm = {
  id: null,
  name: "",
  slug: "",
  description: "",
  image: "",
  type: "MANUAL",
  ruleCategoryId: "",
  ruleTag: "",
  ruleMinPrice: "",
  ruleMaxPrice: "",
  sortOrder: "0",
  isActive: true,
  isFeatured: false,
};

export default function AdminCollections() {
  const [collections, setCollections] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState("loading");
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [assigning, setAssigning] = useState(null);

  useEffect(() => {
    setStatus("loading");
    Promise.all([
      adminListCollections(),
      adminListProducts({ limit: 100 }),
      import("../../lib/api").then((m) => m.adminListCategories()),
    ])
      .then(([colRes, prodRes, catRes]) => {
        setCollections(colRes.data);
        setProducts(prodRes.data);
        setCategories(catRes.data.filter((c) => c.isActive));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [reloadToken]);

  const startEdit = (c) => {
    const rc = c.ruleConfig || {};
    setForm({
      id: c.id,
      name: c.name || c.title || "",
      slug: c.slug,
      description: c.description || "",
      image: c.image || c.heroImage || "",
      type: c.type || "MANUAL",
      ruleCategoryId: rc.categoryId || "",
      ruleTag: rc.tag || "",
      ruleMinPrice: rc.minPrice != null ? String(rc.minPrice) : "",
      ruleMaxPrice: rc.maxPrice != null ? String(rc.maxPrice) : "",
      sortOrder: String(c.sortOrder ?? 0),
      isActive: c.isActive,
      isFeatured: c.isFeatured || false,
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    let ruleConfig = null;
    if (form.type === "CATEGORY") {
      ruleConfig = { categoryId: form.ruleCategoryId };
    } else if (form.type === "TAG") {
      ruleConfig = { tag: form.ruleTag };
    } else if (form.type === "PRICE_RANGE") {
      ruleConfig = {
        minPrice: form.ruleMinPrice !== "" ? Number(form.ruleMinPrice) : undefined,
        maxPrice: form.ruleMaxPrice !== "" ? Number(form.ruleMaxPrice) : undefined,
      };
    }

    const payload = {
      name: form.name,
      slug: form.slug || undefined,
      description: form.description || null,
      image: form.image || null,
      type: form.type,
      ruleConfig,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
      isFeatured: form.isFeatured,
    };

    try {
      if (form.id) await adminUpdateCollection(form.id, payload);
      else await adminCreateCollection(payload);
      setForm(emptyForm);
      setReloadToken((t) => t + 1);
    } catch (err) {
      setError(err.message || "Could not save this collection.");
    }
  };

  const remove = async (c) => {
    if (!confirm(`Delete collection "${c.name || c.title}"?`)) return;
    try {
      await adminDeleteCollection(c.id);
      setReloadToken((t) => t + 1);
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleProduct = async (collection, productId) => {
    const currentIds = (collection.products || []).map((cp) => cp.productId);
    const nextIds = currentIds.includes(productId)
      ? currentIds.filter((id) => id !== productId)
      : [...currentIds, productId];
    const res = await adminSetCollectionProducts(collection.id, nextIds);
    setAssigning(res.data);
    setReloadToken((t) => t + 1);
  };

  return (
    <div>
      <h1 className="font-serif-display text-2xl text-charcoal">Collections</h1>

      <form onSubmit={onSubmit} className="mt-6 max-w-xl space-y-4 rounded-2xl border border-charcoal/10 p-5 bg-white">
        <p className="text-sm font-medium text-charcoal">{form.id ? "Edit Collection" : "New Collection"}</p>
        
        <input
          required
          placeholder="Collection Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className={inputCls}
        />
        <input
          placeholder="Slug (optional — auto generated)"
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          className={inputCls}
        />
        
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Collection Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className={inputCls}
          >
            {COLLECTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic Rule Config Inputs */}
        {form.type === "CATEGORY" && (
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Select Target Category</label>
            <select
              required
              value={form.ruleCategoryId}
              onChange={(e) => setForm((f) => ({ ...f, ruleCategoryId: e.target.value }))}
              className={inputCls}
            >
              <option value="" disabled>Select category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {form.type === "TAG" && (
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Target Tag</label>
            <input
              required
              placeholder="e.g. handcrafted"
              value={form.ruleTag}
              onChange={(e) => setForm((f) => ({ ...f, ruleTag: e.target.value }))}
              className={inputCls}
            />
          </div>
        )}

        {form.type === "PRICE_RANGE" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Min Price</label>
              <input
                type="number"
                placeholder="0"
                value={form.ruleMinPrice}
                onChange={(e) => setForm((f) => ({ ...f, ruleMinPrice: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Max Price</label>
              <input
                type="number"
                placeholder="10000"
                value={form.ruleMaxPrice}
                onChange={(e) => setForm((f) => ({ ...f, ruleMaxPrice: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>
        )}

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className={inputCls}
        />
        <input
          placeholder="Banner / Cover image URL"
          value={form.image}
          onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
          className={inputCls}
        />
        <input
          type="number"
          placeholder="Sort order"
          value={form.sortOrder}
          onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
          className={inputCls}
        />

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
            />
            Featured Collection
          </label>
        </div>

        {error && <p className="text-sm text-terracotta">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button>{form.id ? "Save Changes" : "Create Collection"}</Button>
          {form.id && (
            <Button type="button" variant="secondary" onClick={() => setForm(emptyForm)}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-charcoal/10 bg-white">
        {status === "loading" && <LoadingNotice />}
        {status === "error" && <ErrorNotice message="Unable to load collections." />}
        {status === "ready" && (
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-ivory-dark text-xs uppercase tracking-wide text-charcoal-soft">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/10">
              {collections.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-charcoal">{c.name || c.title}</td>
                  <td className="px-4 py-3 text-charcoal-soft">{c.slug}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-ivory-dark px-2.5 py-1 text-xs font-semibold text-charcoal">
                      {c.type || "MANUAL"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-charcoal-soft">
                    {c.type === "MANUAL" ? (c.products?.length ?? 0) : "Rule-based"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={c.isActive ? "text-green-deep font-medium" : "text-charcoal-soft"}>
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
                      {c.type === "MANUAL" && (
                        <button
                          onClick={() => setAssigning(c)}
                          className="rounded-full border border-sage/40 bg-sage-light/50 px-3 py-1 font-medium text-green-deep transition hover:bg-sage-light"
                        >
                          Manage Products
                        </button>
                      )}
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

      {assigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 p-6">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif-display text-lg text-charcoal">Products in "{assigning.name || assigning.title}"</h2>
              <button onClick={() => setAssigning(null)} className="text-sm underline">
                Close
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {products.map((p) => {
                const checked = (assigning.products || []).some((cp) => cp.productId === p.id);
                return (
                  <li key={p.id}>
                    <label className="flex items-center gap-2 text-sm text-charcoal">
                      <input type="checkbox" checked={checked} onChange={() => toggleProduct(assigning, p.id)} />
                      {p.name}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-charcoal/40 focus:outline-none";

