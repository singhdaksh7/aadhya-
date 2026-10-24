import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminRazorpaySummary,
  adminRazorpaySave,
  adminRazorpayTest,
  adminRazorpaySetMode,
  adminRazorpayGenerateWebhookSecret,
  adminRazorpayRemoveWebhookSecret,
  adminRazorpayVerifySetup,
  adminRazorpayWebhookEvents,
  adminDeleteIntegration,
} from "../../../lib/api";
import { AdminCard, StatusBadge } from "../ui";
import SecretField from "./SecretField";

const OUTCOME_LABEL = {
  CONNECTED: "Connected",
  AUTH_FAILED: "Authentication failed - check the Key ID and Key Secret",
  MISSING_CREDENTIALS: "Missing credentials - save a Key ID and Key Secret first",
  UNREACHABLE: "Razorpay could not be reached - try again shortly",
  INVALID_CONFIG: "Configuration invalid - the key does not match this mode",
};
const RESULT_TONE = { PROCESSED: "success", IGNORED: "neutral", DUPLICATE: "neutral", FAILED: "danger", REJECTED: "danger" };
const fmt = (value) => (value ? new Date(value).toLocaleString("en-IN") : "—");

function ModeBadge({ mode }) {
  if (!mode) return <StatusBadge tone="neutral">Mode not set</StatusBadge>;
  return mode === "LIVE" ? <StatusBadge tone="danger">LIVE MODE</StatusBadge> : <StatusBadge tone="warning">TEST MODE</StatusBadge>;
}

function Row({ label, children }) {
  return (
    <div>
      <dt className="font-medium text-charcoal">{label}</dt>
      <dd className="text-charcoal-soft">{children}</dd>
    </div>
  );
}

