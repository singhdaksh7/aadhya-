import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminListOrders } from "../../lib/api";
import { LoadingNotice, ErrorNotice, EmptyNotice } from "../../components/StateNotice";
import { formatInr } from "../../lib/format";

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];

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
    adminListOrders({ search: search || undefined, status: status || undefined, paymentStatus: paymentStatus || undefined, page, limit: 20 })
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
      <h1 className="font-serif-display text-2xl text-charcoal">Orders</h1>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search order #, email, phone…"
          className="rounded-full border border-charcoal/15 px-4 py-2 text-sm focus:border-charcoal/40 focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="rounded-full border border-charcoal/15 px-4 py-2 text-sm focus:border-charcoal/40 focus:outline-none"
        >
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => {
            setPage(1);
            setPaymentStatus(e.target.value);
          }}
          className="rounded-full border border-charcoal/15 px-4 py-2 text-sm focus:border-charcoal/40 focus:outline-none"
        >
          <option value="">All Payment Statuses</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-charcoal/10">
        {loadStatus === "loading" && <LoadingNotice />}
        {loadStatus === "error" && (
          <ErrorNotice message="Unable to load orders." onRetry={() => setReloadToken((t) => t + 1)} />
        )}
        {loadStatus === "ready" && result.data.length === 0 && <EmptyNotice message="No orders found." />}
        {loadStatus === "ready" && result.data.length > 0 && (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-ivory-dark text-xs uppercase tracking-wide text-charcoal-soft">
              <tr>
                <th className="px-4 py-3">Order Number</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/10">
              {result.data.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-medium text-charcoal">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-charcoal-soft">
                    {order.customerName}
                    <br />
                    <span className="text-xs">{order.customerEmail}</span>
                  </td>
                  <td className="px-4 py-3 text-charcoal-soft">{new Date(order.createdAt).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3 text-charcoal-soft">{formatInr(order.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <StatusPill value={order.paymentStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill value={order.status} />
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/orders/${order.id}`} className="text-xs text-charcoal underline underline-offset-2">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {loadStatus === "ready" && result.meta.totalPages > 1 && (
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

const STATUS_TONE = {
  PAID: "text-green-deep",
  CONFIRMED: "text-green-deep",
  DELIVERED: "text-green-deep",
  PENDING: "text-charcoal-soft",
  PROCESSING: "text-charcoal-soft",
  SHIPPED: "text-charcoal-soft",
  FAILED: "text-terracotta",
  CANCELLED: "text-terracotta",
  REFUNDED: "text-terracotta",
  PARTIALLY_REFUNDED: "text-terracotta",
};

export function StatusPill({ value }) {
  return <span className={`text-xs font-medium ${STATUS_TONE[value] || "text-charcoal-soft"}`}>{value}</span>;
}
