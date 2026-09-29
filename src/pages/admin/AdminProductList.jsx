import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminListProducts, adminUpdateProduct, adminDeleteProduct } from "../../lib/api";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import { formatInr } from "../../lib/format";
import ProductImage from "../../components/ProductImage";
import {
  PageHeader,
  AdminCard,
  FilterBar,
  StatusBadge,
  AdminTable,
  AdminTablePagination,
  AdminEmptyState,
} from "../../components/admin/ui";
import { FilterInput, FilterSelect } from "../../components/admin/ui/FilterBar";

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
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Manage books and physical products in the Aadya catalog."
        actions={
          <Link to="/admin/products/new" className="admin-btn admin-btn--primary">
            Add Product
          </Link>
        }
      />

      <FilterBar>
        <FilterInput
          type="search"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search products…"
          className="min-w-[220px] flex-1"
        />
        <FilterSelect
          value={type}
          onChange={(e) => {
            setPage(1);
            setType(e.target.value);
          }}
        >
          <option value="">All Types</option>
          <option value="BOOK">Book</option>
          <option value="PHYSICAL">Physical</option>
        </FilterSelect>
      </FilterBar>

      <AdminCard noPadding>
        {status === "loading" && <LoadingNotice />}
        {status === "error" && <ErrorNotice message="Unable to load products." onRetry={() => setReloadToken((t) => t + 1)} />}
        {status === "ready" && result.data.length === 0 && <AdminEmptyState title="No products found" />}
        {status === "ready" && result.data.length > 0 && (
          <AdminTable
            columns={[
              { key: "image", label: "Image" },
              { key: "name", label: "Name" },
              { key: "sku", label: "SKU" },
              { key: "category", label: "Category" },
              { key: "type", label: "Type" },
              { key: "price", label: "Price" },
              { key: "stock", label: "Stock" },
              { key: "status", label: "Status" },
              { key: "featured", label: "Featured" },
              { key: "actions", label: "Actions" },
            ]}
            minWidth="980px"
          >
            {result.data.map((product) => (
              <tr key={product.id}>
                <td>
                  <ProductImage product={product} className="h-11 w-11" ratio="aspect-square" rounded="rounded-lg" />
                </td>
                <td>{product.name}</td>
                <td>{product.sku || "—"}</td>
                <td>{product.category?.name || "—"}</td>
                <td>{product.productType}</td>
                <td>{formatInr(product.salePrice ?? product.price)}</td>
                <td>{product.trackInventory ? product.stockQuantity : "∞"}</td>
                <td>
                  <StatusBadge value={product.isActive ? "Active" : "Inactive"} tone={product.isActive ? "success" : "neutral"} />
                </td>
                <td>{product.isFeatured ? "Yes" : "—"}</td>
                <td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link to={`/admin/products/${product.id}`} className="admin-btn admin-btn--ghost">
                      Edit
                    </Link>
                    <button type="button" onClick={() => toggleActive(product)} className="admin-btn admin-btn--ghost">
                      {product.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" onClick={() => remove(product)} className="admin-btn admin-btn--danger">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminCard>

      {status === "ready" && (
        <AdminTablePagination page={page} totalPages={result?.meta?.totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}
