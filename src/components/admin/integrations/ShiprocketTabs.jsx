import { useCallback, useEffect, useState } from "react";
import { adminShiprocketOverview, adminShiprocketPickupLocations, adminTestIntegration } from "../../../lib/api";
import { AdminCard, StatusBadge } from "../ui";
import ShiprocketWebhookPanel from "./ShiprocketWebhookPanel";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "pickup", label: "Pickup" },
  { id: "webhook", label: "Webhook" },
  { id: "diagnostics", label: "Diagnostics" },
];
const fmt = (v) => (v ? new Date(v).toLocaleString("en-IN") : "—");
const CONN_TONE = { OK: "success", UNKNOWN: "neutral", NOT_CONFIGURED: "danger" };

function Row({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-charcoal">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-charcoal-soft">{children}</dd>
    </div>
  );
}

// Read-only Shiprocket control room. Nothing here ever receives or shows a secret: the server only returns
// booleans, nicknames and timestamps.
export default function ShiprocketTabs() {
  const [tab, setTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState("");
  const [locations, setLocations] = useState(null);
  const [locBusy, setLocBusy] = useState(false);
  const [locError, setLocError] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testMessage, setTestMessage] = useState("");

  const loadOverview = useCallback(async () => {
    try {
      setOverview((await adminShiprocketOverview()).data);
      setOverviewError("");
    } catch (err) {
      setOverviewError(err.message || "Could not load the Shiprocket overview.");
    }
  }, []);
  useEffect(() => { loadOverview(); }, [loadOverview]);

  const loadLocations = async () => {
    setLocBusy(true); setLocError("");
    try { setLocations((await adminShiprocketPickupLocations()).data); }
    catch (err) { setLocError(err.message || "Could not load pickup locations from Shiprocket."); }
    finally { setLocBusy(false); }
  };

  const testConnection = async () => {
    setTestBusy(true); setTestMessage("");
    try {
      await adminTestIntegration("SHIPROCKET", overview?.environment || "TEST");
      setTestMessage("Connection test completed.");
      await loadOverview();
    } catch (err) {
      setTestMessage(err.message || "Connection test failed.");
    } finally { setTestBusy(false); }
  };

  const onKeyDown = (e) => {
    const i = TABS.findIndex((t) => t.id === tab);
    if (e.key === "ArrowRight") setTab(TABS[(i + 1) % TABS.length].id);
    else if (e.key === "ArrowLeft") setTab(TABS[(i + TABS.length - 1) % TABS.length].id);
  };

  const o = overview;
  const flag = (v) => <StatusBadge value={v ? "ON" : "OFF"} tone={v ? "success" : "neutral"} />;
  const diag = o?.diagnostics;

  return (
    <AdminCard title="Shiprocket status" subtitle="Connection, pickup address, tracking webhook and diagnostics">
      <div role="tablist" aria-label="Shiprocket sections" onKeyDown={onKeyDown} className="mb-4 flex gap-1 overflow-x-auto border-b border-charcoal/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`sr-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls={`sr-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm ${tab === t.id ? "border-charcoal font-semibold text-charcoal" : "border-transparent text-charcoal-soft"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {overviewError && tab !== "webhook" && <p role="alert" className="mb-3 rounded-xl bg-terracotta/10 px-3 py-2 text-sm text-terracotta">{overviewError}</p>}

      {tab === "overview" && (
        <div role="tabpanel" id="sr-panel-overview" aria-labelledby="sr-tab-overview">
          {!o ? <p className="text-sm text-charcoal-soft">{overviewError ? "" : "Loading…"}</p> : (
            <>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Row label="Shiprocket enabled">{flag(o.enabled)}</Row>
                <Row label="Shipping provider">{o.provider || "—"}{o.environment ? ` · ${o.environment}` : ""}</Row>
                <Row label="Credentials configured">{flag(o.credentialsConfigured)}</Row>
                <Row label="Connection status"><StatusBadge value={o.connection?.status || "UNKNOWN"} tone={CONN_TONE[o.connection?.status] || "neutral"} /></Row>
                <Row label="Last successful authentication">{fmt(o.connection?.lastSuccessfulAuthAt)}</Row>
              </dl>
              <h3 className="mb-2 mt-5 text-sm font-semibold text-charcoal">Automation</h3>
              <p className="mb-2 text-xs text-charcoal-soft">Read-only. Each step is performed by Admin from the order page.</p>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="shiprocket-automation">
                <Row label="Auto-create shipment">{flag(o.automation?.autoCreateShipment)}</Row>
                <Row label="Auto-generate AWB">{flag(o.automation?.autoGenerateAwb)}</Row>
                <Row label="Auto-schedule pickup">{flag(o.automation?.autoSchedulePickup)}</Row>
              </dl>
            </>
          )}
        </div>
      )}

      {tab === "pickup" && (
        <div role="tabpanel" id="sr-panel-pickup" aria-labelledby="sr-tab-pickup" className="space-y-4">
          {o && (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Row label="Configured pickup nickname">{o.pickup?.nickname || "Not set"}</Row>
              <Row label="City / pincode">{[o.pickup?.city, o.pickup?.pincode].filter(Boolean).join(" · ") || "—"}</Row>
              <Row label="Pickup details"><StatusBadge value={o.pickup?.complete ? "Complete" : "Incomplete"} tone={o.pickup?.complete ? "success" : "danger"} /></Row>
            </dl>
          )}
          <button type="button" className="admin-btn admin-btn--ghost" disabled={locBusy} onClick={loadLocations}>
            {locBusy ? "Loading…" : "Load pickup locations from Shiprocket"}
          </button>
          {locError && <p role="alert" className="text-sm text-terracotta">{locError}</p>}
          {locations && (
            <div data-testid="pickup-locations">
              {!locations.configuredFound && (
                <p role="alert" className="mb-3 rounded-xl bg-terracotta/10 px-3 py-2 text-sm text-terracotta">
                  The configured pickup nickname{locations.configuredNickname ? ` "${locations.configuredNickname}"` : ""} was not found in your Shiprocket account. Shipments will fail until it matches one of the locations below.
                </p>
              )}
              {locations.locations.length === 0 ? (
                <p className="text-sm text-charcoal-soft">Shiprocket returned no pickup locations.</p>
              ) : (
                <ul className="space-y-2">
                  {locations.locations.map((l) => (
                    <li key={l.nickname} className="rounded-xl border border-charcoal/10 p-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-charcoal">{l.nickname}</span>
                        {l.nickname === locations.configuredNickname && <StatusBadge value="Configured" tone="success" />}
                        <StatusBadge value={l.verified ? "Verified" : "Unverified"} tone={l.verified ? "success" : "neutral"} />
                      </div>
                      <p className="mt-1 break-words text-charcoal-soft">{[l.name, l.address, l.city, l.state, l.pincode].filter(Boolean).join(", ")}</p>
                      {l.phone && <p className="text-charcoal-soft">{l.phone}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "webhook" && (
        <div role="tabpanel" id="sr-panel-webhook" aria-labelledby="sr-tab-webhook">
          <ShiprocketWebhookPanel bare />
        </div>
      )}

      {tab === "diagnostics" && (
        <div role="tabpanel" id="sr-panel-diagnostics" aria-labelledby="sr-tab-diagnostics" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="admin-btn admin-btn--primary" disabled={testBusy} onClick={testConnection}>
              {testBusy ? "Testing…" : "Test connection"}
            </button>
            {testMessage && <span role="status" className="text-sm text-charcoal-soft">{testMessage}</span>}
          </div>
          {!diag ? <p className="text-sm text-charcoal-soft">{overviewError ? "" : "Loading…"}</p> : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Row label="Last provider error">
                {diag.lastError ? (
                  <span className="text-terracotta">{diag.lastError.message}<br /><span className="text-xs text-charcoal-soft">{diag.lastError.operation} · {fmt(diag.lastError.at)}</span></span>
                ) : "None recorded"}
              </Row>
              <Row label="Last serviceability check">
                {diag.lastServiceability ? (
                  <span>
                    {diag.lastServiceability.ok ? `OK${diag.lastServiceability.couriers != null ? ` · ${diag.lastServiceability.couriers} couriers` : ""}` : <span className="text-terracotta">Failed{diag.lastServiceability.error ? `: ${diag.lastServiceability.error}` : ""}</span>}
                    <br /><span className="text-xs">{diag.lastServiceability.pickupPostcode} → {diag.lastServiceability.deliveryPostcode} · {fmt(diag.lastServiceability.at)}</span>
                  </span>
                ) : "No check yet"}
              </Row>
            </dl>
          )}
        </div>
      )}
    </AdminCard>
  );
}
