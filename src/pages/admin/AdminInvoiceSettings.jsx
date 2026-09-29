import { useEffect, useState } from "react";
import { adminGetInvoiceSettings, adminSaveInvoiceSettings, adminFetchSiteSettings } from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import ImagePickerInput from "../../components/admin/ImagePickerInput";

// Client-side format checks mirroring server/src/modules/invoices/invoice.tax.js.
// These are convenience checks only — the zod schema on PUT /admin/invoices/settings
// remains the authoritative validation.
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const HSN_PATTERN = /^[0-9]{4,8}$/;
const STATE_CODE_PATTERN = /^\d{2}$/;
const GST_RATES = [0, 5, 12, 18, 28];

const emptyForm = {
  legalName: "",
  tradeName: "",
  gstin: "",
  pan: "",
  email: "",
  phone: "",
  website: "",
  address: "",
  city: "",
  state: "",
  stateCode: "",
  postalCode: "",
  country: "India",
  prefix: "",
  nextInvoiceNumber: "1",
  financialYearFormat: "YYYY-YY",
  gstEnabled: false,
  defaultTaxRate: "0",
  defaultTaxPricingMode: "TAX_EXCLUSIVE",
  shippingTaxRate: "0",
  shippingHsnCode: "",
  logoUrl: "",
  signatoryName: "",
  signatureUrl: "",
  footer: "",
  terms: "",
  codInvoiceAt: "CONFIRMED",
  bankName: "",
  bankAccountHolder: "",
  bankAccountNumber: "",
  bankIfsc: "",
  bankBranch: "",
  upiId: "",
};

