import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminGetInvoiceDetail, adminDownloadInvoice, adminResendInvoice, adminRegenerateInvoice } from "../../lib/api";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import { formatInr } from "../../lib/format";
import { PageHeader, AdminCard, StatusBadge } from "../../components/admin/ui";

export default function AdminInvoiceDetail() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [status, setStatus] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => {
    setStatus("loading");
    adminGetInvoiceDetail(id)
      .then((res) => {
        setInvoice(res.data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  };

  useEffect(load, [id]);

  const download = async () => {
    const blob = await adminDownloadInvoice(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoice.invoiceNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resend = async () => {
    setBusy(true);
    try {
      await adminResendInvoice(id);
      setMessage("Invoice email resent.");
      load();
    } catch (err) {
      setMessage(err.message || "Could not resend invoice.");
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      await adminRegenerateInvoice(id);
      setMessage("PDF regenerated from the stored snapshot.");
      load();
    } catch (err) {
      setMessage(err.message || "Could not regenerate invoice PDF.");
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") return <LoadingNotice />;
  if (status === "error" || !invoice) return <ErrorNotice message="Unable to load invoice." onRetry={load} />;

  const items = invoice.itemsSnapshot || [];
  const tax = invoice.taxSnapshot || {};
  const company = invoice.companySnapshot || {};
  const bill = invoice.billingAddress || {};
  const ship = invoice.shippingAddress || bill;
  const payment = invoice.order?.payments?.[0];

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title={invoice.invoiceNumber}
        description={`Issued ${new Date(invoice.invoiceDate || invoice.createdAt).toLocaleDateString("en-IN")}`}
      />
      {message && <p className="mb-3 rounded-xl bg-sage-light px-3 py-2 text-sm text-green-deep">{message}</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={download} className="admin-btn admin-btn--primary">
          Download PDF
        </button>
        <button type="button" disabled={busy} onClick={resend} className="admin-btn admin-btn--ghost">
          Resend Email
        </button>
        <button type="button" disabled={busy} onClick={regenerate} className="admin-btn admin-btn--ghost">
          Regenerate PDF
        </button>
        {invoice.order?.id && (
          <Link to={`/admin/orders/${invoice.order.id}`} className="admin-btn admin-btn--ghost">
            View Order
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AdminCard title="Seller">
          <p className="font-medium text-charcoal">{company.legalName}</p>
          <p className="text-sm">{company.address}</p>
          <p className="text-sm">{company.email} {company.phone}</p>
          {company.gstin && <p className="text-sm">GSTIN: {company.gstin}</p>}
          {company.pan && <p className="text-sm">PAN: {company.pan}</p>}
        </AdminCard>
        <AdminCard title="Buyer">
          <p className="font-medium text-charcoal">{invoice.customerName}</p>
          <p className="text-sm">{invoice.customerEmail} {invoice.customerPhone}</p>
          <p className="text-sm">Bill: {bill.addressLine1}, {bill.city}, {bill.state} {bill.postalCode}</p>
          <p className="text-sm">Ship: {ship.addressLine1}, {ship.city}, {ship.state} {ship.postalCode}</p>
        </AdminCard>
      </div>

      <AdminCard title="Items" className="mt-4" noPadding>
        <div className="overflow-x-auto">
          <table className="admin-table" style={{ minWidth: "900px" }}>
            <thead>
              <tr>
                <th>Product</th>
                <th>HSN</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Taxable</th>
                <th>GST%</th>
                <th>CGST</th>
                <th>SGST</th>
                <th>IGST</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.productName}{item.sku ? ` (${item.sku})` : ""}</td>
                  <td>{item.hsnCode || "—"}</td>
                  <td>{item.quantity}</td>
                  <td>{formatInr(item.unitPrice)}</td>
                  <td>{formatInr(item.taxableValue ?? item.lineTotal)}</td>
                  <td>{item.gstRate != null ? `${item.gstRate}%` : "—"}</td>
                  <td>{formatInr(item.cgstAmount || 0)}</td>
                  <td>{formatInr(item.sgstAmount || 0)}</td>
                  <td>{formatInr(item.igstAmount || 0)}</td>
                  <td>{formatInr(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <AdminCard title="Totals">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatInr(invoice.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Discount</dt><dd>{formatInr(invoice.discountAmount)}</dd></div>
            <div className="flex justify-between"><dt>Shipping</dt><dd>{formatInr(invoice.shippingAmount)}</dd></div>
            {Number(tax.cgstAmount || 0) > 0 && <div className="flex justify-between"><dt>CGST</dt><dd>{formatInr(tax.cgstAmount)}</dd></div>}
            {Number(tax.sgstAmount || 0) > 0 && <div className="flex justify-between"><dt>SGST</dt><dd>{formatInr(tax.sgstAmount)}</dd></div>}
            {Number(tax.igstAmount || 0) > 0 && <div className="flex justify-between"><dt>IGST</dt><dd>{formatInr(tax.igstAmount)}</dd></div>}
            <div className="flex justify-between font-semibold text-charcoal"><dt>Grand Total</dt><dd>{formatInr(invoice.totalAmount)}</dd></div>
          </dl>
        </AdminCard>
        <AdminCard title="Payment">
          <p className="text-sm">Method: {invoice.order?.paymentMethod || "—"}</p>
          <p className="text-sm">Status: <StatusBadge value={invoice.order?.paymentStatus || "—"} /></p>
          {payment && (
            <>
              <p className="text-sm">Provider: {payment.provider || "—"}</p>
              <p className="text-sm">
                Reference: {payment.providerPaymentId || "—"}
              </p>
            </>
          )}
        </AdminCard>
      </div>

      <AdminCard title="Audit History" className="mt-4">
        {(!invoice.auditLogs || invoice.auditLogs.length === 0) && <p className="text-sm text-charcoal/60">No audit events recorded yet.</p>}
        {invoice.auditLogs && invoice.auditLogs.length > 0 && (
          <ul className="space-y-2 text-sm">
            {invoice.auditLogs.map((log) => (
              <li key={log.id} className="flex justify-between border-b border-charcoal/10 pb-1">
                <span>{log.action}</span>
                <span className="text-charcoal/60">{new Date(log.createdAt).toLocaleString("en-IN")}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}
