import React, { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";

function StatusPill({ ok, label }) {
  const cls = ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${cls}`}>
      {label}: {ok ? "OK" : "DOWN"}
    </span>
  );
}

function ConfigPill({ configured, label }) {
  const cls = configured ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${cls}`}>
      {label}: {configured ? "Configured" : "Not configured"}
    </span>
  );
}

export default function AdminSystemHealth() {
  const [health, setHealth] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await api.get("/admin/health", { auth: "admin" });
      setHealth(res.data);
      setStatus("ready");
    } catch (err) {
      setError(err.message || "Failed to load system health.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (status === "loading" && !health) return <LoadingNotice label="Loading system health…" />;
  if (status === "error" && !health) return <ErrorNotice message={error} onRetry={load} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">System Health</h1>
        <Button onClick={load} disabled={status === "loading"}>
          {status === "loading" ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error && <ErrorNotice message={error} onRetry={load} />}

      {health && (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Overall</h2>
            <div className="flex flex-wrap gap-2">
              <StatusPill ok={health.status === "ok"} label="API" />
              <StatusPill ok={health.database?.ok} label="Database" />
              <StatusPill ok={health.storage?.uploads} label="Uploads storage" />
              <StatusPill ok={health.storage?.books} label="Books storage" />
              <StatusPill ok={health.storage?.invoices} label="Invoices storage" />
            </div>
            <p className="text-xs text-gray-500">
              Checked at {health.checkedAt ? new Date(health.checkedAt).toLocaleString() : "—"}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Integrations</h2>
            <div className="flex flex-wrap gap-2">
              <ConfigPill configured={health.email?.smtpConfigured} label="SMTP" />
              <ConfigPill configured={health.integrations?.razorpay?.configured} label="Razorpay" />
              <ConfigPill configured={health.integrations?.shiprocket?.configured} label="Shiprocket" />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Latest backup</h2>
            {health.backup?.available ? (
              <div className="text-sm">
                <p>
                  Status: <span className="font-medium">{health.backup.status}</span>
                </p>
                <p>
                  Last run:{" "}
                  {health.backup.lastRunAt ? new Date(health.backup.lastRunAt).toLocaleString() : "—"}
                </p>
                {health.backup.sizeBytes != null && (
                  <p>Size: {(health.backup.sizeBytes / (1024 * 1024)).toFixed(2)} MB</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No backup data yet.</p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase">Recent activity</h2>
            <div className="text-sm space-y-1">
              <p>
                Server errors (5xx, last 5 min):{" "}
                <span className="font-medium">{health.monitoring?.recentServerErrors5xxLast5Min ?? "no data yet"}</span>
              </p>
              <p>
                Webhook events (last 24h):{" "}
                <span className="font-medium">
                  {health.monitoring?.recentWebhookEventsLast24h ?? "no data yet"}
                </span>
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
