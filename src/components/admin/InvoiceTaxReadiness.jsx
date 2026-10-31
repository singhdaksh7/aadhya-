import { useState } from "react";
import { Link } from "react-router-dom";
import { adminApplyProductGstDefaults } from "../../lib/api";

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const GST_RATES = [0, 5, 12, 18, 28];

// Pure helper so the rules are testable without rendering.
export function getTaxIssues(settings, counts) {
  const issues = [];
  if (!settings.gstEnabled) issues.push({ code: "GST_DISABLED", level: "error", text: "GST is switched off. Invoices carry no tax unless a product has its own GST rate." });
  if (!String(settings.gstin || "").trim()) issues.push({ code: "GSTIN_MISSING", level: "error", text: "GSTIN is missing. Invoices will not be marked as Tax Invoices." });
  else if (!GSTIN_PATTERN.test(String(settings.gstin).trim().toUpperCase())) issues.push({ code: "GSTIN_INVALID", level: "error", text: "GSTIN is not a valid 15-character GSTIN." });
  if (!String(settings.state || "").trim()) issues.push({ code: "STATE_MISSING", level: "error", text: "Company state is missing. CGST/SGST vs IGST cannot be decided." });
  if (!(Number(settings.defaultTaxRate) > 0)) issues.push({ code: "DEFAULT_RATE_MISSING", level: "warning", text: "No default GST rate. Products without their own rate will show 'GST not configured'." });
  if (counts && counts.missingRate > 0) issues.push({ code: "PRODUCTS_MISSING_RATE", level: "warning", text: `${counts.missingRate} active product(s) have no GST rate.`, link: true });
  if (counts && counts.missingHsn > 0) issues.push({ code: "PRODUCTS_MISSING_HSN", level: "warning", text: `${counts.missingHsn} active product(s) have no HSN code.`, link: true });
  return issues;
}

export default function InvoiceTaxReadiness({ settings, counts, onApplied }) {
  const issues = getTaxIssues(settings, counts);
  const [rate, setRate] = useState("");
  const [hsn, setHsn] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const run = async (confirm) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const body = { confirm };
      if (rate !== "") body.gstRate = Number(rate);
      if (hsn.trim()) body.hsnCode = hsn.trim();
      const res = await adminApplyProductGstDefaults(body);
      if (confirm) {
        setPreview(null);
        setMsg(`Updated ${res.data.gstRateUpdated} product(s) with a GST rate and ${res.data.hsnUpdated} with an HSN code.`);
        onApplied?.();
      } else {
        setPreview(res.data);
      }
    } catch (e) {
      setErr(e.message || "Could not apply defaults.");
    } finally {
      setBusy(false);
    }
  };

  const hasMissing = counts && (counts.missingRate > 0 || counts.missingHsn > 0);

  return (
    <section className="admin-card space-y-3 p-5" data-testid="tax-readiness">
      <h2 className="admin-card__title border-b border-charcoal/10 pb-2">GST readiness</h2>
      {issues.length === 0 ? (
        <p className="text-sm text-emerald-700">GST is fully configured. Invoices will show CGST/SGST or IGST.</p>
      ) : (
        <ul className="space-y-1.5">
          {issues.map((i) => (
            <li key={i.code} role="alert" className={`rounded-lg px-3 py-2 text-sm ${i.level === "error" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
              {i.text}{" "}
              {i.link && (
                <Link to="/admin/products" className="underline">
                  Review products
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {hasMissing && (
        <div className="space-y-3 border-t border-charcoal/10 pt-3">
          <p className="text-sm font-medium text-charcoal">Apply a default to products that have none</p>
          <p className="text-xs text-charcoal-soft">Only products with no value are changed. Existing GST rates and HSN codes are never overwritten.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium uppercase tracking-wide text-charcoal-soft">
              GST rate
              <select aria-label="Default GST rate for products" value={rate} onChange={(e) => { setRate(e.target.value); setPreview(null); }} className="mt-1 w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm normal-case">
                <option value="">Do not set</option>
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium uppercase tracking-wide text-charcoal-soft">
              HSN code
              <input aria-label="Default HSN code for products" value={hsn} onChange={(e) => { setHsn(e.target.value); setPreview(null); }} placeholder="4-8 digits" className="mt-1 w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm normal-case" />
            </label>
          </div>
          {!preview && (
            <button type="button" disabled={busy || (rate === "" && !hsn.trim())} onClick={() => run(false)} className="admin-btn admin-btn--ghost">
              Preview changes
            </button>
          )}
          {preview && (
            <div className="space-y-2 rounded-lg bg-sage-light px-3 py-2 text-sm">
              <p>
                This will set the GST rate on {preview.wouldUpdateGstRate} product(s) and the HSN code on {preview.wouldUpdateHsn} product(s).
              </p>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => run(true)} className="admin-btn admin-btn--primary">
                  Confirm and apply
                </button>
                <button type="button" disabled={busy} onClick={() => setPreview(null)} className="admin-btn admin-btn--ghost">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {msg && <p className="text-sm text-emerald-700">{msg}</p>}
          {err && <p className="text-sm text-terracotta">{err}</p>}
        </div>
      )}
      {!hasMissing && msg && <p className="text-sm text-emerald-700">{msg}</p>}
    </section>
  );
}
