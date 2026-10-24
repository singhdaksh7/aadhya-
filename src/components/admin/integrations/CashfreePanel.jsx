import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminCashfreeSummary,
  adminCashfreeSave,
  adminCashfreeTest,
  adminCashfreeSetMode,
  adminCashfreeRemove,
  adminCashfreeVerifySetup,
  adminCashfreeWebhookEvents,
} from "../../../lib/api";
import { AdminCard, StatusBadge } from "../ui";
import SecretField from "./SecretField";

const OUTCOME_LABEL = {
  CONNECTED: "Connected",
  AUTH_FAILED: "Authentication failed - check the App ID and Secret Key",
  MISSING_CREDENTIALS: "Missing credentials - save an App ID and Secret Key first",
  UNREACHABLE: "Cashfree could not be reached - try again shortly",
  INVALID_CONFIG: "Configuration invalid - the credentials do not match this mode",
};
const RESULT_TONE = { PROCESSED: "success", IGNORED: "neutral", DUPLICATE: "neutral", FAILED: "danger", REJECTED: "danger" };
const fmt = (value) => (value ? new Date(value).toLocaleString("en-IN") : "—");

function ModeBadge({ mode }) {
  return mode === "LIVE" ? <StatusBadge tone="danger">LIVE MODE (real money)</StatusBadge> : <StatusBadge tone="warning">TEST MODE (sandbox)</StatusBadge>;
}

function Row({ label, children }) {
  return (
    <div>
      <dt className="font-medium text-charcoal">{label}</dt>
      <dd className="text-charcoal-soft">{children}</dd>
    </div>
  );
}

