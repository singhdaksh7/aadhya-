import { useEffect, useState } from "react";
import { adminGetSmtpSettings, adminSaveSmtpSettings, adminDeleteSmtpSettings } from "../../../lib/api";
import { StatusBadge } from "../ui";
import SecretField from "./SecretField";

const ENCRYPTION_OPTIONS = [
  ["STARTTLS", "STARTTLS (usually port 587, recommended)"],
  ["SSL_TLS", "SSL/TLS (usually port 465)"],
  ["NONE", "None (usually port 25, not recommended)"],
];
const DEFAULT_PORT = { STARTTLS: 587, SSL_TLS: 465, NONE: 25 };
const SOURCE_LABEL = { admin: "These saved settings are in use", env: "Server environment variables (SMTP_*) are in use", none: "No SMTP is configured - emails are not being sent" };

// Hostinger business/email hosting: the mailbox's full address is the username; port 465 uses SSL/TLS.
const HOSTINGER_PRESET = { host: "smtp.hostinger.com", port: 465, encryption: "SSL_TLS" };

const empty = { enabled: true, host: "", port: 587, encryption: "STARTTLS", user: "", password: "", fromName: "", fromEmail: "", replyTo: "" };

// Admin-managed SMTP. The password is write-only: it is encrypted at rest and never sent back to the browser;
// leaving the field blank keeps the stored one.
export default function SmtpSettingsForm({ onSaved }) {
  const [form, setForm] = useState(empty);
  const [meta, setMeta] = useState({ saved: false, hasPassword: false, effectiveSource: "none" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const apply = (data) => {
    setMeta({ saved: data.saved, hasPassword: data.hasPassword, effectiveSource: data.effectiveSource });
    setForm({ ...empty, ...(data.saved ? { enabled: data.enabled, host: data.host, port: data.port, encryption: data.encryption, user: data.user, fromName: data.fromName, fromEmail: data.fromEmail, replyTo: data.replyTo } : {}), password: "" });
  };

  useEffect(() => {
    adminGetSmtpSettings().then((r) => apply(r.data)).catch((e) => setError(e.message));
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setEncryption = (e) => {
    const encryption = e.target.value;
    setForm((f) => ({ ...f, encryption, port: Object.values(DEFAULT_PORT).includes(Number(f.port)) ? DEFAULT_PORT[encryption] : f.port }));
  };

  const useHostingerPreset = () =>
    setForm((f) => ({ ...f, ...HOSTINGER_PRESET, user: f.user || f.fromEmail, fromEmail: f.fromEmail || f.user, fromName: f.fromName || "Tushaqsa" }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await adminSaveSmtpSettings({ ...form, port: Number(form.port) });
      apply(res.data);
      setMessage("SMTP settings saved. Use \"Send test email\" below to confirm they work.");
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Remove the saved SMTP settings? Emails will fall back to the server environment settings, if any.")) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await adminDeleteSmtpSettings();
      apply(res.data);
      setMessage("Saved SMTP settings removed.");
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="mb-6 rounded-2xl border border-[var(--theme-border)] p-4" data-testid="smtp-settings-form">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-charcoal">SMTP settings</h3>
        <StatusBadge value={SOURCE_LABEL[meta.effectiveSource] || meta.effectiveSource} tone={meta.effectiveSource === "none" ? "neutral" : "success"} />
      </div>
      {message && <p role="status" className="mb-3 rounded-xl bg-sage-light px-3 py-2 text-sm text-green-deep">{message}</p>}
      {error && <p role="alert" className="mb-3 rounded-xl bg-terracotta/10 px-3 py-2 text-sm text-terracotta">{error}</p>}

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-charcoal-soft">
        <button type="button" className="admin-btn admin-btn--ghost" onClick={useHostingerPreset}>Use Hostinger settings</button>
        <span>Fills host smtp.hostinger.com, port 465, SSL/TLS. Then enter your mailbox address and its password.</span>
      </div>

      <div className="admin-form-grid sm:grid-cols-2">
        <label className="admin-label sm:col-span-2 flex items-center gap-2">
          <input type="checkbox" checked={form.enabled} onChange={set("enabled")} />
          Enable these SMTP settings
        </label>
        <label className="admin-label">
          SMTP host
          <input required className="admin-input" value={form.host} onChange={set("host")} placeholder="smtp.yourprovider.com" autoComplete="off" />
        </label>
        <label className="admin-label">
          Port
          <input required type="number" min="1" max="65535" className="admin-input" value={form.port} onChange={set("port")} />
        </label>
        <label className="admin-label sm:col-span-2">
          Encryption
          <select className="admin-input" value={form.encryption} onChange={setEncryption}>
            {ENCRYPTION_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="admin-label">
          Username
          <input className="admin-input" value={form.user} onChange={set("user")} autoComplete="off" placeholder="Usually your full email address" />
        </label>
        <SecretField label="Password" configured={meta.hasPassword} mask="••••••••" value={form.password} onChange={set("password")} placeholder={meta.hasPassword ? "Leave blank to keep the saved password" : "SMTP password or app password"} />
        <label className="admin-label">
          From name
          <input className="admin-input" value={form.fromName} onChange={set("fromName")} placeholder="Defaults to your store name" />
        </label>
        <label className="admin-label">
          From email
          <input required type="email" className="admin-input" value={form.fromEmail} onChange={set("fromEmail")} placeholder="orders@yourdomain.com" />
        </label>
        <label className="admin-label sm:col-span-2">
          Reply-to email (optional)
          <input type="email" className="admin-input" value={form.replyTo} onChange={set("replyTo")} placeholder="support@yourdomain.com" />
        </label>
      </div>
      <p className="mt-2 text-xs text-charcoal-soft">The password is stored encrypted and is never shown again. Order confirmations, invoices, password resets and login codes are sent through these settings.</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>{busy ? "Saving…" : "Save SMTP settings"}</button>
        {meta.saved && <button type="button" className="admin-btn" onClick={remove} disabled={busy}>Remove saved settings</button>}
      </div>
    </form>
  );
}
