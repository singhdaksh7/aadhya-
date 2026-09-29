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
import { FilterInput, FilterSelect } from "../../components/admin/ui/FilterBar";

const EMPTY_FILTERS = {
  search: "",
  invoiceNumber: "",
  orderNumber: "",
  customer: "",
  dateFrom: "",
  dateTo: "",
  paymentMethod: "",
  status: "",
  source: "",
};

export default function AdminInvoices() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    adminListInvoices({
      search: filters.search || undefined,
      invoiceNumber: filters.invoiceNumber || undefined,
      orderNumber: filters.orderNumber || undefined,
      customer: filters.customer || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      paymentMethod: filters.paymentMethod || undefined,
      status: filters.status || undefined,
      page,
      limit: 20,
    })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [filters, page, reloadToken]);

  const setFilter = (key) => (e) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  };

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
      <PageHeader
        eyebrow="Sales"
        title="Invoices"
        description="Generated invoices linked to paid or confirmed orders."
        actions={
          <Link to="/admin/invoices/new" className="admin-btn admin-btn--primary">
            Create Invoice
          </Link>
        }
      />
      {message && <p className="mb-3 rounded-xl bg-sage-light px-3 py-2 text-sm text-green-deep">{message}</p>}
      <FilterBar>
        <FilterInput
          type="search"
          value={filters.search}
          onChange={setFilter("search")}
          placeholder="Search invoice #, order, customer…"
          className="min-w-[220px] flex-1"
        />
        <FilterInput type="text" value={filters.invoiceNumber} onChange={setFilter("invoiceNumber")} placeholder="Invoice #" className="min-w-[130px]" />
        <FilterInput type="text" value={filters.orderNumber} onChange={setFilter("orderNumber")} placeholder="Order #" className="min-w-[130px]" />
        <FilterInput type="text" value={filters.customer} onChange={setFilter("customer")} placeholder="Customer" className="min-w-[150px]" />
        <FilterInput type="date" value={filters.dateFrom} onChange={setFilter("dateFrom")} className="min-w-[140px]" />
        <FilterInput type="date" value={filters.dateTo} onChange={setFilter("dateTo")} className="min-w-[140px]" />
        <FilterSelect value={filters.paymentMethod} onChange={setFilter("paymentMethod")} className="min-w-[130px]">
          <option value="">Any payment mode</option>
          <option value="card">Card</option>
          <option value="upi">UPI</option>
          <option value="netbanking">Netbanking</option>
          <option value="cod">COD</option>
        </FilterSelect>
        <FilterSelect value={filters.status} onChange={setFilter("status")} className="min-w-[130px]">
          <option value="">Any status</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
          <option value="REFUNDED">Refunded</option>
        </FilterSelect>
        <button type="button" className="admin-btn admin-btn--ghost" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}>
          Clear
        </button>
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
              { key: "gstin", label: "GSTIN" },
              { key: "taxable", label: "Taxable" },
              { key: "gst", label: "GST" },
              { key: "total", label: "Grand Total" },
              { key: "payment", label: "Payment" },
              { key: "status", label: "Status" },
              { key: "source", label: "Source" },
              { key: "actions", label: "Actions" },
            ]}
            minWidth="1280px"
          >
            {result.data.map((inv) => (
              <tr key={inv.id}>
                <td>
                  <Link to={`/admin/invoices/${inv.id}`} className="text-terracotta hover:underline">
                    {inv.invoiceNumber}
                  </Link>
                </td>
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
                <td>{inv.gstin || "—"}</td>
                <td>{formatInr(inv.subtotal ?? inv.totalAmount - (inv.taxAmount || 0))}</td>
                <td>{formatInr(inv.taxAmount || 0)}</td>
                <td>{formatInr(inv.totalAmount)}</td>
                <td>{inv.order?.paymentMethod || "—"}</td>
                <td>
                  <StatusBadge value={inv.status ?? "ISSUED"} />
                </td>
                <td>{inv.source ?? "ONLINE"}</td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    <Link to={`/admin/invoices/${inv.id}`} className="admin-btn admin-btn--ghost">
                      View
                    </Link>
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
