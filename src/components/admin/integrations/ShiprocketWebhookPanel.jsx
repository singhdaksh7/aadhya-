import { useCallback, useEffect, useState } from "react";
import { adminShiprocketSummary, adminShiprocketGenerateToken, adminShiprocketRemoveToken, adminShiprocketVerifySetup, adminShiprocketWebhookEvents } from "../../../lib/api";
import { AdminCard, StatusBadge } from "../ui";

const RESULT_TONE = { PROCESSED: "success", IGNORED: "neutral", DUPLICATE: "neutral", FAILED: "danger", REJECTED: "danger" };
function BareWrap({ children, actions }) {
  return <div>{actions && <div className="mb-3 flex gap-2">{actions}</div>}{children}</div>;
}
const fmt = (v) => (v ? new Date(v).toLocaleString("en-IN") : "—");

// Admin → Integrations → Shiprocket: tracking webhook. The token is generated here, shown ONCE, and stored
// encrypted; it goes into Shiprocket's webhook "Security Token" field and arrives in the x-api-key header.
export default function ShiprocketWebhookPanel({ bare = false }) {
  const Wrap = bare ? BareWrap : AdminCard;
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [token, setToken] = useState(null);
  const [verify, setVerify] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([adminShiprocketSummary(), adminShiprocketWebhookEvents(15)]);
      setSummary(s.data);
      setEvents(e.data.items);
    } catch (err) {
      setMessage(err.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (name, fn) => {
    setBusy(name);
    setMessage("");
    try {
      await fn();
    } catch (err) {
      setMessage(err.message);
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
      <Wrap title="Shiprocket tracking webhook">
        <p className="text-sm text-charcoal-soft">{message || "Loading…"}</p>
      </Wrap>
    );
  }
  const hook = summary.webhook;

  return (
    <Wrap
      title="Shiprocket tracking webhook"
      subtitle="Lets Shiprocket update orders and email customers when a parcel ships, goes out for delivery or is delivered."
      actions={<StatusBadge value={hook.tokenConfigured ? "Token set" : "Token missing"} tone={hook.tokenConfigured ? "success" : "neutral"} />}
    >
      <div className="space-y-3 text-sm" data-testid="shiprocket-webhook-panel">
        {message && <p role="status" className="rounded-xl bg-terracotta/10 px-3 py-2 text-terracotta">{message}</p>}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
          <div><dt className="font-medium text-charcoal">Shiprocket as courier provider</dt><dd className="text-charcoal-soft">{summary.enabled ? "Enabled (Shipping settings)" : "Not selected in Shipping settings"}</dd></div>
          <div><dt className="font-medium text-charcoal">Last webhook</dt><dd className="text-charcoal-soft">{hook.lastReceivedAt ? `${fmt(hook.lastReceivedAt)}${hook.lastEventType ? ` · ${hook.lastEventType}` : ""}` : "None received yet"}</dd></div>
          <div><dt className="font-medium text-charcoal">Last result</dt><dd className="text-charcoal-soft">{hook.lastResult || "—"}</dd></div>
        </dl>

        <p className="text-xs font-medium text-charcoal">Webhook URL</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-ivory-dark/40 px-2 py-1 text-xs" data-testid="shiprocket-webhook-url">{hook.url}</code>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => copy(hook.url, "url")}>{copied === "url" ? "Copied" : "Copy"}</button>
        </div>

        <ol className="list-decimal space-y-1 pl-5 text-xs text-charcoal-soft">
          <li>In Shiprocket go to Settings → API → Webhooks and add a webhook with the URL above (it deliberately contains no &quot;shiprocket&quot;, &quot;sr&quot; or &quot;kr&quot;, which Shiprocket rejects).</li>
          <li>Generate a token below and paste it into the <strong>Security Token</strong> field. Shiprocket sends it in the <code>x-api-key</code> header.</li>
          <li>Switch the webhook on and save. Tushaqsa answers 200 to every authenticated request.</li>
        </ol>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={busy === "gen"}
            onClick={() =>
              run("gen", async () => {
                if (hook.tokenConfigured && !window.confirm("Generating a new token replaces the current one. Shiprocket will be rejected until you paste the new token there. Continue?")) return;
                setToken((await adminShiprocketGenerateToken()).data.webhookToken);
                await load();
              })
            }
          >
            {hook.tokenConfigured ? "Rotate token" : "Generate token"}
          </button>
          {hook.tokenConfigured && (
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              disabled={busy === "rm"}
              onClick={() =>
                run("rm", async () => {
                  if (!window.confirm("Remove the webhook token? Shiprocket updates will be rejected.")) return;
                  await adminShiprocketRemoveToken();
                  setToken(null);
                  await load();
                })
              }
            >
              Remove token
            </button>
          )}
          <button type="button" className="admin-btn admin-btn--ghost" disabled={busy === "verify"} onClick={() => run("verify", async () => setVerify((await adminShiprocketVerifySetup()).data))}>
            Check webhook setup
          </button>
        </div>

        {token && (
          <div role="alert" className="rounded-xl border border-terracotta/40 bg-terracotta/5 p-3">
            <p className="text-xs font-semibold text-terracotta">Copy this token now. It will not be shown again.</p>
            <input readOnly aria-label="New webhook token" value={token} className="admin-input mt-2 font-mono text-xs" onFocus={(e) => e.target.select()} />
            <div className="mt-2 flex gap-2">
              <button type="button" className="admin-btn admin-btn--ghost" onClick={() => copy(token, "token")}>{copied === "token" ? "Copied" : "Copy token"}</button>
              <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setToken(null)}>I have copied it</button>
            </div>
          </div>
        )}

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

        <details className="rounded-lg border border-charcoal/10 p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-charcoal">How Shiprocket statuses are handled</summary>
          <p className="mt-2 text-charcoal-soft">Customers get one email per milestone (shipped, out for delivery, delivered, delivery attempt failed). Other scans only update tracking. Unknown statuses are ignored.</p>
          <table className="mt-2 w-full text-left">
            <thead><tr className="text-charcoal-soft"><th className="py-1 pr-2">ID</th><th className="pr-2">Shiprocket status</th><th className="pr-2">Becomes</th><th>Email</th></tr></thead>
            <tbody>
              {summary.mapping.map((m) => (
                <tr key={m.id} className="border-t border-charcoal/10"><td className="py-1 pr-2">{m.id}</td><td className="pr-2">{m.shiprocket}</td><td className="pr-2">{m.becomes}</td><td>{m.email}</td></tr>
              ))}
            </tbody>
          </table>
        </details>

        <p className="text-xs font-medium text-charcoal">Recent webhook deliveries</p>
        {events.length === 0 ? (
          <p className="text-xs text-charcoal-soft">No deliveries yet.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {events.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-center gap-2">
                <span className="text-charcoal-soft">{fmt(ev.time)}</span>
                <code>{ev.event || "—"}</code>
                <StatusBadge tone={ev.signature === "VERIFIED" ? "success" : "danger"}>{ev.signature === "VERIFIED" ? "TOKEN OK" : ev.signature}</StatusBadge>
                <StatusBadge tone={RESULT_TONE[ev.result] || "neutral"}>{ev.result}</StatusBadge>
                {ev.reference && <span className="font-mono text-charcoal-soft">{ev.reference}</span>}
                {ev.error && <span className="text-terracotta">{ev.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Wrap>
  );
}
