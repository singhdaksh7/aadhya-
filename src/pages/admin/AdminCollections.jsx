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

const emptyForm = { id: null, title: "", slug: "", description: "", heroImage: "", sortOrder: "0", isActive: true };

export default function AdminCollections() {
  const [collections, setCollections] = useState([]);
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [assigning, setAssigning] = useState(null); // collection being edited for product membership

  useEffect(() => {
    setStatus("loading");
    Promise.all([adminListCollections(), adminListProducts({ limit: 100 })])
      .then(([colRes, prodRes]) => {
        setCollections(colRes.data);
        setProducts(prodRes.data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [reloadToken]);

  const startEdit = (c) =>
    setForm({
      id: c.id,
      title: c.title,
      slug: c.slug,
      description: c.description || "",
      heroImage: c.heroImage || "",
      sortOrder: String(c.sortOrder),
      isActive: c.isActive,
    });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const payload = {
      title: form.title,
      slug: form.slug || undefined,
      description: form.description || null,
      heroImage: form.heroImage || null,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
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
    if (!confirm(`Delete collection "${c.title}"?`)) return;
    try {
      await adminDeleteCollection(c.id);
      setReloadToken((t) => t + 1);
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleProduct = async (collection, productId) => {
    const currentIds = collection.products.map((cp) => cp.productId);
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

      <form onSubmit={onSubmit} className="mt-6 max-w-lg space-y-4 rounded-2xl border border-charcoal/10 p-5">
        <p className="text-sm font-medium text-charcoal">{form.id ? "Edit Collection" : "New Collection"}</p>
        <input
          required
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
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
        <input
          placeholder="Hero image URL"
          value={form.heroImage}
          onChange={(e) => setForm((f) => ({ ...f, heroImage: e.target.value }))}
          className={inputCls}
        />
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
          <Button>{form.id ? "Save Changes" : "Create Collection"}</Button>
          {form.id && (
            <Button type="button" variant="secondary" onClick={() => setForm(emptyForm)}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      <div className="mt-8">
        {status === "loading" && <LoadingNotice />}
        {status === "error" && <ErrorNotice message="Unable to load collections." />}
        {status === "ready" && (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-charcoal-soft">
              <tr>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Products</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/10">
              {collections.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium text-charcoal">{c.title}</td>
                  <td className="px-3 py-2 text-charcoal-soft">{c.slug}</td>
                  <td className="px-3 py-2 text-charcoal-soft">{c.products?.length ?? 0}</td>
                  <td className="px-3 py-2">
                    <span className={c.isActive ? "text-green-deep" : "text-charcoal-soft"}>
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-3 text-xs">
                      <button onClick={() => startEdit(c)} className="underline">
                        Edit
                      </button>
                      <button onClick={() => setAssigning(c)} className="underline">
                        Manage Products
                      </button>
                      <button onClick={() => remove(c)} className="text-terracotta underline">
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
              <h2 className="font-serif-display text-lg text-charcoal">Products in "{assigning.title}"</h2>
              <button onClick={() => setAssigning(null)} className="text-sm underline">
                Close
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {products.map((p) => {
                const checked = assigning.products.some((cp) => cp.productId === p.id);
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
