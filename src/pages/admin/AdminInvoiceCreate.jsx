import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminCreateManualInvoiceDraft,
  adminEditManualInvoiceDraft,
  adminIssueManualInvoice,
  adminListProducts,
  adminPreviewManualInvoice,
} from "../../lib/api";
import { formatInr } from "../../lib/format";
import { PageHeader, AdminCard } from "../../components/admin/ui";

const emptyCustomProduct = () => ({
  mode: "custom",
  productId: "",
  productLabel: "",
  itemName: "",
  hsnCode: "",
  unit: "PCS",
  quantity: 1,
  unitPrice: "",
  gstRate: "",
});

export default function AdminInvoiceCreate() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", state: "", stateCode: "" });
  const [invoiceMeta, setInvoiceMeta] = useState({ date: new Date().toISOString().slice(0, 10), paymentMethod: "cash", paymentReference: "", notes: "" });
  const [items, setItems] = useState([emptyCustomProduct()]);
  const [productResults, setProductResults] = useState({});
  const [draft, setDraft] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  // Live, informational-only tax preview: debounce-calls the real backend
  // preview endpoint (POST /admin/invoices/manual/preview), which runs the
  // exact same computeItemTaxLine/isInterState logic the draft/issue
  // endpoints use, so these numbers are guaranteed to match what gets
  // persisted on submit (no separate frontend rounding logic to drift).
  // The backend stays authoritative — this panel is never submitted itself.
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const previewTimer = useRef(null);

  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    const payload = buildPayload();
    if (!payload.items.length) {
      setPreview(null);
      setPreviewError("");
      return undefined;
    }
    previewTimer.current = setTimeout(async () => {
      try {
        const res = await adminPreviewManualInvoice({ customer: payload.customer, items: payload.items });
        setPreview(res.data);
        setPreviewError("");
      } catch (err) {
        setPreview(null);
        setPreviewError(err.message || "Could not compute preview");
      }
    }, 400);
    return () => clearTimeout(previewTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, items]);

  const updateItem = (idx, patch) => setItems((rows) => rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const addRow = () => setItems((rows) => [...rows, emptyCustomProduct()]);
  const removeRow = (idx) => setItems((rows) => rows.filter((_, i) => i !== idx));

  async function searchProducts(idx, term) {
    updateItem(idx, { productLabel: term });
    if (!term || term.length < 2) return;
    try {
      const res = await adminListProducts({ search: term, limit: 8 });
      setProductResults((prev) => ({ ...prev, [idx]: res.data || [] }));
    } catch {
      // best-effort search; ignore failures
    }
  }

  function pickProduct(idx, product) {
    updateItem(idx, {
      mode: "existing",
      productId: product.id,
      productLabel: `${product.name}${product.sku ? ` (${product.sku})` : ""}`,
      itemName: product.invoiceName || product.name,
      hsnCode: product.hsnCode || "",
      unit: product.unit || "PCS",
      unitPrice: String(product.salePrice ?? product.price ?? ""),
      gstRate: product.gstRate != null ? String(product.gstRate) : "",
    });
    setProductResults((prev) => ({ ...prev, [idx]: [] }));
  }

  function switchToCustom(idx) {
    updateItem(idx, { mode: "custom", productId: "", productLabel: "" });
  }

  function buildPayload() {
    return {
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone || undefined,
        state: customer.state || undefined,
        stateCode: customer.stateCode || undefined,
      },
      invoice: {
        date: invoiceMeta.date || undefined,
        paymentMethod: invoiceMeta.paymentMethod || undefined,
        paymentReference: invoiceMeta.paymentReference || undefined,
        notes: invoiceMeta.notes || undefined,
      },
      items: items
        .filter((row) => (row.mode === "existing" ? row.productId : row.itemName))
        .map((row) =>
          row.mode === "existing"
            ? { productId: row.productId, quantity: Number(row.quantity || 1), salePrice: row.unitPrice !== "" ? Number(row.unitPrice) : undefined }
            : {
                itemName: row.itemName,
                hsnCode: row.hsnCode || undefined,
                unit: row.unit || undefined,
                quantity: Number(row.quantity || 1),
                unitPrice: Number(row.unitPrice || 0),
                gstRate: row.gstRate !== "" ? Number(row.gstRate) : undefined,
              }
        ),
    };
  }

  async function saveDraft() {
    setStatus("saving");
    setError("");
    try {
      const payload = buildPayload();
      const result = draft
        ? await adminEditManualInvoiceDraft(draft.id, payload)
        : await adminCreateManualInvoiceDraft(payload);
      setDraft(result);
      setStatus("saved");
    } catch (err) {
      setError(err.message || "Could not save draft");
      setStatus("idle");
    }
  }

  async function issue(sendEmail) {
    setStatus("issuing");
    setError("");
    try {
      let current = draft;
      const payload = buildPayload();
      current = current ? await adminEditManualInvoiceDraft(current.id, payload) : await adminCreateManualInvoiceDraft(payload);
      const issued = await adminIssueManualInvoice(current.id, { sendEmail });
      setDraft(issued);
      setStatus("issued");
      navigate(`/admin/invoices/${issued.id}`);
    } catch (err) {
      setError(err.message || "Could not issue invoice");
      setStatus("idle");
    }
  }

  const isIssued = draft?.status === "ISSUED";

  return (
    <div>
      <PageHeader eyebrow="Sales" title="Create Invoice" description="Manual/offline invoice for a sale that did not go through checkout." />
      {error && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {isIssued && <p className="mb-3 rounded-xl bg-sage-light px-3 py-2 text-sm text-green-deep">Invoice {draft.invoiceNumber} issued.</p>}

      <AdminCard title="Customer" className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input className="admin-input" placeholder="Name" value={customer.name} disabled={isIssued} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} />
          <input className="admin-input" placeholder="Email" value={customer.email} disabled={isIssued} onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))} />
          <input className="admin-input" placeholder="Phone" value={customer.phone} disabled={isIssued} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} />
          <input className="admin-input" placeholder="State (for CGST/SGST vs IGST)" value={customer.state} disabled={isIssued} onChange={(e) => setCustomer((c) => ({ ...c, state: e.target.value }))} />
          <input className="admin-input" placeholder="State code" value={customer.stateCode} disabled={isIssued} onChange={(e) => setCustomer((c) => ({ ...c, stateCode: e.target.value }))} />
        </div>
      </AdminCard>

      <AdminCard title="Invoice details" className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="date" className="admin-input" value={invoiceMeta.date} disabled={isIssued} onChange={(e) => setInvoiceMeta((m) => ({ ...m, date: e.target.value }))} />
          <input className="admin-input" placeholder="Payment method" value={invoiceMeta.paymentMethod} disabled={isIssued} onChange={(e) => setInvoiceMeta((m) => ({ ...m, paymentMethod: e.target.value }))} />
          <input className="admin-input" placeholder="Payment reference" value={invoiceMeta.paymentReference} disabled={isIssued} onChange={(e) => setInvoiceMeta((m) => ({ ...m, paymentReference: e.target.value }))} />
          <input className="admin-input" placeholder="Notes" value={invoiceMeta.notes} disabled={isIssued} onChange={(e) => setInvoiceMeta((m) => ({ ...m, notes: e.target.value }))} />
        </div>
      </AdminCard>

      <AdminCard title="Items" className="mb-4">
        <div className="space-y-3">
          {items.map((row, idx) => (
            <div key={idx} className="rounded-xl border border-sand-dark/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex gap-2 text-xs">
                  <button type="button" disabled={isIssued} className={`admin-btn admin-btn--ghost ${row.mode === "existing" ? "font-semibold" : ""}`} onClick={() => switchToCustom(idx)}>
                    Custom item
                  </button>
                </div>
                {items.length > 1 && !isIssued && (
                  <button type="button" className="text-xs text-rose-600" onClick={() => removeRow(idx)}>
                    Remove
                  </button>
                )}
              </div>
              {row.mode === "existing" ? (
                <div className="mb-2 rounded-lg bg-sand-light px-3 py-2 text-sm">
                  Selected product: <strong>{row.productLabel}</strong>
                </div>
              ) : (
                <div className="relative mb-2">
                  <input className="admin-input w-full" placeholder="Search existing product to autofill (optional)" disabled={isIssued} value={row.productLabel} onChange={(e) => searchProducts(idx, e.target.value)} />
                  {productResults[idx]?.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-sand-dark/40 bg-white shadow-lg">
                      {productResults[idx].map((p) => (
                        <button type="button" key={p.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-sand-light" onClick={() => pickProduct(idx, p)}>
                          {p.name} {p.sku ? `(${p.sku})` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <input className="admin-input" placeholder="Item name" disabled={isIssued || row.mode === "existing"} value={row.itemName} onChange={(e) => updateItem(idx, { itemName: e.target.value })} />
                <input className="admin-input" placeholder="HSN" disabled={isIssued} value={row.hsnCode} onChange={(e) => updateItem(idx, { hsnCode: e.target.value })} />
                <input className="admin-input" placeholder="Unit" disabled={isIssued} value={row.unit} onChange={(e) => updateItem(idx, { unit: e.target.value })} />
                <input type="number" min="1" className="admin-input" placeholder="Qty" disabled={isIssued} value={row.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} />
                <input type="number" step="0.01" className="admin-input" placeholder="Unit price" disabled={isIssued} value={row.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: e.target.value })} />
                <input type="number" step="0.01" className="admin-input" placeholder="GST %" disabled={isIssued} value={row.gstRate} onChange={(e) => updateItem(idx, { gstRate: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
        {!isIssued && (
          <button type="button" className="admin-btn admin-btn--ghost mt-3" onClick={addRow}>
            + Add item
          </button>
        )}
      </AdminCard>

      {!isIssued && (
        <AdminCard title="Tax Preview (estimate)" className="mb-4">
          <p className="mb-3 text-xs text-charcoal-soft">
            Computed live from the same tax engine used at issue time — informational only, the server recalculates
            authoritatively when you save or issue.
          </p>
          {previewError && <p className="text-sm text-rose-600">{previewError}</p>}
          {!previewError && !preview && <p className="text-sm text-charcoal-soft">Add at least one item to see a preview.</p>}
          {preview && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${preview.interState ? "bg-amber-100 text-amber-800" : "bg-sage-light text-green-deep"}`}>
                  {preview.interState ? "Inter-state supply (IGST)" : "Intra-state supply (CGST + SGST)"}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-sand-dark/40 text-charcoal-soft">
                      <th className="py-1 pr-2">Item</th>
                      <th className="py-1 pr-2">HSN</th>
                      <th className="py-1 pr-2">Qty</th>
                      <th className="py-1 pr-2">Rate</th>
                      <th className="py-1 pr-2">Pricing</th>
                      <th className="py-1 pr-2">Taxable</th>
                      <th className="py-1 pr-2">GST%</th>
                      <th className="py-1 pr-2">Tax</th>
                      <th className="py-1 pr-2">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((it, i) => (
                      <tr key={i} className="border-b border-sand-dark/20">
                        <td className="py-1 pr-2">{it.productName}</td>
                        <td className="py-1 pr-2">{it.hsnCode || "-"}</td>
                        <td className="py-1 pr-2">{it.quantity}</td>
                        <td className="py-1 pr-2">{formatInr(it.unitPrice)}</td>
                        <td className="py-1 pr-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${it.taxPricingMode === "TAX_INCLUSIVE" ? "bg-blue-100 text-blue-800" : "bg-stone-100 text-stone-700"}`}>
                            {it.taxPricingMode === "TAX_INCLUSIVE" ? "Tax Inclusive" : "Tax Exclusive"}
                          </span>
                        </td>
                        <td className="py-1 pr-2">{formatInr(it.taxableValue)}</td>
                        <td className="py-1 pr-2">{it.gstRate != null ? `${it.gstRate}%` : "-"}</td>
                        <td className="py-1 pr-2">{formatInr(it.taxAmount)}</td>
                        <td className="py-1 pr-2">{formatInr(it.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>Subtotal (taxable): {formatInr(preview.subtotal)}</div>
                {Number(preview.tax.cgstAmount) > 0 && <div>CGST: {formatInr(preview.tax.cgstAmount)}</div>}
                {Number(preview.tax.sgstAmount) > 0 && <div>SGST: {formatInr(preview.tax.sgstAmount)}</div>}
                {Number(preview.tax.igstAmount) > 0 && <div>IGST: {formatInr(preview.tax.igstAmount)}</div>}
                <div>Total Tax: {formatInr(preview.taxAmount)}</div>
                <div className="font-semibold">Grand Total: {formatInr(preview.totalAmount)}</div>
              </div>
            </div>
          )}
        </AdminCard>
      )}

      {draft && (
        <AdminCard title="Computed totals" className="mb-4">
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>Subtotal: {formatInr(draft.subtotal)}</div>
            <div>Tax: {formatInr(draft.taxAmount)}</div>
            <div>Total: {formatInr(draft.totalAmount)}</div>
            <div>Status: {draft.status}</div>
          </div>
        </AdminCard>
      )}

      {!isIssued && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="admin-btn admin-btn--ghost" disabled={status === "saving" || status === "issuing"} onClick={saveDraft}>
            {draft ? "Update Draft" : "Save as Draft"}
          </button>
          <button type="button" className="admin-btn admin-btn--primary" disabled={status === "saving" || status === "issuing"} onClick={() => issue(true)}>
            Issue &amp; Send
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" disabled={status === "saving" || status === "issuing"} onClick={() => issue(false)}>
            Issue Without Email
          </button>
        </div>
      )}
    </div>
  );
}