export default function CashfreePanel({ onChanged }) {
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [editing, setEditing] = useState("TEST");
  const [form, setForm] = useState({ appId: "", secretKey: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmMode, setConfirmMode] = useState(null);
  const [verify, setVerify] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([adminCashfreeSummary(), adminCashfreeWebhookEvents(15)]);
      setSummary(s.data);
      setEvents(e.data.items);
      return s.data;
    } catch (err) {
      setMessage(err.message);
      return null;
    }
  }, []);

  useEffect(() => {
    load().then((s) => s?.mode && setEditing(s.mode));
  }, [load]);

  useEffect(() => {
    setForm({ appId: summary?.environments?.[editing]?.appId || "", secretKey: "" });
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, summary?.environments?.[editing]?.appId]);

  const run = async (key, fn) => {
    setBusy(key);
    setMessage("");
    try {
      await fn();
    } catch (err) {
      setMessage(err.message);
      if (err.details && typeof err.details === "object") setErrors(err.details);
    } finally {
      setBusy("");
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("Copy failed - select the text and copy it manually.");
    }
  };

  if (!summary) {
    return (
      <AdminCard title="Cashfree Payments">
        <p className="text-sm text-charcoal-soft">{message || "Loading Cashfree settings..."}</p>
      </AdminCard>
    );
  }

  const env = summary.environments[editing];
  const active = summary.environments[summary.mode];
  const hook = summary.webhook;

  const save = (e) => {
    e.preventDefault();
    run("save", async () => {
      setErrors({});
      const body = { environment: editing };
      const appId = form.appId.trim();
      const secretKey = form.secretKey.trim();
      // A blank Secret Key keeps the stored one; the App ID is only sent when it changed.
      if (appId && (appId !== env.appId || secretKey)) body.appId = appId;
      if (secretKey) body.secretKey = secretKey;
      if (Object.keys(body).length === 1) {
        setMessage("Nothing to save - enter a new value first.");
        return;
      }
      await adminCashfreeSave(body);
      setMessage(`Cashfree ${editing} settings saved securely.`);
      await load();
      onChanged?.();
    });
  };

  const switchMode = (target) =>
    run("mode", async () => {
      await adminCashfreeSetMode(target);
      setConfirmMode(null);
      setMessage(`Cashfree is now in ${target} mode.`);
      await load();
      onChanged?.();
    });

  const remove = () =>
    run("remove", async () => {
      if (!window.confirm(`Remove the stored Cashfree ${editing} credentials? Online payment stops working in ${editing} mode until you add them again.`)) return;
      await adminCashfreeRemove(editing);
      setMessage(`Cashfree ${editing} credentials removed.`);
      await load();
      onChanged?.();
    });

  const toggleEnabled = () =>
    run("enabled", async () => {
      await adminCashfreeSave({ environment: editing, enabled: !env.enabled });
      await load();
      onChanged?.();
    });

  return (
    <div className="space-y-4">
      {message && (
        <p role="status" aria-live="polite" className="rounded-xl bg-sage-light px-3 py-2 text-sm text-green-deep">
          {message}
        </p>
      )}

      <AdminCard title="Cashfree Payments" subtitle="Online payments (UPI, cards, net banking, wallets)" actions={<ModeBadge mode={summary.mode} />}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3" aria-label="Cashfree configuration summary">
          <Row label="Active mode">{summary.mode === "LIVE" ? "LIVE" : "TEST (default)"}</Row>
          <Row label="API credentials">{active?.configured ? (active.enabled ? "Configured" : "Configured but disabled") : "Not configured"}</Row>
          <Row label="Connection">
            {active?.testStatus === "SUCCESS" ? "Connected" : active?.testStatus === "FAILED" ? "Last test failed" : "Not tested"}
            {active?.lastTestedAt ? ` · ${fmt(active.lastTestedAt)}` : ""}
          </Row>
          <Row label="Online payment at checkout">{summary.onlinePaymentAvailable ? "Available to customers" : "Hidden from customers (not ready)"}</Row>
          <Row label="Last webhook">{hook.lastReceivedAt ? `${fmt(hook.lastReceivedAt)}${hook.lastEventType ? ` · ${hook.lastEventType}` : ""}` : "None received yet"}</Row>
          <Row label="Payment method">
            {summary.paymentMethods.cashfreeEnabled ? "Enabled" : "Disabled"} · COD {summary.paymentMethods.codEnabled ? "enabled" : "disabled"}{" "}
            <Link to="/admin/settings" className="underline">Change</Link>
          </Row>
        </dl>
        <p className="mt-3 text-xs text-charcoal-soft">
          Cash on Delivery does not depend on Cashfree. If Cashfree is not configured, customers simply see Cash on Delivery.
        </p>

        <fieldset className="mt-4 rounded-xl border border-sage/40 p-3">
          <legend className="px-1 text-xs font-semibold text-charcoal">Active mode</legend>
          <div className="flex flex-wrap items-center gap-2">
            {["TEST", "LIVE"].map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={summary.mode === m}
                disabled={summary.mode === m || busy === "mode"}
                onClick={() => setConfirmMode(m)}
                className={`admin-btn ${summary.mode === m ? "admin-btn--primary" : "admin-btn--ghost"}`}
              >
                {m === "TEST" ? "TEST mode (sandbox)" : "LIVE mode"}
              </button>
            ))}
            <span className="text-xs text-charcoal-soft">TEST and LIVE credentials are stored separately and never mixed; only the selected mode is used at checkout.</span>
          </div>
          {confirmMode && (
            <div role="alertdialog" aria-label={`Switch to ${confirmMode} mode`} className="mt-3 rounded-lg bg-terracotta/10 p-3 text-sm">
              <p className="font-medium text-charcoal">Switch checkout to {confirmMode} mode?</p>
              <p className="mt-1 text-xs text-charcoal-soft">
                {confirmMode === "LIVE" ? "Customers will be charged real money." : "Payments will use sandbox credentials and no real money moves."} Set the webhook in the Cashfree dashboard for the same mode.
              </p>
              <div className="mt-2 flex gap-2">
                <button type="button" className="admin-btn admin-btn--primary" disabled={busy === "mode"} onClick={() => switchMode(confirmMode)}>
                  Confirm switch to {confirmMode}
                </button>
                <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setConfirmMode(null)}>Cancel</button>
              </div>
            </div>
          )}
        </fieldset>
      </AdminCard>

      <AdminCard title="Credentials" subtitle="Stored encrypted. Saved secrets are never shown again.">
        <div className="mb-3 flex gap-2" role="tablist" aria-label="Cashfree environment">
          {["TEST", "LIVE"].map((m) => (
            <button key={m} type="button" role="tab" aria-selected={editing === m} onClick={() => setEditing(m)} className={`admin-btn ${editing === m ? "admin-btn--primary" : "admin-btn--ghost"}`}>
              {m === "TEST" ? "TEST (sandbox)" : "LIVE (production)"}
            </button>
          ))}
        </div>
        <form onSubmit={save} className="space-y-3">
          <label className="admin-label">
            App ID (Client ID)
            <input value={form.appId} onChange={(e) => setForm({ ...form, appId: e.target.value })} className="admin-input" autoComplete="off" aria-label="Cashfree App ID" />
            {errors.appId && <span role="alert" className="mt-1 block text-xs text-terracotta">{errors.appId}</span>}
          </label>
          <SecretField
            label="Secret Key"
            configured={Boolean(env.configured)}
            mask={env.secretKeyMask}
            value={form.secretKey}
            onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
            error={errors.secretKey}
          >
            <span className="mt-1 block text-xs text-charcoal-soft">Leave blank to keep the saved Secret Key. The same Secret Key verifies webhook signatures.</span>
          </SecretField>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="admin-btn admin-btn--primary" disabled={busy === "save"}>Save {editing} credentials</button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              disabled={busy === "test" || !env.configured}
              onClick={() =>
                run("test", async () => {
                  const res = await adminCashfreeTest(editing);
                  setMessage(`${editing}: ${OUTCOME_LABEL[res.data.outcome] || res.data.outcome}`);
                  await load();
                })
              }
            >
              Test connection
            </button>
            {env.configured && (
              <button type="button" className="admin-btn admin-btn--ghost" disabled={busy === "enabled"} onClick={toggleEnabled}>
                {env.enabled ? "Disable" : "Enable"} {editing}
              </button>
            )}
            {env.configured && (
              <button type="button" className="admin-btn admin-btn--ghost" disabled={busy === "remove"} onClick={remove}>
                Remove credentials
              </button>
            )}
          </div>
          <p className="text-xs text-charcoal-soft">The connection test only asks Cashfree whether the credentials are accepted. It creates no order and charges nothing.</p>
        </form>
      </AdminCard>

      <AdminCard title="Webhook" subtitle="Lets Cashfree tell Tushaqsa when a payment succeeds, fails or is abandoned.">
        <div className="space-y-2 text-sm">
          <p className="text-xs font-medium text-charcoal">Webhook URL</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-ivory-dark/40 px-2 py-1 text-xs" data-testid="cashfree-webhook-url">{hook.url}</code>
            <button type="button" className="admin-btn admin-btn--ghost" onClick={() => copy(hook.url)}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-charcoal-soft">
            <li>Open the Cashfree dashboard (use the Test/Sandbox view for TEST mode, Production for LIVE) and go to Developers, then Webhooks.</li>
            <li>Add a webhook endpoint and paste the URL above.</li>
            <li>Select the payment events listed below and choose webhook version {summary.apiVersion}.</li>
            <li>Save. Cashfree signs every webhook with your Secret Key, so no separate webhook secret is needed.</li>
          </ol>
          <p className="text-xs font-medium text-charcoal">Events handled</p>
          <ul className="space-y-1 text-xs text-charcoal-soft">
            {hook.events.map((ev) => (
              <li key={ev.event}><code>{ev.event}</code> — {ev.effect}</li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="admin-btn admin-btn--ghost" disabled={busy === "verify"} onClick={() => run("verify", async () => setVerify((await adminCashfreeVerifySetup()).data))}>
              Check webhook setup
            </button>
          </div>
          {verify && (
            <div role="status" className="rounded-lg bg-ivory-dark/40 p-3 text-xs">
              <p className="font-medium text-charcoal">{verify.message}</p>
              <ul className="mt-1 space-y-0.5">
                {verify.checks.map((c) => (
                  <li key={c.key}>{c.pass ? "✓" : "✗"} {c.label} <span className="text-charcoal-soft">— {c.detail}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </AdminCard>

      <AdminCard title="Recent webhook deliveries" subtitle="Event type, signature result and outcome only. No payloads or secrets are stored.">
        {events.length === 0 ? (
          <p className="text-sm text-charcoal-soft">No webhook deliveries yet.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {events.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-center gap-2">
                <span className="text-charcoal-soft">{fmt(ev.time)}</span>
                <code>{ev.event || "—"}</code>
                <StatusBadge tone={ev.signature === "VERIFIED" ? "success" : "danger"}>{ev.signature}</StatusBadge>
                <StatusBadge tone={RESULT_TONE[ev.result] || "neutral"}>{ev.result}</StatusBadge>
                {ev.reference && <span className="font-mono text-charcoal-soft">{ev.reference}</span>}
                {ev.error && <span className="text-terracotta">{ev.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}