export default function RazorpayPanel({ onChanged }) {
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [editing, setEditing] = useState("TEST");
  const [form, setForm] = useState({ keyId: "", keySecret: "", webhookSecret: "" });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [generated, setGenerated] = useState(null); // { environment, secret } - shown once
  const [confirmMode, setConfirmMode] = useState(null);
  const [verify, setVerify] = useState(null);
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([adminRazorpaySummary(), adminRazorpayWebhookEvents(15)]);
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
    setForm({ keyId: summary?.environments?.[editing]?.keyId || "", keySecret: "", webhookSecret: "" });
    setErrors({});
    setGenerated(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, summary?.environments?.[editing]?.keyId]);

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

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setMessage("Copy failed - select the text and copy it manually.");
    }
  };

  if (!summary) {
    return (
      <AdminCard title="Razorpay">
        <p className="text-sm text-charcoal-soft">{message || "Loading Razorpay settings..."}</p>
      </AdminCard>
    );
  }

  const env = summary.environments[editing];
  const active = summary.mode ? summary.environments[summary.mode] : null;
  const hook = summary.webhook;

  const save = (e) => {
    e.preventDefault();
    run("save", async () => {
      setErrors({});
      const body = { environment: editing };
      for (const field of ["keyId", "keySecret", "webhookSecret"]) {
        const value = form[field].trim();
        if (value && !(field === "keyId" && value === env.keyId && !form.keySecret.trim())) body[field] = value;
      }
      if (Object.keys(body).length === 1) {
        setMessage("Nothing to save - enter a new value first.");
        return;
      }
      await adminRazorpaySave(body);
      setMessage(`Razorpay ${editing} settings saved securely.`);
      await load();
      onChanged?.();
    });
  };

  const switchMode = (target) =>
    run("mode", async () => {
      await adminRazorpaySetMode(target);
      setConfirmMode(null);
      setMessage(`Razorpay is now in ${target} mode.`);
      await load();
      onChanged?.();
    });

  const generate = () =>
    run("generate", async () => {
      if (env.webhookSecretConfigured && !window.confirm("Rotating replaces the current webhook secret immediately. Razorpay deliveries will fail until you paste the new secret into the Razorpay dashboard. Continue?")) return;
      const res = await adminRazorpayGenerateWebhookSecret(editing);
      setGenerated({ environment: editing, secret: res.data.webhookSecret });
      await load();
    });

  return (
    <div className="space-y-4">
      {message && (
        <p role="status" aria-live="polite" className="rounded-xl bg-sage-light px-3 py-2 text-sm text-green-deep">
          {message}
        </p>
      )}

      <AdminCard title="Razorpay" subtitle="Online payments" actions={<ModeBadge mode={summary.mode} />}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-3" aria-label="Razorpay configuration summary">
          <Row label="Environment">{summary.mode || "Not selected"}{summary.modeSource === "legacy" ? " (inferred)" : ""}{summary.usingEnvironmentVariables ? " (server env vars)" : ""}</Row>
          <Row label="API credentials">{active?.configured ? "Configured" : summary.usingEnvironmentVariables ? "From server environment" : "Not configured"}</Row>
          <Row label="Connection">{active?.testStatus === "SUCCESS" ? "Connected" : active?.testStatus === "FAILED" ? "Last test failed" : "Not tested"}{active?.lastTestedAt ? ` · ${fmt(active.lastTestedAt)}` : ""}</Row>
          <Row label="Webhook secret">{hook.secretConfigured ? "Configured" : "Missing"}</Row>
          <Row label="Last webhook">{hook.lastReceivedAt ? `${fmt(hook.lastReceivedAt)}${hook.lastEventType ? ` · ${hook.lastEventType}` : ""}` : "None received yet"}</Row>
          <Row label="Payment method">
            {summary.paymentMethods.razorpayEnabled ? "Enabled" : "Disabled"} · COD {summary.paymentMethods.codEnabled ? "enabled" : "disabled"}{" "}
            <Link to="/admin/settings" className="underline">Change</Link>
          </Row>
        </dl>

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
                {m === "TEST" ? "TEST mode" : "LIVE mode"}
              </button>
            ))}
            <span className="text-xs text-charcoal-soft">TEST and LIVE credentials are stored separately; only the selected mode is used at checkout.</span>
          </div>
          {confirmMode && (
            <div role="alertdialog" aria-label={`Switch to ${confirmMode} mode`} className="mt-3 rounded-lg bg-terracotta/10 p-3 text-sm">
              <p className="font-medium text-charcoal">
                Switch checkout to {confirmMode} mode?
              </p>
              <p className="mt-1 text-xs text-charcoal-soft">
                {confirmMode === "LIVE" ? "Customers will be charged real money." : "Payments will use test credentials and no real money moves."} The webhook secret for {confirmMode} will be used to verify Razorpay events, so make sure the Razorpay webhook for that mode matches.
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

      <AdminCard title="API credentials" subtitle="Secrets are write-only: once saved they can be replaced but never viewed.">
        <div role="tablist" aria-label="Credential environment" className="mb-3 flex gap-2">
          {["TEST", "LIVE"].map((m) => (
            <button key={m} role="tab" aria-selected={editing === m} type="button" onClick={() => setEditing(m)} className={`admin-btn ${editing === m ? "admin-btn--primary" : "admin-btn--ghost"}`}>
              {m} credentials
            </button>
          ))}
        </div>
        <form onSubmit={save} className="admin-form-grid sm:grid-cols-2">
          <label className="admin-label">
            Key ID
            <input value={form.keyId} onChange={(e) => setForm({ ...form, keyId: e.target.value })} placeholder={editing === "TEST" ? "rzp_test_..." : "rzp_live_..."} className="admin-input" autoComplete="off" />
            {errors.keyId && <span role="alert" className="mt-1 block text-xs text-terracotta">{errors.keyId}</span>}
          </label>
          <SecretField label="Key Secret" configured={Boolean(env.keySecretMask)} mask={env.keySecretMask} value={form.keySecret} onChange={(e) => setForm({ ...form, keySecret: e.target.value })} error={errors.keySecret} />
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={env.enabled}
                disabled={!env.configured || busy === "enabled"}
                onChange={(e) => run("enabled", async () => { await adminRazorpaySave({ environment: editing, enabled: e.target.checked }); await load(); })}
              />
              {editing} credentials enabled
            </label>
            <StatusBadge tone={env.configured ? "success" : "neutral"}>{env.configured ? "Configured" : "Not configured"}</StatusBadge>
            {env.testStatus && <StatusBadge tone={env.testStatus === "SUCCESS" ? "success" : "danger"}>{env.testStatus === "SUCCESS" ? "Connected" : "Test failed"}</StatusBadge>}
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button className="admin-btn admin-btn--primary" disabled={busy === "save"}>{busy === "save" ? "Saving…" : `Save ${editing} credentials`}</button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              disabled={busy === "test"}
              onClick={() => run("test", async () => {
                const res = await adminRazorpayTest(editing);
                setMessage(`${editing}: ${OUTCOME_LABEL[res.data.outcome] || res.data.outcome}`);
                await load();
              })}
            >
              {busy === "test" ? "Testing…" : "Test Razorpay Connection"}
            </button>
            {env.configured && (
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                disabled={summary.mode === editing}
                title={summary.mode === editing ? "Switch to the other mode before removing the active one" : undefined}
                onClick={() => run("remove", async () => {
                  if (!window.confirm(`Remove all stored ${editing} Razorpay credentials, including its webhook secret?`)) return;
                  await adminDeleteIntegration("RAZORPAY", editing);
                  setMessage(`${editing} credentials removed.`);
                  await load();
                })}
              >
                Remove {editing} credentials
              </button>
            )}
          </div>
        </form>
      </AdminCard>

      <AdminCard title="Webhook Setup" subtitle="Lets Razorpay tell Tushaqsa when a payment succeeds or fails.">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-charcoal">Webhook URL (generated automatically)</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input readOnly aria-label="Webhook URL" value={hook.url} className="admin-input min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
              <button type="button" className="admin-btn admin-btn--ghost" onClick={() => copy(hook.url, "url")}>{copied === "url" ? "Copied" : "Copy Webhook URL"}</button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-charcoal">Events to enable in Razorpay</p>
            <ul className="mt-1 space-y-1 text-sm">
              {hook.events.map((ev) => (
                <li key={ev.event}>
                  <code className="rounded bg-sage-light px-1.5 py-0.5 text-xs">{ev.event}</code>
                  <span className="ml-2 text-xs text-charcoal-soft">{ev.effect}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-charcoal-soft">Other events are accepted but ignored, so there is no need to select them.</p>
          </div>

          <div>
            <SecretField label={`${editing} webhook secret`} configured={env.webhookSecretConfigured} mask={env.webhookSecretMask} value={form.webhookSecret} onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })} error={errors.webhookSecret} placeholder="Paste the secret you set in Razorpay">
              <span className="mt-1 block text-xs text-charcoal-soft">Use the same secret in Razorpay and here. Saved secrets cannot be displayed again - replace or rotate them instead.</span>
            </SecretField>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="admin-btn admin-btn--primary" disabled={!form.webhookSecret.trim() || busy === "save"} onClick={save}>
                {env.webhookSecretConfigured ? "Replace Secret" : "Save Secret"}
              </button>
              <button type="button" className="admin-btn admin-btn--ghost" disabled={busy === "generate"} onClick={generate}>
                {env.webhookSecretConfigured ? "Rotate (Generate New Secret)" : "Generate Secure Secret"}
              </button>
              {env.webhookSecretConfigured && (
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={summary.mode === editing}
                  title={summary.mode === editing ? "The active mode needs a webhook secret" : undefined}
                  onClick={() => run("rmsecret", async () => {
                    if (!window.confirm(`Remove the ${editing} webhook secret?`)) return;
                    await adminRazorpayRemoveWebhookSecret(editing);
                    await load();
                  })}
                >
                  Remove Secret
                </button>
              )}
            </div>
            {generated && (
              <div role="alert" className="mt-3 rounded-xl border border-terracotta/40 bg-terracotta/10 p-3">
                <p className="text-sm font-semibold text-charcoal">Copy this secret now. It will not be shown again after you leave or save.</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input readOnly aria-label="Generated webhook secret" value={generated.secret} className="admin-input min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => copy(generated.secret, "secret")}>{copied === "secret" ? "Copied" : "Copy"}</button>
                </div>
                <p className="mt-2 text-xs text-charcoal-soft">It is already saved to Tushaqsa ({generated.environment}). Paste it into the Razorpay webhook now.</p>
                <button type="button" className="admin-btn admin-btn--ghost mt-2" onClick={() => setGenerated(null)}>I have copied it</button>
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="admin-btn admin-btn--ghost" disabled={busy === "verify"} onClick={() => run("verify", async () => setVerify((await adminRazorpayVerifySetup()).data))}>
                {busy === "verify" ? "Verifying…" : "Verify Setup"}
              </button>
              <span className="text-xs text-charcoal-soft">Checks Tushaqsa's side only. Razorpay cannot send a test event on demand, so a real signed event is still needed.</span>
            </div>
            {verify && (
              <div className="mt-2 rounded-xl bg-sage-light/60 p-3 text-sm" aria-live="polite">
                <ul className="space-y-1">
                  {verify.checks.map((c) => (
                    <li key={c.key}>
                      <StatusBadge tone={c.pass ? "success" : "danger"}>{c.pass ? "OK" : "Fix"}</StatusBadge> <span className="ml-1">{c.label}</span>
                      <span className="ml-1 text-xs text-charcoal-soft">- {c.detail}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-medium">{verify.message}</p>
              </div>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-4" aria-label="Webhook health">
            <Row label="Webhook secret">{hook.secretConfigured ? "Configured" : "Missing"}</Row>
            <Row label="Last webhook">{fmt(hook.lastReceivedAt)}</Row>
            <Row label="Last event">{hook.lastEventType || "—"}</Row>
            <Row label="Signature">{hook.lastSignature === "VERIFIED" ? "Verified" : hook.lastSignature === "FAILED" ? "Failed" : hook.lastSignature || "—"}</Row>
            <Row label="Last result">{hook.lastResult || "—"}</Row>
            <Row label="First signed event">{hook.waitingForFirstSignedEvent ? "Waiting for first signed Razorpay event" : "Received"}</Row>
          </dl>

          <details className="rounded-xl border border-sage/40 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-charcoal">Setup Guide</summary>
            <div className="mt-2 space-y-3 text-sm text-charcoal-soft">
              <div>
                <p className="font-medium text-charcoal">API keys</p>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>In the Razorpay Dashboard, switch to <strong>Test Mode</strong> or <strong>Live Mode</strong> (top of the page).</li>
                  <li>Open Account &amp; Settings → API Keys → Generate Key.</li>
                  <li>Copy the <strong>Key ID</strong> (starts with <code>rzp_test_</code> or <code>rzp_live_</code>) and the <strong>Key Secret</strong> (shown only once by Razorpay) into the matching tab above.</li>
                </ol>
              </div>
              <div>
                <p className="font-medium text-charcoal">Configure Razorpay Webhook</p>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Open Razorpay Dashboard.</li>
                  <li>Go to Settings → Webhooks.</li>
                  <li>Click Add New Webhook.</li>
                  <li>Copy the Webhook URL shown above.</li>
                  <li>Enter the webhook secret shown or generated here.</li>
                  <li>Select <code>payment.captured</code> and <code>payment.failed</code>.</li>
                  <li>Save the webhook in Razorpay.</li>
                  <li>Return here, press <strong>Verify Setup</strong>, then make one TEST payment to confirm the first signed event arrives.</li>
                </ol>
              </div>
              <div>
                <p className="font-medium text-charcoal">Common problems</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li><strong>Authentication failed</strong> - the Key ID and Key Secret do not belong together, or are from the other mode.</li>
                  <li><strong>Signature Failed in the log</strong> - the secret in Razorpay differs from the one here. Re-enter it in both places.</li>
                  <li><strong>No events arriving</strong> - the webhook is saved under the other Razorpay mode, or the URL was copied before a domain change.</li>
                  <li>TEST and LIVE use different webhooks and secrets in Razorpay; configure each one separately.</li>
                </ul>
              </div>
            </div>
          </details>
        </div>
      </AdminCard>

      <AdminCard title="Webhook activity" subtitle="Most recent deliveries. Payloads, card details and secrets are never stored." noPadding>
        <div className="overflow-x-auto">
          <table className="admin-table w-full text-xs">
            <thead>
              <tr>
                <th className="text-left">Time</th>
                <th className="text-left">Provider</th>
                <th className="text-left">Event</th>
                <th className="text-left">Signature</th>
                <th className="text-left">Result</th>
                <th className="text-left">Reference</th>
                <th className="text-left">Error</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr><td colSpan={7} className="py-3 text-charcoal-soft">No webhook deliveries recorded yet.</td></tr>
              )}
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>{fmt(ev.time)}</td>
                  <td>Razorpay</td>
                  <td>{ev.event || "—"}</td>
                  <td><StatusBadge tone={ev.signature === "VERIFIED" ? "success" : ev.signature === "FAILED" ? "danger" : "neutral"}>{ev.signature === "VERIFIED" ? "Verified" : ev.signature === "FAILED" ? "Failed" : "No secret"}</StatusBadge></td>
                  <td><StatusBadge tone={RESULT_TONE[ev.result] || "neutral"}>{ev.result}</StatusBadge></td>
                  <td className="font-mono">{ev.reference || "—"}</td>
                  <td className="max-w-[220px] truncate" title={ev.error || ""}>{ev.error || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </div>
  );
}
