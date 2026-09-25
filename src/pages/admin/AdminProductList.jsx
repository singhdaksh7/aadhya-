import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminListProducts, adminUpdateProduct, adminDeleteProduct } from "../../lib/api";
import { LoadingNotice, ErrorNotice, EmptyNotice } from "../../components/StateNotice";
import { formatInr } from "../../lib/format";
import ProductImage from "../../components/ProductImage";

export default function AdminProductList() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    adminListProducts({ search: search || undefined, productType: type || undefined, page, limit: 15 })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [search, type, page, reloadToken]);

  const toggleActive = async (product) => {
    await adminUpdateProduct(product.id, { isActive: !product.isActive });
    setReloadToken((t) => t + 1);
  };

  const remove = async (product) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    await adminDeleteProduct(product.id);
    setReloadToken((t) => t + 1);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif-display text-2xl text-charcoal">Products</h1>
        <Link
          to="/admin/products/new"
          className="rounded-full bg-green px-5 py-2.5 text-sm font-medium text-ivory hover:bg-green-deep"
        >
          Add Product
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search products…"
          className="rounded-full border border-charcoal/15 px-4 py-2 text-sm focus:border-charcoal/40 focus:outline-none"
        />
        <select
          value={type}
          onChange={(e) => {
            setPage(1);
            setType(e.target.value);
          }}
          className="rounded-full border border-charcoal/15 px-4 py-2 text-sm focus:border-charcoal/40 focus:outline-none"
        >
          <option value="">All Types</option>
          <option value="BOOK">Book</option>
          <option value="PHYSICAL">Physical</option>
        </select>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-charcoal/10">
        {status === "loading" && <LoadingNotice />}
        {status === "error" && <ErrorNotice message="Unable to load products." onRetry={() => setReloadToken((t) => t + 1)} />}
        {status === "ready" && result.data.length === 0 && <EmptyNotice message="No products found." />}
        {status === "ready" && result.data.length > 0 && (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-ivory-dark text-xs uppercase tracking-wide text-charcoal-soft">
              <tr>
                <th className="px-4 py-3">Image</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Featured</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/10">
              {result.data.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3">
                    <ProductImage product={product} className="h-12 w-12" ratio="aspect-square" rounded="rounded-lg" />
                  </td>
                  <td className="px-4 py-3 font-medium text-charcoal">{product.name}</td>
                  <td className="px-4 py-3 text-charcoal-soft">{product.sku || "—"}</td>
                  <td className="px-4 py-3 text-charcoal-soft">{product.category?.name}</td>
                  <td className="px-4 py-3 text-charcoal-soft">{product.productType}</td>
                  <td className="px-4 py-3 text-charcoal-soft">{formatInr(product.salePrice ?? product.price)}</td>
                  <td className="px-4 py-3 text-charcoal-soft">
                    {product.trackInventory ? product.stockQuantity : "∞"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={product.isActive ? "text-green-deep" : "text-charcoal-soft"}>
                      {product.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-charcoal-soft">{product.isFeatured ? "Yes" : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 whitespace-nowrap text-xs">
                      <Link
                        to={`/admin/products/${product.id}`}
                        className="rounded-full border border-charcoal/20 bg-white px-3 py-1 font-medium text-charcoal transition hover:border-terracotta hover:text-terracotta"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => toggleActive(product)}
                        className="rounded-full border border-sage/40 bg-sage-light/50 px-3 py-1 font-medium text-green-deep transition hover:bg-sage-light"
                      >
                        {product.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => remove(product)}
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

      {status === "ready" && result.meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-full border border-charcoal/20 px-4 py-2 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-charcoal-soft">
            Page {result.meta.page} of {result.meta.totalPages}
          </span>
          <button
            disabled={page >= result.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border border-charcoal/20 px-4 py-2 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
