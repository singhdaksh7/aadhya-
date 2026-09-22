import { useEffect, useState } from "react";
import { adminFetchSiteSettings, adminUpdateSiteSettings } from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";

const emptyForm = {
  announcementText: "",
  announcementActive: true,
  freeShippingThreshold: "2499",
  standardShippingAmount: "99",
  supportPhone: "",
  supportEmail: "",
};

export default function AdminSettings() {
  const [status, setStatus] = useState("loading");
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminFetchSiteSettings()
      .then((res) => {
        const s = res.data || {};
        setForm({
          announcementText: s.announcementBar?.text || "",
          announcementActive: s.announcementBar?.active ?? true,
          freeShippingThreshold: s.freeShippingThreshold != null ? String(s.freeShippingThreshold) : "2499",
          standardShippingAmount: s.standardShippingAmount != null ? String(s.standardShippingAmount) : "99",
          supportPhone: s.supportPhone || "",
          supportEmail: s.supportEmail || "",
        });
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const payload = {
      announcementBar: { text: form.announcementText, active: form.announcementActive },
      freeShippingThreshold: Number(form.freeShippingThreshold) || 0,
      standardShippingAmount: Number(form.standardShippingAmount) || 0,
    };
    if (form.supportPhone) payload.supportPhone = form.supportPhone;
    if (form.supportEmail) payload.supportEmail = form.supportEmail;
    try {
      await adminUpdateSiteSettings(payload);
      setSaved(true);
    } catch (err) {
      setError(err.message || "Could not save settings.");
    }
  };

  if (status === "loading") return <LoadingNotice />;
  if (status === "error") return <ErrorNotice message="Unable to load settings." />;

  return (
    <div>
      <h1 className="font-serif-display text-2xl text-charcoal">Site Settings</h1>

      <form onSubmit={onSubmit} className="mt-6 max-w-lg space-y-4 rounded-2xl border border-charcoal/10 p-5">
        <div>
          <p className="text-sm font-medium text-charcoal">Announcement Bar</p>
          <input
            placeholder="Announcement text"
            value={form.announcementText}
            onChange={(e) => setForm((f) => ({ ...f, announcementText: e.target.value }))}
            className={inputCls}
          />
          <label className="mt-2 flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={form.announcementActive}
              onChange={(e) => setForm((f) => ({ ...f, announcementActive: e.target.checked }))}
            />
            Show on storefront
          </label>
        </div>

        <div>
          <p className="text-sm font-medium text-charcoal">Shipping</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <input
              type="number"
              placeholder="Free shipping threshold (₹)"
              value={form.freeShippingThreshold}
              onChange={(e) => setForm((f) => ({ ...f, freeShippingThreshold: e.target.value }))}
              className={inputCls}
            />
            <input
              type="number"
              placeholder="Standard shipping fee (₹)"
              value={form.standardShippingAmount}
              onChange={(e) => setForm((f) => ({ ...f, standardShippingAmount: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-charcoal">Support Contact</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <input
              placeholder="Support phone"
              value={form.supportPhone}
              onChange={(e) => setForm((f) => ({ ...f, supportPhone: e.target.value }))}
              className={inputCls}
            />
            <input
              placeholder="Support email"
              value={form.supportEmail}
              onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        {error && <p className="text-sm text-terracotta">{error}</p>}
        {saved && <p className="text-sm text-green-deep">Settings saved.</p>}

        <Button>Save Settings</Button>
      </form>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-charcoal/40 focus:outline-none";
