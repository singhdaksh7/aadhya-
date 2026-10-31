import { useCallback, useEffect, useState } from "react";
import {
  adminGetOrderPackage,
  adminConfirmOrderPackage,
  adminCheckServiceability,
  adminCreateShipment,
  adminGenerateShipmentAwb,
  adminScheduleShipmentPickup,
  adminGetShipmentLabel,
  adminRefreshTracking,
  adminCancelShipment,
} from "../../lib/api";
import { AdminCard, StatusBadge } from "./ui";
import { formatInr } from "../../lib/format";

const SOURCE_LABEL = { AUTO_SINGLE: "Automatic (single item)", AUTO_ESTIMATE: "Automatic estimate", MANUAL_OVERRIDE: "Manually set by Admin" };
const STEP_LABEL = {
  NOT_CREATED: "Package",
  PACKAGE_CONFIRMED: "Package confirmed",
  SHIPMENT_CREATED: "Shipment created",
  AWB_ASSIGNED: "AWB assigned",
  PICKUP_SCHEDULED: "Pickup scheduled",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
};
const num = (v) => (v === "" || v == null ? NaN : Number(v));
const fmt = (v) => (v ? new Date(v).toLocaleString("en-IN") : "—");
const safeHref = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : null);

export function StepIndicator({ steps = [], step }) {
  const current = Math.max(0, steps.indexOf(step));
  return (
    <ol aria-label="Fulfilment progress" data-testid="fulfilment-steps" className="flex flex-wrap gap-x-1 gap-y-2 text-xs">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li
            key={s}
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
            className={`rounded-full border px-2.5 py-1 ${state === "current" ? "border-charcoal bg-charcoal text-white" : state === "done" ? "border-charcoal/30 bg-charcoal/5 text-charcoal" : "border-charcoal/10 text-charcoal-soft"}`}
          >
            {state === "done" ? "✓ " : ""}
            {STEP_LABEL[s] || s}
          </li>
        );
      })}
    </ol>
  );
}

