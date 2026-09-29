import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminListReturns } from "../../lib/api";
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

export const RETURN_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "PICKUP_SCHEDULED",
  "IN_TRANSIT",
  "RECEIVED",
  "REFUND_PENDING",
  "REFUNDED",
  "CLOSED",
];

function refundAmount(returnRequest) {
  if (returnRequest.refundAmount != null) return Number(returnRequest.refundAmount);
  const paid = Number(returnRequest.order?.payments?.[0]?.amount || 0);
  return paid || 0;
}

// The backend list endpoint (GET /api/admin/returns) supports server-side
// `status` filtering and pagination (page/limit) but has no date-range or
// text-search query params (see returns.service.js listAdminReturns), so
// date-range and search are applied client-side on the current page here.
export default function AdminReturnList() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loadStatus, setLoadStatus] = useState("loading");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadStatus("loading");
    adminListReturns({ status: status || undefined, page, limit: 20 })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setLoadStatus("ready");
      })
      .catch(() => !cancelled && setLoadStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [status, page, reloadToken]);

  const filteredItems = useMemo(() => {
    const items = result?.data || [];
    const term = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
    return items.filter((r) => {
      if (from && new Date(r.createdAt) < from) return false;
      if (to && new Date(r.createdAt) > to) return false;
      if (!term) return true;
      const haystack = [
        r.id,
        r.order?.orderNumber,
        r.order?.customerName,
        r.order?.customerEmail,
        r.reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [result, search, dateFrom, dateTo]);

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="Returns"
        description="Review, approve, and process customer return requests, including RTO-generated returns."
      />

      <FilterBar>
        <FilterInput
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search return ID, order #, customer…"
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
          {RETURN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </FilterSelect>
        <FilterInput
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="From date"
          className="w-[150px]"
        />
        <FilterInput
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="To date"
          className="w-[150px]"
        />
      </FilterBar>

      <AdminCard noPadding>
        {loadStatus === "loading" && <LoadingNotice />}
        {loadStatus === "error" && (
          <ErrorNotice message="Unable to load returns." onRetry={() => setReloadToken((t) => t + 1)} />
        )}
        {loadStatus === "ready" && filteredItems.length === 0 && (
          <AdminEmptyState title="No returns found" />
        )}
        {loadStatus === "ready" && filteredItems.length > 0 && (
          <AdminTable
            columns={[
              { key: "returnId", label: "Return ID" },
              { key: "order", label: "Order" },
              { key: "customer", label: "Customer" },
              { key: "date", label: "Date" },
              { key: "reason", label: "Reason" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status" },
              { key: "actions", label: "Actions" },
            ]}
            minWidth="960px"
          >
            {filteredItems.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-[11px]">{r.id.slice(0, 8)}</td>
                <td>{r.order?.orderNumber || "—"}</td>
                <td>
                  <div className="leading-tight">
                    <p className="font-medium text-charcoal">{r.order?.customerName || "—"}</p>
                    <p className="text-[11px]">{r.order?.customerEmail}</p>
                  </div>
                </td>
                <td>{new Date(r.createdAt).toLocaleDateString("en-IN")}</td>
                <td>{r.reason === "RTO" ? "RTO" : r.reason}</td>
                <td>{formatInr(refundAmount(r))}</td>
                <td>
                  <StatusBadge value={r.status} />
                  {r.reason === "RTO" && (
                    <StatusBadge value="RTO" tone="warning" className="ml-1" />
                  )}
                </td>
                <td>
                  <Link to={`/admin/returns/${r.id}`} className="admin-btn admin-btn--ghost">
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
