import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminListProducts } from "../../lib/api";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
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

export default function AdminInventory() {
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("tracked");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    adminListProducts({ search: search || undefined, page, limit: 30 })
      .then((res) => {
        if (cancelled) return;
        let rows = res.data || [];
        if (stockFilter === "tracked") rows = rows.filter((p) => p.trackInventory);
        if (stockFilter === "low") rows = rows.filter((p) => p.trackInventory && Number(p.stockQuantity) <= 5);
        if (stockFilter === "out") rows = rows.filter((p) => p.trackInventory && Number(p.stockQuantity) <= 0);
        setResult({ ...res, data: rows });
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [search, stockFilter, page, reloadToken]);

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Inventory"
        description="Stock levels for tracked products. Edit stock from the product form."
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
          value={stockFilter}
          onChange={(e) => {
            setPage(1);
            setStockFilter(e.target.value);
          }}
        >
          <option value="tracked">Tracked only</option>
          <option value="low">Low stock (≤ 5)</option>
          <option value="out">Out of stock</option>
          <option value="all">All products</option>
        </FilterSelect>
      </FilterBar>
      <AdminCard noPadding>
        {status === "loading" && <LoadingNotice />}
        {status === "error" && <ErrorNotice message="Unable to load inventory." onRetry={() => setReloadToken((t) => t + 1)} />}
        {status === "ready" && result.data.length === 0 && <AdminEmptyState title="No inventory rows" />}
        {status === "ready" && result.data.length > 0 && (
          <AdminTable
            columns={[
              { key: "image", label: "Image" },
              { key: "name", label: "Product" },
              { key: "sku", label: "SKU" },
              { key: "stock", label: "Stock" },
              { key: "status", label: "Status" },
              { key: "actions", label: "Actions" },
            ]}
          >
            {result.data.map((product) => {
              const qty = Number(product.stockQuantity || 0);
              const tone = !product.trackInventory ? "neutral" : qty <= 0 ? "danger" : qty <= 5 ? "neutral" : "success";
              const label = !product.trackInventory ? "Not tracked" : qty <= 0 ? "Out of stock" : qty <= 5 ? "Low" : "In stock";
              return (
                <tr key={product.id}>
                  <td>
                    <ProductImage product={product} className="h-11 w-11" ratio="aspect-square" rounded="rounded-lg" />
                  </td>
                  <td>{product.name}</td>
                  <td>{product.sku || "—"}</td>
                  <td>{product.trackInventory ? qty : "∞"}</td>
                  <td>
                    <StatusBadge value={label} tone={tone} />
                  </td>
                  <td>
                    <Link to={`/admin/products/${product.id}`} className="admin-btn admin-btn--ghost">
                      Edit
                    </Link>
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        )}
      </AdminCard>
      {status === "ready" && stockFilter === "all" && (
        <AdminTablePagination page={page} totalPages={result?.meta?.totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}
