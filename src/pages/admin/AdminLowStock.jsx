import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminGetLowStockOverview,
  adminGetLowStockThreshold,
  adminSetLowStockThreshold,
  adminRestockItem,
} from "../../lib/api";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import {
  PageHeader,
  AdminCard,
  StatusBadge,
  AdminTable,
  AdminEmptyState,
} from "../../components/admin/ui";

export default function AdminLowStock() {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("loading");
  const [threshold, setThreshold] = useState(5);
  const [thresholdDraft, setThresholdDraft] = useState("5");
  const [restocking, setRestocking] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    Promise.all([adminGetLowStockOverview(), adminGetLowStockThreshold()])
      .then(([overview, thresholdRes]) => {
        if (cancelled) return;
        setRows(overview.data || []);
        setThreshold(thresholdRes.data?.threshold ?? 5);
        setThresholdDraft(String(thresholdRes.data?.threshold ?? 5));
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  async function handleSaveThreshold() {
    const value = Number(thresholdDraft);
    if (!Number.isFinite(value) || value < 0) return;
    await adminSetLowStockThreshold(value);
    setThreshold(value);
    setReloadToken((t) => t + 1);
  }

  async function handleRestock(row) {
    const qty = window.prompt(`Restock quantity for "${row.name}":`, "10");
    if (!qty) return;
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    setRestocking(row.variantId || row.productId);
    try {
      await adminRestockItem({ productId: row.variantId ? undefined : row.productId, variantId: row.variantId || undefined, quantity });
      setReloadToken((t) => t + 1);
    } finally {
      setRestocking(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Low Stock"
        description="Products and variants at or below their low-stock threshold. Restocking updates stock directly and re-arms low-stock alerts."
      />

      <AdminCard title="Global low-stock threshold" className="mb-4">
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            className="admin-input w-32"
            value={thresholdDraft}
            onChange={(e) => setThresholdDraft(e.target.value)}
          />
          <button type="button" className="admin-btn admin-btn--primary" onClick={handleSaveThreshold}>
            Save
          </button>
          <span className="text-xs text-charcoal-soft">
            Applies to any product/variant without its own threshold override. Current: {threshold}
          </span>
        </div>
      </AdminCard>

      <AdminCard noPadding>
        {status === "loading" && <LoadingNotice />}
        {status === "error" && <ErrorNotice message="Unable to load low stock data." onRetry={() => setReloadToken((t) => t + 1)} />}
        {status === "ready" && rows.length === 0 && <AdminEmptyState title="Nothing low on stock" description="All tracked products are above their threshold." />}
        {status === "ready" && rows.length > 0 && (
          <AdminTable
            columns={[
              { key: "name", label: "Product" },
              { key: "sku", label: "SKU" },
              { key: "stock", label: "Current Stock" },
              { key: "threshold", label: "Threshold" },
              { key: "status", label: "Status" },
              { key: "actions", label: "Actions" },
            ]}
          >
            {rows.map((row) => {
              const key = row.variantId || row.productId;
              const tone = row.status === "OUT" ? "danger" : "neutral";
              return (
                <tr key={key}>
                  <td>
                    <Link to={`/admin/products/${row.productId}`} className="font-medium text-charcoal hover:underline">
                      {row.name}
                    </Link>
                  </td>
                  <td>{row.sku || "—"}</td>
                  <td>{row.stockQuantity}</td>
                  <td>{row.threshold}</td>
                  <td>
                    <StatusBadge value={row.status === "OUT" ? "Out of stock" : "Low"} tone={tone} />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-btn admin-btn--ghost"
                      disabled={restocking === key}
                      onClick={() => handleRestock(row)}
                    >
                      {restocking === key ? "Restocking…" : "Restock"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        )}
      </AdminCard>
    </div>
  );
}