export default function AdminInvoiceSettings() {
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("loading");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [minNextNumber, setMinNextNumber] = useState(1);
  const [generalGstin, setGeneralGstin] = useState("");
  const [gstinSuggestionDismissed, setGstinSuggestionDismissed] = useState(false);

  useEffect(() => {
    Promise.all([adminGetInvoiceSettings(), adminFetchSiteSettings().catch(() => null)])
      .then(([invRes, siteRes]) => {
        const data = invRes.data || {};
        setForm({
          ...emptyForm,
          ...Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, v == null ? emptyForm[k] ?? "" : String(v)])
          ),
          gstEnabled: Boolean(data.gstEnabled),
        });
        setMinNextNumber(Number(data.nextInvoiceNumber || 1));
        const generalGstinValue = siteRes?.data?.general?.GSTIN || "";
        setGeneralGstin(generalGstinValue);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err.message || "Failed to load invoice settings.");
        setStatus("error");
      });
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const useGeneralGstin = () => {
    set("gstin", generalGstin);
    setGstinSuggestionDismissed(true);
  };

  const errors = {};
  if (form.gstin && !GSTIN_PATTERN.test(form.gstin.trim().toUpperCase())) {
    errors.gstin = "Must be a valid 15-character GSTIN.";
  }
  if (form.stateCode && !STATE_CODE_PATTERN.test(form.stateCode.trim())) {
    errors.stateCode = "Must be a 2-digit GST state code.";
  }
  if (form.shippingHsnCode && !HSN_PATTERN.test(form.shippingHsnCode.trim())) {
    errors.shippingHsnCode = "Must be 4-8 digits.";
  }
  if (Number(form.nextInvoiceNumber) < minNextNumber) {
    errors.nextInvoiceNumber = `Cannot be rewound below the current sequence (${minNextNumber}). The number only ever increases.`;
  }

  const handleSave = async (e) => {
    e.preventDefault();
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload = {
        ...form,
        nextInvoiceNumber: Number(form.nextInvoiceNumber || 1),
        defaultTaxRate: Number(form.defaultTaxRate || 0),
        shippingTaxRate: Number(form.shippingTaxRate || 0),
        shippingHsnCode: form.shippingHsnCode || null,
        logoUrl: form.logoUrl || null,
        signatureUrl: form.signatureUrl || null,
      };
      const res = await adminSaveInvoiceSettings(payload);
      setMinNextNumber(Number(res.data.nextInvoiceNumber || 1));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || "Could not save invoice settings.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") return <LoadingNotice />;
  if (status === "error") return <ErrorNotice message={error} />;

  const showGstinSuggestion =
    !gstinSuggestionDismissed && generalGstin && !form.gstin && generalGstin !== form.gstin;

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__eyebrow">Sales</p>
          <h1 className="admin-page-header__title">Invoice Settings</h1>
        </div>
      </div>

      <form onSubmit={handleSave} className="mt-5 max-w-3xl space-y-4">
        {/* BUSINESS IDENTITY */}
        <section className="admin-card space-y-4 p-5">
          <h2 className="admin-card__title border-b border-charcoal/10 pb-2">Business Identity</h2>
          <Field label="Legal Business Name">
            <input required value={form.legalName} onChange={(e) => set("legalName", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Trade / Store Name (optional)">
            <input value={form.tradeName} onChange={(e) => set("tradeName", e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="GSTIN" error={errors.gstin}>
              <input
                value={form.gstin}
                onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                placeholder="15-character GSTIN"
                className={inputCls}
              />
              {showGstinSuggestion && (
                <p className="mt-1 text-xs text-charcoal-soft">
                  Found a GSTIN in general settings ({generalGstin}).{" "}
                  <button type="button" className="underline" onClick={useGeneralGstin}>
                    Use it here
                  </button>
                  . This does not copy automatically — save explicitly to apply.
                </p>
              )}
            </Field>
            <Field label="PAN">
              <input value={form.pan} onChange={(e) => set("pan", e.target.value.toUpperCase())} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Website">
            <input value={form.website} onChange={(e) => set("website", e.target.value)} className={inputCls} />
          </Field>
        </section>

        {/* REGISTERED ADDRESS */}
        <section className="admin-card space-y-4 p-5">
          <h2 className="admin-card__title border-b border-charcoal/10 pb-2">Registered Address</h2>
          <Field label="Address">
            <textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="City">
              <input value={form.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Postal Code">
              <input value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="State">
              <input value={form.state} onChange={(e) => set("state", e.target.value)} className={inputCls} />
            </Field>
            <Field label="State Code" error={errors.stateCode}>
              <input value={form.stateCode} onChange={(e) => set("stateCode", e.target.value)} placeholder="e.g. 27" className={inputCls} />
            </Field>
            <Field label="Country">
              <input value={form.country} onChange={(e) => set("country", e.target.value)} className={inputCls} />
            </Field>
          </div>
        </section>

        {/* INVOICE NUMBERING */}
        <section className="admin-card space-y-4 p-5">
          <h2 className="admin-card__title border-b border-charcoal/10 pb-2">Invoice Numbering</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prefix">
              <input required value={form.prefix} onChange={(e) => set("prefix", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Next Invoice Number" error={errors.nextInvoiceNumber}>
              <input
                type="number"
                min={minNextNumber}
                value={form.nextInvoiceNumber}
                onChange={(e) => set("nextInvoiceNumber", e.target.value)}
                className={inputCls}
              />
              <p className="mt-1 text-xs text-charcoal-soft">
                Monotonic only — the sequence never rewinds, so this cannot be set below {minNextNumber}.
              </p>
            </Field>
          </div>
          <Field label="Financial Year Format">
            <input value={form.financialYearFormat} onChange={(e) => set("financialYearFormat", e.target.value)} className={inputCls} />
            <p className="mt-1 text-xs text-charcoal-soft">Display format used in invoice numbers, e.g. 2025-26.</p>
          </Field>
          <Field label="Invoice created at (for COD orders)">
            <select value={form.codInvoiceAt} onChange={(e) => set("codInvoiceAt", e.target.value)} className={inputCls}>
              <option value="CONFIRMED">On order confirmation</option>
              <option value="SHIPPED">On shipment</option>
            </select>
          </Field>
        </section>

        {/* TAX DEFAULTS */}
        <section className="admin-card space-y-4 p-5">
          <h2 className="admin-card__title border-b border-charcoal/10 pb-2">Tax Defaults</h2>
          <Checkbox label="GST Enabled" checked={form.gstEnabled} onChange={(v) => set("gstEnabled", v)} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Default Tax Rate (%)">
              <select value={form.defaultTaxRate} onChange={(e) => set("defaultTaxRate", e.target.value)} className={inputCls}>
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Default Tax Pricing Mode">
              <select value={form.defaultTaxPricingMode} onChange={(e) => set("defaultTaxPricingMode", e.target.value)} className={inputCls}>
                <option value="TAX_EXCLUSIVE">Tax Exclusive</option>
                <option value="TAX_INCLUSIVE">Tax Inclusive</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Shipping Tax Rate (%)">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.shippingTaxRate}
                onChange={(e) => set("shippingTaxRate", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Shipping HSN Code" error={errors.shippingHsnCode}>
              <input value={form.shippingHsnCode} onChange={(e) => set("shippingHsnCode", e.target.value)} className={inputCls} />
            </Field>
          </div>
        </section>

        {/* BRANDING */}
        <section className="admin-card space-y-4 p-5">
          <h2 className="admin-card__title border-b border-charcoal/10 pb-2">Branding</h2>
          <ImagePickerInput label="Invoice Logo" value={form.logoUrl} onChange={(url) => set("logoUrl", url)} pickerTitle="Select invoice logo" inputClassName={inputCls} />
          <Field label="Authorized Signatory Name">
            <input value={form.signatoryName} onChange={(e) => set("signatoryName", e.target.value)} className={inputCls} />
          </Field>
          <ImagePickerInput label="Signature Image" value={form.signatureUrl} onChange={(url) => set("signatureUrl", url)} pickerTitle="Select signature image" inputClassName={inputCls} />
          <Field label="Footer Text">
            <textarea rows={2} value={form.footer} onChange={(e) => set("footer", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Terms & Conditions">
            <textarea rows={3} value={form.terms} onChange={(e) => set("terms", e.target.value)} className={inputCls} />
          </Field>
        </section>

        {/* BANK / PAYMENT DETAILS */}
        <section className="admin-card space-y-4 p-5">
          <h2 className="admin-card__title border-b border-charcoal/10 pb-2">Bank / Payment Details</h2>
          <p className="text-xs text-charcoal-soft">
            Optional. Printed on invoices only — not treated as a secret and not encrypted (unlike payment gateway credentials
            under Integrations).
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Bank Name">
              <input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Account Holder">
              <input value={form.bankAccountHolder} onChange={(e) => set("bankAccountHolder", e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Account Number">
              <input value={form.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} className={inputCls} />
            </Field>
            <Field label="IFSC">
              <input value={form.bankIfsc} onChange={(e) => set("bankIfsc", e.target.value.toUpperCase())} className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Branch">
              <input value={form.bankBranch} onChange={(e) => set("bankBranch", e.target.value)} className={inputCls} />
            </Field>
            <Field label="UPI ID">
              <input value={form.upiId} onChange={(e) => set("upiId", e.target.value)} className={inputCls} />
            </Field>
          </div>
        </section>

        {error && <p className="text-sm text-terracotta">{error}</p>}
        {saved && <p className="text-sm text-emerald-700">Invoice settings saved.</p>}

        <div className="admin-sticky-actions">
          <Button disabled={saving || Object.keys(errors).length > 0}>{saving ? "Saving…" : "Save Invoice Settings"}</Button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-charcoal/40 focus:outline-none";

function Field({ label, children, error }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">{label}</span>
      {children}
      {error && <p className="mt-1 text-xs text-terracotta">{error}</p>}
    </label>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-charcoal">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