// One Shiprocket fulfilment flow. Which buttons exist is decided ONLY by order.fulfilment.actions (server truth).
// After every action the order is re-fetched through onChanged so steps/buttons never go stale.
export default function ShipmentPackagePanel({ orderId, order, onChanged }) {
  const fulfilment = order?.fulfilment;
  const shipment = order?.shipment;
  const actions = fulfilment?.actions || {};
  const isShiprocket = fulfilment?.provider === "SHIPROCKET";

  const [ctx, setCtx] = useState(null);
  const [form, setForm] = useState({ weightKg: "", lengthCm: "", widthCm: "", heightCm: "" });
  const [presetId, setPresetId] = useState("");
  const [couriers, setCouriers] = useState(null);
  const [courierId, setCourierId] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const loadPackage = useCallback(async () => {
    try {
      const { data } = await adminGetOrderPackage(orderId);
      setCtx(data);
      const base = data.confirmed || data.suggestion;
      if (base) setForm({ weightKg: base.weightKg ?? "", lengthCm: base.lengthCm ?? "", widthCm: base.widthCm ?? "", heightCm: base.heightCm ?? "" });
    } catch (err) {
      setError(err.message || "Could not load package details.");
    }
  }, [orderId]);
  useEffect(() => { if (isShiprocket) loadPackage(); }, [isShiprocket, loadPackage]);

  if (!fulfilment || !isShiprocket) return null;

  const locked = !actions.confirmPackage;
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setCouriers(null); };
  const volumetric = (() => {
    if (!ctx) return null;
    const [l, w, h] = [num(form.lengthCm), num(form.widthCm), num(form.heightCm)];
    return [l, w, h].every((n) => n > 0) ? (l * w * h) / ctx.volumetricDivisor : null;
  })();

  const applyPreset = (id) => {
    setPresetId(id);
    setCouriers(null);
    const p = ctx.presets.find((x) => x.id === id);
    if (!p) return;
    const productKg = ctx.suggestion.productWeightKg;
    setForm({ weightKg: productKg != null ? Number((productKg + (p.tareKg || 0)).toFixed(3)) : form.weightKg, lengthCm: p.lengthCm, widthCm: p.widthCm, heightCm: p.heightCm });
  };

  // Runs one action, then always re-fetches the order (and package) so state and buttons stay in sync.
  const run = async (key, fn, fallback) => {
    setBusy(key); setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err.message || fallback);
    } finally {
      try { await onChanged?.(); await loadPackage(); } catch { /* the page shows its own load error */ }
      setBusy(null);
    }
  };

  const applyCouriers = (data) => {
    setCouriers(data);
    setCourierId((cur) => cur ?? data.recommendedCourierCompanyId ?? data.couriers?.[0]?.courierCompanyId ?? null);
  };

  const confirmAndCheck = () => run("check", async () => {
    const payload = { weightKg: num(form.weightKg), lengthCm: num(form.lengthCm), widthCm: num(form.widthCm), heightCm: num(form.heightCm), presetId: presetId || null };
    if (Object.entries(payload).some(([k, v]) => k !== "presetId" && Number.isNaN(v))) throw new Error("Enter weight and all three dimensions.");
    await adminConfirmOrderPackage(orderId, payload);
    const res = await adminCheckServiceability(orderId);
    setCourierId(null);
    applyCouriers(res.data);
  }, "Could not confirm the package.");

  const checkCouriers = () => run("check", async () => { applyCouriers((await adminCheckServiceability(orderId)).data); }, "Could not check couriers.");
  const createShipment = () => run("create", async () => { await adminCreateShipment(orderId, courierId ? { courierCompanyId: courierId } : {}); }, "Shiprocket could not create the shipment.");
  const assignAwb = () => run("awb", async () => { await adminGenerateShipmentAwb(orderId, courierId ? { courierCompanyId: courierId } : {}); }, "Could not assign an AWB.");
  const schedulePickup = () => run("pickup", async () => { await adminScheduleShipmentPickup(orderId); }, "Could not schedule pickup.");
  const refreshTracking = () => run("tracking", async () => { await adminRefreshTracking(orderId); }, "Could not refresh tracking.");
  const downloadLabel = () => run("label", async () => {
    const res = await adminGetShipmentLabel(orderId);
    const url = safeHref(res.data?.label_url || res.data?.labelUrl);
    if (!url) throw new Error("No label URL returned by Shiprocket yet.");
    window.open(url, "_blank", "noopener,noreferrer");
  }, "Could not fetch the label.");
  const cancelShipment = () => {
    if (!window.confirm("Cancel this shipment at Shiprocket? This sends a cancellation request to Shiprocket. The order's shipment will only be marked cancelled here after Shiprocket confirms it.")) return;
    return run("cancel", async () => { await adminCancelShipment(orderId); }, "Shiprocket did not confirm the cancellation.");
  };

  const s = ctx?.suggestion;
  const field = (label, key, unit) => (
    <label className="admin-label">
      {label} ({unit})
      <input className="admin-input" inputMode="decimal" value={form[key]} disabled={locked} onChange={set(key)} />
    </label>
  );
  const btn = (label, busyLabel, key, onClick, cls = "admin-btn--ghost") => (
    <button key={key} type="button" className={`admin-btn ${cls}`} disabled={!!busy} onClick={onClick}>
      {busy === key ? busyLabel : label}
    </button>
  );
  const trackHref = safeHref(shipment?.trackingUrl);
  const events = shipment?.events || [];
  const showCourierTable = couriers && (actions.createShipment || actions.assignAwb || actions.checkServiceability);
  const live = !!shipment?.providerShipmentId;

  return (
    <AdminCard
      title="Fulfilment · Shiprocket"
      actions={shipment?.status ? <StatusBadge value={shipment.status} /> : null}
    >
      <div data-testid="fulfilment-card" className="space-y-4">
        <StepIndicator steps={fulfilment.steps} step={fulfilment.step} />

        {fulfilment.blockers?.length > 0 && (
          <div role="alert" data-testid="fulfilment-blockers" className="rounded-xl border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-sm text-terracotta">
            <p className="font-medium">Resolve before shipping</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
              {fulfilment.blockers.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </div>
        )}

        {ctx && s && (
          <section aria-label="Package" className="min-w-0">
            <p className="text-xs text-charcoal-soft">These values are the default package for courier and serviceability calculations. They are saved with the order once confirmed.</p>
            {s.warnings?.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-terracotta">{s.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-charcoal-soft"><tr><th className="py-1">Item</th><th>Qty</th><th>Weight</th><th>Size (L×W×H cm)</th></tr></thead>
                <tbody>
                  {ctx.items.map((i) => (
                    <tr key={i.name} className="border-t border-black/10">
                      <td className="py-1 pr-2">{i.name}</td><td>{i.quantity}</td>
                      <td>{i.weightKg != null ? `${i.weightKg} kg` : <span className="text-terracotta">missing</span>}</td>
                      <td>{i.lengthCm != null && i.widthCm != null && i.heightCm != null ? `${i.lengthCm} × ${i.widthCm} × ${i.heightCm}` : <span className="text-terracotta">missing</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-charcoal-soft">
              {s.productWeightKg != null ? `Items ${s.productWeightKg} kg + packaging ${s.tareKg} kg = suggested ${s.weightKg} kg. ` : ""}
              {ctx.confirmed ? `Confirmed: ${SOURCE_LABEL[ctx.confirmed.source] || ctx.confirmed.source}${ctx.confirmed.presetName ? ` · preset ${ctx.confirmed.presetName}` : ""}${locked ? " · locked" : ""}.` : "Not confirmed yet."}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {field("Dead weight", "weightKg", "kg")}
              {field("Length", "lengthCm", "cm")}
              {field("Width", "widthCm", "cm")}
              {field("Height", "heightCm", "cm")}
            </div>
            {volumetric != null && <p className="mt-2 text-xs text-charcoal-soft">Estimated volumetric weight: {volumetric.toFixed(2)} kg (÷ {ctx.volumetricDivisor}). Estimate only: the courier's chargeable weight below is what is billed.</p>}

            {actions.confirmPackage && ctx.presets?.length > 0 && (
              <label className="admin-label mt-3 max-w-xs">
                Use package preset (optional)
                <select className="admin-input" value={presetId} onChange={(e) => applyPreset(e.target.value)}>
                  <option value="">None</option>
                  {ctx.presets.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.lengthCm}×{p.widthCm}×{p.heightCm} cm</option>)}
                </select>
              </label>
            )}
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          {actions.confirmPackage
            ? btn("Confirm Package & Check Couriers", "Checking…", "check", confirmAndCheck, "admin-btn--primary")
            : actions.checkServiceability && btn("Check couriers", "Checking…", "check", checkCouriers, "admin-btn--primary")}
        </div>

        {showCourierTable && (
          <div>
            <p className="text-sm font-medium">{couriers.cod ? "COD" : "Prepaid"} · {couriers.pickupPostcode} → {couriers.deliveryPostcode}</p>
            {couriers.couriers.length === 0 ? (
              <p className="mt-2 text-sm text-terracotta">No courier can serve this package{couriers.cod ? " with COD" : ""}. Adjust the package or contact Shiprocket.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-charcoal-soft"><tr><th></th><th>Courier</th><th>Rate</th><th>Delivery</th><th>COD</th><th>Rating</th></tr></thead>
                  <tbody>
                    {couriers.couriers.map((c) => (
                      <tr key={c.courierCompanyId} className="border-t border-black/10">
                        <td className="py-1"><input type="radio" name="courier" checked={courierId === c.courierCompanyId} onChange={() => setCourierId(c.courierCompanyId)} aria-label={`Choose ${c.name}`} /></td>
                        <td>{c.name}{c.courierCompanyId === couriers.recommendedCourierCompanyId && <span className="ml-1 rounded bg-black/5 px-1">Recommended</span>}</td>
                        <td>{formatInr(c.rate)}</td>
                        <td>{c.etd || (c.estimatedDeliveryDays ? `${c.estimatedDeliveryDays} days` : "—")}</td>
                        <td>{c.cod ? "Yes" : "No"}</td>
                        <td>{c.rating ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {actions.createShipment && couriers && (
            <button type="button" className="admin-btn admin-btn--accent" disabled={!!busy || !courierId} onClick={createShipment}>
              {busy === "create" ? "Creating…" : "Create Shiprocket shipment"}
            </button>
          )}
          {actions.assignAwb && !couriers && btn("Choose courier (optional)", "Loading…", "check", checkCouriers)}
          {actions.assignAwb && btn("Assign AWB", "Assigning…", "awb", assignAwb, "admin-btn--primary")}
          {actions.schedulePickup && btn("Schedule pickup", "Scheduling…", "pickup", schedulePickup, "admin-btn--primary")}
          {actions.downloadLabel && btn("Download label", "Fetching…", "label", downloadLabel)}
          {actions.refreshTracking && btn("Refresh tracking", "Refreshing…", "tracking", refreshTracking)}
          {actions.cancelShipment && btn("Cancel shipment", "Cancelling…", "cancel", cancelShipment)}
        </div>
        {actions.createShipment && couriers && <p className="text-xs text-charcoal-soft">This creates a real Shiprocket order{courierId ? " and assigns the selected courier (AWB)" : ""}. Pickup is scheduled separately.</p>}

        {error && <p role="alert" data-testid="fulfilment-error" className="text-sm text-terracotta">{error}</p>}

        {shipment && (
          <section aria-label="Shipment details" data-testid="shipment-details">
            <h4 className="text-sm font-semibold text-charcoal">Shipment</h4>
            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
              {[
                ["Shiprocket order ID", shipment.providerOrderId],
                ["Shipment ID", shipment.providerShipmentId],
                ["AWB", shipment.awb],
                ["Courier", shipment.carrier],
                ["Status", shipment.status ? String(shipment.status).replaceAll("_", " ") : null],
                ["Pickup status", shipment.pickupStatus],
                ["Expected delivery", shipment.estimatedDelivery ? new Date(shipment.estimatedDelivery).toLocaleDateString("en-IN") : null],
                ["Last synced", shipment.lastSyncedAt ? fmt(shipment.lastSyncedAt) : null],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0"><dt className="inline font-medium text-charcoal">{k}: </dt><dd className="inline break-all text-charcoal-soft">{v || "—"}</dd></div>
              ))}
              <div className="min-w-0">
                <dt className="inline font-medium text-charcoal">Tracking: </dt>
                <dd className="inline break-all text-charcoal-soft">
                  {trackHref ? <a href={trackHref} target="_blank" rel="noreferrer" className="underline">Open tracking link</a> : "—"}
                </dd>
              </div>
              {shipment.lastError && <div className="min-w-0 sm:col-span-2"><dt className="inline font-medium text-terracotta">Last error: </dt><dd className="inline text-terracotta">{shipment.lastError}</dd></div>}
            </dl>
            {live && events.length > 0 && (
              <div className="mt-3">
                <h5 className="text-xs font-semibold text-charcoal">Shipment events</h5>
                <ol className="mt-1 space-y-1 border-l border-charcoal/15 pl-3 text-xs text-charcoal-soft" data-testid="shipment-events">
                  {events.map((ev, i) => (
                    <li key={`${ev.status}-${ev.occurredAt}-${i}`}>
                      <span className="text-charcoal">{ev.label || ev.status}</span> · {fmt(ev.occurredAt)}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        )}
      </div>
    </AdminCard>
  );
}
