import { useCallback, useEffect, useState } from "react";
import { adminListEmailTemplates, adminSaveEmailTemplate, adminToggleEmailTemplate, adminPreviewEmailTemplate, adminResetEmailTemplate, adminSendTemplateTest } from "../../lib/api";
import { AdminCard, PageHeader, StatusBadge } from "../../components/admin/ui";

// Admin → Email Templates. Wording (subject, heading, message) is editable with whitelisted {{placeholders}};
// layout, order summary, login-code box and safety rules stay in code. Security emails cannot be switched off.
export default function AdminEmailTemplates() {
  const [templates, setTemplates] = useState([]);
  const [variables, setVariables] = useState({});
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ subject: "", heading: "", body: "" });
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [testTo, setTestTo] = useState("");

  const load = useCallback(async (keepKey) => {
    try {
      const res = await adminListEmailTemplates();
      setTemplates(res.data.templates);
      setVariables(res.data.variables);
      const key = keepKey || res.data.templates[0]?.key;
      const t = res.data.templates.find((x) => x.key === key);
      if (t) {
        setSelected(t.key);
        setForm({ subject: t.subject, heading: t.heading, body: t.body });
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = templates.find((t) => t.key === selected);

  const run = async (name, fn) => {
    setBusy(name);
    setMessage("");
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const pick = (t) => {
    setSelected(t.key);
    setForm({ subject: t.subject, heading: t.heading, body: t.body });
    setPreview(null);
    setMessage("");
    setError("");
  };

  const refreshPreview = () => run("preview", async () => setPreview((await adminPreviewEmailTemplate(selected, form)).data));
  const save = () =>
    run("save", async () => {
      await adminSaveEmailTemplate(selected, { ...form, enabled: current.enabled });
      setMessage("Template saved.");
      await load(selected);
      setPreview(null);
    });
  const toggle = () =>
    run("toggle", async () => {
      await adminToggleEmailTemplate(selected, !current.enabled);
      await load(selected);
    });
  const reset = () =>
    run("reset", async () => {
      if (!window.confirm("Restore the default wording for this email?")) return;
      await adminResetEmailTemplate(selected);
      setMessage("Default wording restored.");
      await load(selected);
      setPreview(null);
    });
  const sendTest = () =>
    run("test", async () => {
      const res = await adminSendTemplateTest(selected, testTo.trim());
      setMessage(res.data.sent ? `Preview sent to ${testTo.trim()}.` : `Could not send (${res.data.reason || "error"}). Check Integrations → Email.`);
    });

  return (
    <div className="space-y-5" data-testid="admin-email-templates">
      <PageHeader title="Email Templates" description="Edit the wording of the emails customers receive. Layout and order details are added automatically." />
      {error && <p role="alert" className="rounded-xl bg-terracotta/10 px-3 py-2 text-sm text-terracotta">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-sage-light px-3 py-2 text-sm text-green-deep">{message}</p>}

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <AdminCard title="Emails">
          <ul className="space-y-1" aria-label="Email templates">
            {[...templates].sort((a, b) => (a.audience === "admin") - (b.audience === "admin")).map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => pick(t)}
                  aria-current={t.key === selected}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${t.key === selected ? "bg-charcoal text-white" : "hover:bg-charcoal/5"}`}
                >
                  <span>{t.label}</span>
                  <span className={`text-[10px] uppercase ${t.enabled ? "opacity-70" : "text-terracotta"}`}>{t.audience === "admin" ? (t.customized ? "edited" : "internal") : t.enabled ? (t.customized ? "edited" : "on") : "off"}</span>
                </button>
              </li>
            ))}
          </ul>
        </AdminCard>

        {current && (
          <div className="space-y-5">
            <AdminCard
              title={current.label}
              subtitle={current.audience === "admin" ? "Internal email to your alert recipients. Choose which events send it in Admin Email Alerts." : current.locked ? "Security email: always sent" : undefined}
              actions={<StatusBadge value={current.enabled ? "Enabled" : "Disabled"} tone={current.enabled ? "success" : "neutral"} />}
            >
              <div className="space-y-3">
                <label className="admin-label">
                  Subject
                  <input className="admin-input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </label>
                <label className="admin-label">
                  Heading
                  <input className="admin-input" value={form.heading} onChange={(e) => setForm({ ...form, heading: e.target.value })} />
                </label>
                <label className="admin-label">
                  Message
                  <textarea rows={7} className="admin-input" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
                  <span className="mt-1 block text-xs text-charcoal-soft">A blank line starts a new paragraph. Order details, tracking box, the login code and the button are added automatically.</span>
                </label>
                <details className="rounded-lg border border-charcoal/10 p-3 text-xs">
                  <summary className="cursor-pointer font-semibold text-charcoal">Placeholders you can use</summary>
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {Object.entries(variables).map(([name, desc]) => (
                      <li key={name}><code>{`{{${name}}}`}</code> <span className="text-charcoal-soft">— {desc}</span></li>
                    ))}
                  </ul>
                </details>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="admin-btn admin-btn--primary" onClick={save} disabled={busy === "save"}>Save</button>
                  <button type="button" className="admin-btn" onClick={refreshPreview} disabled={busy === "preview"}>Preview</button>
                  {!current.locked && current.audience !== "admin" && (
                    <button type="button" className="admin-btn" onClick={toggle} disabled={busy === "toggle"}>
                      {current.enabled ? "Switch off" : "Switch on"}
                    </button>
                  )}
                  {current.customized && <button type="button" className="admin-btn" onClick={reset} disabled={busy === "reset"}>Restore default</button>}
                </div>
                <div className="flex flex-wrap items-end gap-2 border-t border-charcoal/10 pt-3">
                  <label className="admin-label min-w-[220px] flex-1">
                    Send a preview to
                    <input type="email" className="admin-input" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
                  </label>
                  <button type="button" className="admin-btn" onClick={sendTest} disabled={!testTo || busy === "test"}>Send preview email</button>
                </div>
              </div>
            </AdminCard>

            {preview && (
              <AdminCard title="Preview" subtitle={`Subject: ${preview.subject}`}>
                <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="h-[560px] w-full rounded-lg border border-charcoal/10 bg-white" />
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer font-semibold text-charcoal">Plain-text version</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-ivory-dark/40 p-3">{preview.text}</pre>
                </details>
              </AdminCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
