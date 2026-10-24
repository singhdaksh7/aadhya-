import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminGetAdminNotifications,
  adminSaveAdminNotificationEvents,
  adminAddAdminNotificationRecipient,
  adminSetAdminNotificationRecipientEnabled,
  adminRemoveAdminNotificationRecipient,
} from "../../lib/api";
import { AdminCard, PageHeader, StatusBadge } from "../../components/admin/ui";

// Admin → Admin Email Alerts. Who receives internal order emails, and which events send one. Emails go out
// through the SMTP configured in Integrations → Email; the wording lives in Email Templates ("Admin: ...").
export default function AdminEmailNotifications() {
  const [data, setData] = useState(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      setData((await adminGetAdminNotifications()).data);
    } catch (err) {
      setError(err.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (name, fn, success) => {
    setBusy(name);
    setError("");
    setMessage("");
    try {
      const res = await fn();
      if (res?.data) setData(res.data);
      if (success) setMessage(success);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy("");
    }
  };

  const addRecipient = async (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return setError("Enter a valid email address.");
    if (await run("add", () => adminAddAdminNotificationRecipient(value), `${value} added.`)) setEmail("");
  };

  if (!data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Admin Email Alerts" />
        {error ? <p role="alert" className="rounded-xl bg-terracotta/10 px-3 py-2 text-sm text-terracotta">{error}</p> : <p className="text-sm text-charcoal-soft">Loading…</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="admin-email-notifications">
      <PageHeader title="Admin Email Alerts" description="Get an email when something important happens to an order. Customers never receive these." />
      {error && <p role="alert" className="rounded-xl bg-terracotta/10 px-3 py-2 text-sm text-terracotta">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-sage-light px-3 py-2 text-sm text-green-deep">{message}</p>}
      {!data.smtpConfigured && (
        <p className="rounded-xl bg-beige px-3 py-2 text-sm text-charcoal">Email sending is not set up yet. Configure it in <Link className="font-semibold underline" to="/admin/integrations">Integrations → Email</Link> before alerts can be delivered.</p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <AdminCard title="Recipients" subtitle="Everyone listed here receives the alerts you switch on.">
          <form noValidate onSubmit={addRecipient} className="flex flex-wrap items-end gap-2">
            <label className="admin-label min-w-[220px] flex-1">
              Email address
              <input type="email" className="admin-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="orders@example.com" />
            </label>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy === "add" || !email.trim()}>Add recipient</button>
          </form>
          {data.recipients.length === 0 ? (
            <p className="mt-4 text-sm text-charcoal-soft">No recipients yet. Add at least one address to start receiving alerts.</p>
          ) : (
            <ul className="mt-4 divide-y divide-charcoal/10" aria-label="Alert recipients">
              {data.recipients.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium text-charcoal">{r.email}</p>
                    <StatusBadge value={r.enabled ? "Receiving" : "Paused"} tone={r.enabled ? "success" : "neutral"} />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="admin-btn admin-btn--ghost" disabled={busy === r.id} onClick={() => run(r.id, () => adminSetAdminNotificationRecipientEnabled(r.id, !r.enabled))}>{r.enabled ? "Pause" : "Resume"}</button>
                    <button type="button" className="admin-btn admin-btn--danger" disabled={busy === r.id} onClick={() => window.confirm(`Remove ${r.email}?`) && run(r.id, () => adminRemoveAdminNotificationRecipient(r.id), `${r.email} removed.`)}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <AdminCard title="What to email me about" subtitle="Shipment scans are not included, only these milestones.">
          <ul className="divide-y divide-charcoal/10" aria-label="Alert types">
            {data.events.map((ev) => (
              <li key={ev.key} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-charcoal">{ev.label}</p>
                  <p className="mt-0.5 text-xs text-charcoal-soft">{ev.help}</p>
                </div>
                <label className="relative mt-1 inline-flex shrink-0 cursor-pointer items-center">
                  <input type="checkbox" role="switch" className="peer sr-only" aria-label={ev.label} checked={ev.enabled} disabled={busy === ev.key} onChange={(e) => run(ev.key, () => adminSaveAdminNotificationEvents({ [ev.key]: e.target.checked }))} />
                  <span className="h-6 w-11 rounded-full bg-charcoal/20 transition peer-checked:bg-terracotta peer-focus-visible:ring-2 peer-focus-visible:ring-terracotta/50" />
                  <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-charcoal-soft">Change the wording in <Link className="font-semibold underline" to="/admin/email-templates">Email Templates</Link> (the ones starting with “Admin:”). Delivery history is in the email log under <Link className="font-semibold underline" to="/admin/integrations">Integrations → Email</Link>.</p>
        </AdminCard>
      </div>
    </div>
  );
}
