import { useEffect, useState } from "react";
import {
  adminListBookFormats,
  adminUpsertBookFormat,
  adminDeleteBookFormat,
  adminUploadBookFormatPdf,
  adminRemoveBookFormatPdf,
} from "../../lib/api";
import { Button } from "../../components/ui";

const inputCls =
  "w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-charcoal/40 focus:outline-none";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">{label}</span>
      {children}
    </label>
  );
}

const emptyPhysical = { price: "", salePrice: "", mrp: "", sku: "", stockQuantity: "0", lowStockThreshold: "", trackInventory: true, weightGrams: "", isActive: true };
const emptyPdf = { price: "", salePrice: "", mrp: "", sku: "", maxDownloads: "", expiryDays: "", isActive: true };

// Book Formats tab: two checkboxes (Physical Book / PDF Digital), at least
// one required. Each enabled format gets its own price/stock (physical) or
// price/upload (PDF) fields, saved independently via PUT .../book-formats/:format.
export default function BookFormatsTab({ productId }) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState({ PHYSICAL: false, PDF: false });
  const [physical, setPhysical] = useState(emptyPhysical);
  const [pdf, setPdf] = useState(emptyPdf);
  const [pdfInfo, setPdfInfo] = useState(null); // { pdfOriginalName, hasPdfFile }
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    adminListBookFormats(productId)
      .then((res) => {
        const rows = res.data || [];
        const p = rows.find((r) => r.format === "PHYSICAL");
        const d = rows.find((r) => r.format === "PDF");
        setEnabled({ PHYSICAL: Boolean(p), PDF: Boolean(d) });
        if (p) {
          setPhysical({
            price: String(p.price ?? ""),
            salePrice: p.salePrice != null ? String(p.salePrice) : "",
            mrp: p.mrp != null ? String(p.mrp) : "",
            sku: p.sku || "",
            stockQuantity: String(p.stockQuantity ?? 0),
            lowStockThreshold: p.lowStockThreshold != null ? String(p.lowStockThreshold) : "",
            trackInventory: p.trackInventory ?? true,
            weightGrams: p.weightGrams != null ? String(p.weightGrams) : "",
            isActive: p.isActive ?? true,
          });
        }
        if (d) {
          setPdf({
            price: String(d.price ?? ""),
            salePrice: d.salePrice != null ? String(d.salePrice) : "",
            mrp: d.mrp != null ? String(d.mrp) : "",
            sku: d.sku || "",
            maxDownloads: d.maxDownloads != null ? String(d.maxDownloads) : "",
            expiryDays: d.expiryDays != null ? String(d.expiryDays) : "",
            isActive: d.isActive ?? true,
          });
          setPdfInfo({ hasPdfFile: d.hasPdfFile, pdfOriginalName: d.pdfOriginalName });
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [productId]);

  const toggle = (format) => setEnabled((e) => ({ ...e, [format]: !e[format] }));

  const save = async () => {
    setError(null);
    setMessage(null);
    if (!enabled.PHYSICAL && !enabled.PDF) {
      setError("Select at least one format: Physical Book or PDF/Digital.");
      return;
    }
    setSaving(true);
    try {
      if (enabled.PHYSICAL) {
        if (!physical.price) throw new Error("Physical format requires a price.");
        await adminUpsertBookFormat(productId, "PHYSICAL", {
          price: Number(physical.price),
          salePrice: physical.salePrice === "" ? null : Number(physical.salePrice),
          mrp: physical.mrp === "" ? null : Number(physical.mrp),
          sku: physical.sku || null,
          stockQuantity: Number(physical.stockQuantity || 0),
          lowStockThreshold: physical.lowStockThreshold === "" ? null : Number(physical.lowStockThreshold),
          trackInventory: physical.trackInventory,
          weightGrams: physical.weightGrams === "" ? null : Number(physical.weightGrams),
          isActive: physical.isActive,
        });
      } else {
        await adminDeleteBookFormat(productId, "PHYSICAL").catch(() => {});
      }

      if (enabled.PDF) {
        if (!pdf.price) throw new Error("PDF format requires a price.");
        await adminUpsertBookFormat(productId, "PDF", {
          price: Number(pdf.price),
          salePrice: pdf.salePrice === "" ? null : Number(pdf.salePrice),
          mrp: pdf.mrp === "" ? null : Number(pdf.mrp),
          sku: pdf.sku || null,
          maxDownloads: pdf.maxDownloads === "" ? null : Number(pdf.maxDownloads),
          expiryDays: pdf.expiryDays === "" ? null : Number(pdf.expiryDays),
          isActive: pdf.isActive,
        });
      } else {
        await adminDeleteBookFormat(productId, "PDF").catch(() => {});
      }
      setMessage("Book formats saved.");
      load();
    } catch (err) {
      setError(err.message || "Could not save book formats.");
    } finally {
      setSaving(false);
    }
  };

  const onUploadPdf = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const res = await adminUploadBookFormatPdf(productId, file);
      setPdfInfo({ hasPdfFile: res.data.hasPdfFile, pdfOriginalName: res.data.pdfOriginalName });
      setMessage("PDF uploaded.");
    } catch (err) {
      setError(err.message || "Could not upload PDF. Make sure it's a .pdf file under the size limit.");
    } finally {
      setUploading(false);
    }
  };

  const onRemovePdf = async () => {
    setError(null);
    try {
      await adminRemoveBookFormatPdf(productId);
      setPdfInfo({ hasPdfFile: false, pdfOriginalName: null });
    } catch (err) {
      setError(err.message || "Could not remove the PDF.");
    }
  };

  if (loading) return <p className="text-sm text-charcoal-soft">Loading book formats…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-charcoal/10 p-4">
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input type="checkbox" checked={enabled.PHYSICAL} onChange={() => toggle("PHYSICAL")} />
          Physical Book
        </label>
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input type="checkbox" checked={enabled.PDF} onChange={() => toggle("PDF")} />
          PDF / Digital
        </label>
      </div>

      {enabled.PHYSICAL && (
        <fieldset className="rounded-2xl border border-charcoal/10 p-4 space-y-4">
          <legend className="px-2 text-xs font-medium uppercase tracking-wide text-charcoal-soft">Physical Format</legend>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Price"><input type="number" min="0" step="0.01" value={physical.price} onChange={(e) => setPhysical((p) => ({ ...p, price: e.target.value }))} className={inputCls} /></Field>
            <Field label="Sale Price"><input type="number" min="0" step="0.01" value={physical.salePrice} onChange={(e) => setPhysical((p) => ({ ...p, salePrice: e.target.value }))} className={inputCls} /></Field>
            <Field label="MRP"><input type="number" min="0" step="0.01" value={physical.mrp} onChange={(e) => setPhysical((p) => ({ ...p, mrp: e.target.value }))} className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="SKU"><input value={physical.sku} onChange={(e) => setPhysical((p) => ({ ...p, sku: e.target.value }))} className={inputCls} /></Field>
            <Field label="Stock Quantity"><input type="number" min="0" value={physical.stockQuantity} onChange={(e) => setPhysical((p) => ({ ...p, stockQuantity: e.target.value }))} className={inputCls} /></Field>
            <Field label="Low Stock Threshold"><input type="number" min="0" value={physical.lowStockThreshold} onChange={(e) => setPhysical((p) => ({ ...p, lowStockThreshold: e.target.value }))} className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Weight (grams)"><input type="number" min="0" value={physical.weightGrams} onChange={(e) => setPhysical((p) => ({ ...p, weightGrams: e.target.value }))} className={inputCls} /></Field>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input type="checkbox" checked={physical.trackInventory} onChange={(e) => setPhysical((p) => ({ ...p, trackInventory: e.target.checked }))} /> Track Inventory
            </label>
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input type="checkbox" checked={physical.isActive} onChange={(e) => setPhysical((p) => ({ ...p, isActive: e.target.checked }))} /> Active
            </label>
          </div>
        </fieldset>
      )}

      {enabled.PDF && (
        <fieldset className="rounded-2xl border border-charcoal/10 p-4 space-y-4">
          <legend className="px-2 text-xs font-medium uppercase tracking-wide text-charcoal-soft">PDF / Digital Format</legend>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Price"><input type="number" min="0" step="0.01" value={pdf.price} onChange={(e) => setPdf((p) => ({ ...p, price: e.target.value }))} className={inputCls} /></Field>
            <Field label="Sale Price"><input type="number" min="0" step="0.01" value={pdf.salePrice} onChange={(e) => setPdf((p) => ({ ...p, salePrice: e.target.value }))} className={inputCls} /></Field>
            <Field label="MRP"><input type="number" min="0" step="0.01" value={pdf.mrp} onChange={(e) => setPdf((p) => ({ ...p, mrp: e.target.value }))} className={inputCls} /></Field>
          </div>
          <Field label="SKU"><input value={pdf.sku} onChange={(e) => setPdf((p) => ({ ...p, sku: e.target.value }))} className={inputCls} /></Field>

          <div className="rounded-xl border border-charcoal/10 p-4">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">PDF File</span>
            {pdfInfo?.hasPdfFile ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span>Current file: <strong>{pdfInfo.pdfOriginalName}</strong></span>
                <label className="cursor-pointer underline">
                  Replace
                  <input type="file" accept="application/pdf" className="hidden" onChange={onUploadPdf} />
                </label>
                <button type="button" onClick={onRemovePdf} className="text-terracotta underline">Remove</button>
              </div>
            ) : (
              <label className="inline-block cursor-pointer text-sm underline">
                {uploading ? "Uploading…" : "Upload PDF"}
                <input type="file" accept="application/pdf" className="hidden" onChange={onUploadPdf} disabled={uploading} />
              </label>
            )}
            <p className="mt-1 text-xs text-charcoal-soft">PDF only, up to 50MB. Files are stored privately and served only through secure, entitlement-checked download links — never a public URL.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Max Downloads"><input type="number" min="1" value={pdf.maxDownloads} onChange={(e) => setPdf((p) => ({ ...p, maxDownloads: e.target.value }))} placeholder="Unlimited" className={inputCls} /></Field>
            <Field label="Expiry (days after purchase)"><input type="number" min="1" value={pdf.expiryDays} onChange={(e) => setPdf((p) => ({ ...p, expiryDays: e.target.value }))} placeholder="Never" className={inputCls} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input type="checkbox" checked={pdf.isActive} onChange={(e) => setPdf((p) => ({ ...p, isActive: e.target.checked }))} /> Active
          </label>
        </fieldset>
      )}

      {error && <p className="text-sm text-terracotta">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <Button type="button" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save Book Formats"}</Button>
    </div>
  );
}
