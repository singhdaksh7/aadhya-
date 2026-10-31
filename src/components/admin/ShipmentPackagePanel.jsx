import { useCallback, useEffect, useState } from "react";
import { adminGetOrderPackage, adminConfirmOrderPackage, adminCheckServiceability, adminCreateShipment } from "../../lib/api";
import { AdminCard } from "./ui";
import { formatInr } from "../../lib/format";

const SOURCE_LABEL = { AUTO_SINGLE: "Automatic (single item)", AUTO_ESTIMATE: "Automatic estimate", MANUAL_OVERRIDE: "Manually set by Admin" };
const num = (v) => (v === "" || v == null ? NaN : Number(v));

// Fulfilment step 1 for Shiprocket orders: the system prepares a package, the Admin confirms or edits it, then
// couriers are checked against exactly that package. The confirmed values are stored as an order snapshot.
export default function ShipmentPackagePanel({ orderId, shipment, onShipment }) {
  const [ctx, setCtx] = useState(null);
  const [form, setForm] = useState({ weightKg: "", lengthCm: "", widthCm: "", heightCm: "" });
  const [presetId, setPresetId] = useState("");
  const [couriers, setCouriers] = useState(null);
  const [courierId, setCourierId] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await adminGetOrderPackage(orderId);
      setCtx(data);
      const base = data.confirmed || data.suggestion;
      setForm({ weightKg: base.weightKg ?? "", lengthCm: base.lengthCm ?? "", widthCm: base.widthCm ?? "", heightCm: base.heightCm ?? "" });
    } catch (err) {
      setError(err.message || "Could not load package details.");
    }
  }, [orderId]);
  useEffect(() => { load(); }, [load]);

  if (!ctx || ctx.provider !== "SHIPROCKET") return null;

  const locked = !!ctx.confirmed?.locked || !!shipment?.providerShipmentId;
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setCouriers(null); };
  const volumetric = (() => {
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

  const confirmAndCheck = async () => {
    setBusy("check"); setError(null);
    try {
      const payload = { weightKg: num(form.weightKg), lengthCm: num(form.lengthCm), widthCm: num(form.widthCm), heightCm: num(form.heightCm), presetId: presetId || null };
      if (Object.values(payload).some((v) => typeof v === "number" && Number.isNaN(v))) throw new Error("Enter weight and all three dimensions.");
      const saved = await adminConfirmOrderPackage(orderId, payload);
      setCtx(saved.data);
      const res = await adminCheckServiceability(orderId);
      setCouriers(res.data);
      setCourierId(res.data.recommendedCourierCompanyId ?? res.data.couriers[0]?.courierCompanyId ?? null);
    } catch (err) {
      setError(err.message || "Could not confirm the package.");
    } finally { setBusy(null); }
  };

  const createShipment = async () => {
    setBusy("create"); setError(null);
    try {
      const res = await adminCreateShipment(orderId, courierId ? { courierCompanyId: courierId } : {});
      onShipment?.(res.data);
      await load();
    } catch (err) {
      setError(err.message || "Shiprocket could not create the shipment.");
      await load();
    } finally { setBusy(null); }
  };

  const s = ctx.suggestion;
  const field = (label, key, unit) => (
    <label className="admin-label">
      {label} ({unit})
      <input className="admin-input" inputMode="decimal" value={form[key]} disabled={locked} onChange={set(key)} />
    </label>
  );

  return (
    <AdminCard title="Ship with Shiprocket · Package">
      <p className="text-xs text-charcoal-soft">These values are the default package for courier and serviceability calculations. They are saved with the order once confirmed.</p>
      {s.warnings?.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-terracotta">{s.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}

      <table className="mt-3 w-full text-left text-xs">
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

      <p className="mt-3 text-xs text-charcoal-soft">
        {s.productWeightKg != null ? `Items ${s.productWeightKg} kg + packaging ${s.tareKg} kg = suggested ${s.weightKg} kg. ` : ""}
        {ctx.confirmed ? `Confirmed: ${SOURCE_LABEL[ctx.confirmed.source] || ctx.confirmed.source}${ctx.confirmed.presetName ? ` · preset ${ctx.confirmed.presetName}` : ""}${locked ? " · locked (shipment created)" : ""}.` : "Not confirmed yet."}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {field("Dead weight", "weightKg", "kg")}
        {field("Length", "lengthCm", "cm")}
        {field("Width", "widthCm", "cm")}
        {field("Height", "heightCm", "cm")}
      </div>
      {volumetric != null && <p className="mt-2 text-xs text-charcoal-soft">Estimated volumetric weight: {volumetric.toFixed(2)} kg (÷ {ctx.volumetricDivisor}). Estimate only: the courier's chargeable weight below is what is billed.</p>}

      {!locked && ctx.presets.length > 0 && (
        <label className="admin-label mt-3 max-w-xs">
          Use package preset (optional)
          <select className="admin-input" value={presetId} onChange={(e) => applyPreset(e.target.value)}>
            <option value="">None</option>
            {ctx.presets.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.lengthCm}×{p.widthCm}×{p.heightCm} cm</option>)}
          </select>
        </label>
      )}

      {!locked && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="admin-btn admin-btn--primary" disabled={busy} onClick={confirmAndCheck}>
            {busy === "check" ? "Checking…" : "Confirm Package & Check Couriers"}
          </button>
        </div>
      )}

      {couriers && !locked && (
        <div className="mt-4">
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
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="admin-btn admin-btn--accent" disabled={busy || !courierId} onClick={createShipment}>
              {busy === "create" ? "Creating…" : "Create Shiprocket shipment"}
            </button>
          </div>
          <p className="mt-2 text-xs text-charcoal-soft">This creates a real Shiprocket order{courierId ? " and assigns the selected courier (AWB)" : ""}. Pickup is scheduled separately below.</p>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-terracotta">{error}</p>}
    </AdminCard>
  );
}
