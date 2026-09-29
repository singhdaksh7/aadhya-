import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminListInvoices, adminDownloadInvoice, adminResendInvoice } from "../../lib/api";
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
import { FilterInput } from "../../components/admin/ui/FilterBar";

export default function AdminInvoices() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    adminListInvoices({ search: search || undefined, page, limit: 20 })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [search, page, reloadToken]);

  const download = async (invoice) => {
    const blob = await adminDownloadInvoice(invoice.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoice.invoiceNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resend = async (invoice) => {
    try {
      await adminResendInvoice(invoice.id);
      setMessage(`Resent ${invoice.invoiceNumber}`);
      setReloadToken((t) => t + 1);
    } catch (err) {
      setMessage(err.message || "Could not resend invoice.");
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Sales" title="Invoices" description="Generated invoices linked to paid or confirmed orders." />
      {message && <p className="mb-3 rounded-xl bg-sage-light px-3 py-2 text-sm text-green-deep">{message}</p>}
      <FilterBar>
        <FilterInput
          type="search"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search invoice #, order, customer…"
          className="min-w-[240px] flex-1"
        />
      </FilterBar>
      <AdminCard noPadding>
        {status === "loading" && <LoadingNotice />}
        {status === "error" && <ErrorNotice message="Unable to load invoices." onRetry={() => setReloadToken((t) => t + 1)} />}
        {status === "ready" && result.data.length === 0 && <AdminEmptyState title="No invoices yet" />}
        {status === "ready" && result.data.length > 0 && (
          <AdminTable
            columns={[
              { key: "invoice", label: "Invoice #" },
              { key: "order", label: "Order" },
              { key: "customer", label: "Customer" },
              { key: "date", label: "Date" },
              { key: "amount", label: "Amount" },
              { key: "email", label: "Email Status" },
              { key: "actions", label: "Actions" },
            ]}
            minWidth="920px"
          >
            {result.data.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.invoiceNumber}</td>
                <td>
                  {inv.order ? (
                    <Link to={`/admin/orders/${inv.order.id}`} className="text-terracotta hover:underline">
                      {inv.order.orderNumber}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <div className="leading-tight">
                    <p className="font-medium text-charcoal">{inv.customerName}</p>
                    <p className="text-[11px]">{inv.customerEmail}</p>
                  </div>
                </td>
                <td>{new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString("en-IN")}</td>
                <td>{formatInr(inv.totalAmount)}</td>
                <td>
                  <StatusBadge value={inv.emailedAt ? "Emailed" : "Pending"} tone={inv.emailedAt ? "success" : "neutral"} />
                </td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    {inv.order && (
                      <Link to={`/admin/orders/${inv.order.id}`} className="admin-btn admin-btn--ghost">
                        View
                      </Link>
                    )}
                    <button type="button" onClick={() => download(inv)} className="admin-btn admin-btn--ghost">
                      Download
                    </button>
                    <button type="button" onClick={() => resend(inv)} className="admin-btn admin-btn--ghost">
                      Resend
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
