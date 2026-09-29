import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminListOrders } from "../../lib/api";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import { formatInr } from "../../lib/format";
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

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];

function fulfilmentLabel(order) {
  if (order.shipment?.trackingNumber || order.shipment?.carrier) {
    return order.shipment.status || "Shipped";
  }
  if (["SHIPPED", "DELIVERED"].includes(order.status)) return order.status;
  return "Unfulfilled";
}

export function StatusPill({ value }) {
  return <StatusBadge value={value} />;
}

export default function AdminOrderList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loadStatus, setLoadStatus] = useState("loading");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadStatus("loading");
    adminListOrders({
      search: search || undefined,
      status: status || undefined,
      paymentStatus: paymentStatus || undefined,
      page,
      limit: 20,
    })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setLoadStatus("ready");
      })
      .catch(() => !cancelled && setLoadStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [search, status, paymentStatus, page, reloadToken]);

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="Orders"
        description="Search and filter storefront orders by status and payment."
      />

      <FilterBar>
        <FilterInput
          type="search"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search order #, email, phone…"
          className="min-w-[220px] flex-1"
        />
        <FilterSelect
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          value={paymentStatus}
          onChange={(e) => {
            setPage(1);
            setPaymentStatus(e.target.value);
          }}
        >
          <option value="">All Payment Statuses</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </FilterSelect>
      </FilterBar>

      <AdminCard noPadding>
        {loadStatus === "loading" && <LoadingNotice />}
        {loadStatus === "error" && (
          <ErrorNotice message="Unable to load orders." onRetry={() => setReloadToken((t) => t + 1)} />
        )}
        {loadStatus === "ready" && result.data.length === 0 && <AdminEmptyState title="No orders found" />}
        {loadStatus === "ready" && result.data.length > 0 && (
          <AdminTable
            columns={[
              { key: "order", label: "Order" },
              { key: "customer", label: "Customer" },
              { key: "date", label: "Date" },
              { key: "total", label: "Total" },
              { key: "payment", label: "Payment" },
              { key: "shipment", label: "Shipment" },
              { key: "status", label: "Status" },
              { key: "actions", label: "Actions" },
            ]}
            minWidth="920px"
          >
            {result.data.map((order) => (
              <tr key={order.id}>
                <td>{order.orderNumber}</td>
                <td>
                  <div className="leading-tight">
                    <p className="font-medium text-charcoal">{order.customerName}</p>
                    <p className="text-[11px]">{order.customerEmail}</p>
                  </div>
                </td>
                <td>{new Date(order.createdAt).toLocaleDateString("en-IN")}</td>
                <td>{formatInr(order.totalAmount)}</td>
                <td>
                  <StatusBadge value={order.paymentStatus} />
                </td>
                <td>
                  <StatusBadge value={fulfilmentLabel(order)} tone={order.shipment ? "info" : "neutral"} />
                </td>
                <td>
                  <StatusBadge value={order.status} />
                </td>
                <td>
                  <Link to={`/admin/orders/${order.id}`} className="admin-btn admin-btn--ghost">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminCard>

      {loadStatus === "ready" && (
        <AdminTablePagination page={page} totalPages={result?.meta?.totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}
