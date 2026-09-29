import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  adminGetOrder,
  adminUpdateOrderStatus,
  adminUpsertShipment,
  adminCreateShipment,
  adminGenerateShipmentAwb,
  adminScheduleShipmentPickup,
  adminGetShipmentLabel,
  adminRefreshTracking,
  adminDownloadInvoice,
  adminRegenerateInvoice,
  adminResendInvoice,
} from "../../lib/api";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import { formatInr } from "../../lib/format";
import { StatusBadge, AdminCard, PageHeader } from "../../components/admin/ui";

const ALLOWED_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export default function AdminOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("loading");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [shipment, setShipment] = useState({ carrier: "", trackingNumber: "", trackingUrl: "", estimatedDelivery: "" });
  const [shipmentSaving, setShipmentSaving] = useState(false);
  const [shipmentError, setShipmentError] = useState(null);
  const [providerActionBusy, setProviderActionBusy] = useState(null);
  const [providerActionError, setProviderActionError] = useState(null);

  const load = () => {
    setStatus("loading");
    adminGetOrder(id)
      .then((res) => {
        setOrder(res.data);
        if (res.data.shipment) {
          setShipment({
            carrier: res.data.shipment.carrier || "",
            trackingNumber: res.data.shipment.trackingNumber || "",
            trackingUrl: res.data.shipment.trackingUrl || "",
            estimatedDelivery: res.data.shipment.estimatedDelivery
              ? res.data.shipment.estimatedDelivery.slice(0, 10)
              : "",
          });
        }
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  };

  useEffect(load, [id]);

  const changeStatus = async (nextStatus) => {
    setUpdating(true);
    setError(null);
    try {
      const res = await adminUpdateOrderStatus(id, nextStatus);
      setOrder(res.data);
    } catch (err) {
      setError(err.message || "Could not update order status.");
    } finally {
      setUpdating(false);
    }
  };

  const saveShipment = async (e) => {
    e.preventDefault();
    setShipmentSaving(true);
    setShipmentError(null);
    try {
      const res = await adminUpsertShipment(id, {
        carrier: shipment.carrier || null,
        trackingNumber: shipment.trackingNumber || null,
        trackingUrl: shipment.trackingUrl || null,
        estimatedDelivery: shipment.estimatedDelivery || null,
      });
      setOrder((prev) => ({ ...prev, shipment: res.data }));
    } catch (err) {
      setShipmentError(err.message || "Could not save tracking info.");
    } finally {
      setShipmentSaving(false);
    }
  };

  const PICKUP_DONE_STATUSES = ["PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];
  const providerShipment = order?.shipment;
  const canCreateShipment = !providerShipment || providerShipment.status === "CREATION_FAILED" || providerShipment.status === "FAILED";
  const canGenerateAwb = !!providerShipment && !!providerShipment.providerShipmentId && !providerShipment.awb;
  const canSchedulePickup = !!providerShipment && !!providerShipment.awb && !PICKUP_DONE_STATUSES.includes(providerShipment.status);
  const canDownloadLabel = !!providerShipment && !!providerShipment.providerShipmentId;
  const canRefreshTracking = !!providerShipment && !!providerShipment.providerShipmentId;

  const runProviderAction = async (key, fn) => {
    setProviderActionBusy(key);
    setProviderActionError(null);
    try {
      const res = await fn();
      setOrder((prev) => ({ ...prev, shipment: res.data }));
    } catch (err) {
      setProviderActionError(err.message || "Action failed.");
    } finally {
      setProviderActionBusy(null);
    }
  };

  const downloadLabel = async () => {
    setProviderActionBusy("label");
    setProviderActionError(null);
    try {
      const res = await adminGetShipmentLabel(id);
      const url = res.data?.label_url || res.data?.labelUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else setProviderActionError("No label URL returned by the provider yet.");
    } catch (err) {
      setProviderActionError(err.message || "Could not fetch label.");
    } finally {
      setProviderActionBusy(null);
    }
  };

  const downloadInvoice = async () => {
    const blob = await adminDownloadInvoice(order.invoice.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${order.invoice.invoiceNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (status === "loading") return <LoadingNotice />;
  if (status === "error" || !order) return <ErrorNotice message="Unable to load this order." onRetry={load} />;

  const refundNeeded = order.status === "CANCELLED" && order.paymentStatus === "PAID";
  const isTerminal = order.status === "CANCELLED" || order.status === "DELIVERED";
  const nextStatuses = ALLOWED_TRANSITIONS[order.status] || [];

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title={order.orderNumber}
        description={`Placed ${new Date(order.createdAt).toLocaleString("en-IN")}`}
        actions={
          <>
            <StatusBadge value={order.status} />
            <StatusBadge value={order.paymentStatus} />
            <Link to="/admin/orders" className="admin-btn admin-btn--ghost">
              Back
            </Link>
          </>
        }
      />

      {refundNeeded && (
        <div className="mb-4 rounded-xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
          This order was paid before cancellation. Refund required — process it manually; no automatic refund has been
          issued.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 min-w-0">
          <AdminCard title="Items">
            <ul className="divide-y divide-charcoal/10">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 py-2.5 text-sm">
                  <span className="text-charcoal">
                    {item.productNameSnapshot} ({item.productTypeSnapshot}) × {item.quantity}
                  </span>
                  <span className="text-charcoal-soft shrink-0">{formatInr(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </AdminCard>

          <AdminCard title="Payment">
            <ul className="space-y-2 text-sm text-charcoal-soft">
              {order.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {p.provider} · {p.providerPaymentId || p.providerOrderId || "no provider reference yet"}
                  </span>
                  <StatusBadge value={p.status} />
                </li>
              ))}
            </ul>
          </AdminCard>

          <AdminCard title="Invoice">
            {order.invoice ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold text-charcoal">{order.invoice.invoiceNumber}</span>
                <span className="text-charcoal-soft">
                  Generated {new Date(order.invoice.createdAt).toLocaleDateString("en-IN")}
                </span>
                <StatusBadge value={order.invoice.emailedAt ? "Emailed" : "Not emailed"} tone={order.invoice.emailedAt ? "success" : "neutral"} />
                <button type="button" onClick={downloadInvoice} className="admin-btn admin-btn--ghost">
                  Download
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await adminRegenerateInvoice(order.invoice.id);
                    load();
                  }}
                  className="admin-btn admin-btn--ghost"
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await adminResendInvoice(order.invoice.id);
                    load();
                  }}
                  className="admin-btn admin-btn--ghost"
                >
                  Resend
                </button>
              </div>
            ) : (
              <p className="text-sm text-charcoal-soft">
                Invoice will be generated after the configured payment/confirmation event.
              </p>
            )}
          </AdminCard>

          <AdminCard title="Shipment / Tracking">
            <form onSubmit={saveShipment} className="admin-form-grid sm:grid-cols-2">
              <label className="admin-label">
                Carrier
                <input
                  className="admin-input"
                  value={shipment.carrier}
                  onChange={(e) => setShipment((s) => ({ ...s, carrier: e.target.value }))}
                />
              </label>
              <label className="admin-label">
                Tracking number
                <input
                  className="admin-input"
                  value={shipment.trackingNumber}
                  onChange={(e) => setShipment((s) => ({ ...s, trackingNumber: e.target.value }))}
                />
              </label>
              <label className="admin-label sm:col-span-2">
                Tracking URL
                <input
                  className="admin-input"
                  value={shipment.trackingUrl}
                  onChange={(e) => setShipment((s) => ({ ...s, trackingUrl: e.target.value }))}
                />
              </label>
              <label className="admin-label">
                Estimated delivery
                <input
                  type="date"
                  className="admin-input"
                  value={shipment.estimatedDelivery}
                  onChange={(e) => setShipment((s) => ({ ...s, estimatedDelivery: e.target.value }))}
                />
              </label>
              <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
                <button type="submit" disabled={shipmentSaving} className="admin-btn admin-btn--primary">
                  {shipmentSaving ? "Saving…" : "Save tracking"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await adminCreateShipment(id, shipment);
                      setOrder((prev) => ({ ...prev, shipment: res.data }));
                    } catch (err) {
                      setShipmentError(err.message);
                    }
                  }}
                  className="admin-btn admin-btn--ghost"
                >
                  Create Shipment
                </button>
              </div>
            </form>
            {shipmentError && <p className="mt-3 text-sm text-terracotta">{shipmentError}</p>}
          </AdminCard>

          <AdminCard title="Provider Shipment">
            {providerShipment ? (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-charcoal-soft">Provider</dt>
                <dd>{providerShipment.provider || "—"}</dd>
                <dt className="text-charcoal-soft">Shipment ID</dt>
                <dd>{providerShipment.providerShipmentId || "—"}</dd>
                <dt className="text-charcoal-soft">AWB</dt>
                <dd>{providerShipment.awb || "—"}</dd>
                <dt className="text-charcoal-soft">Courier</dt>
                <dd>{providerShipment.carrier || "—"}</dd>
                <dt className="text-charcoal-soft">Status</dt>
                <dd><StatusBadge status={providerShipment.status} /></dd>
                <dt className="text-charcoal-soft">Tracking</dt>
                <dd>
                  {providerShipment.trackingUrl ? (
                    <a href={providerShipment.trackingUrl} target="_blank" rel="noreferrer" className="underline">
                      {providerShipment.trackingNumber || "Track"}
                    </a>
                  ) : (
                    providerShipment.trackingNumber || "—"
                  )}
                </dd>
                {providerShipment.lastError && (
                  <>
                    <dt className="text-charcoal-soft">Last error</dt>
                    <dd className="text-terracotta">{providerShipment.lastError}</dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="text-sm text-charcoal-soft">No provider shipment yet for this order.</p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canCreateShipment || providerActionBusy === "create"}
                onClick={() => runProviderAction("create", () => adminCreateShipment(id, {}))}
                className="admin-btn admin-btn--primary"
                title={!canCreateShipment ? "A shipment already exists for this order." : ""}
              >
                {providerActionBusy === "create" ? "Creating…" : providerShipment?.status === "CREATION_FAILED" ? "Retry Create Shipment" : "Create Shipment"}
              </button>
              <button
                type="button"
                disabled={!canGenerateAwb || providerActionBusy === "awb"}
                onClick={() => runProviderAction("awb", () => adminGenerateShipmentAwb(id))}
                className="admin-btn admin-btn--ghost"
                title={!canGenerateAwb ? "Create the shipment first, or an AWB already exists." : ""}
              >
                {providerActionBusy === "awb" ? "Generating…" : "Generate AWB"}
              </button>
              <button
                type="button"
                disabled={!canSchedulePickup || providerActionBusy === "pickup"}
                onClick={() => runProviderAction("pickup", () => adminScheduleShipmentPickup(id))}
                className="admin-btn admin-btn--ghost"
                title={!canSchedulePickup ? "Generate an AWB first, or pickup is already scheduled." : ""}
              >
                {providerActionBusy === "pickup" ? "Scheduling…" : "Schedule Pickup"}
              </button>
              <button
                type="button"
                disabled={!canDownloadLabel || providerActionBusy === "label"}
                onClick={downloadLabel}
                className="admin-btn admin-btn--ghost"
                title={!canDownloadLabel ? "Create the shipment first." : ""}
              >
                {providerActionBusy === "label" ? "Fetching…" : "Download Label"}
              </button>
              <button
                type="button"
                disabled={!canRefreshTracking || providerActionBusy === "tracking"}
                onClick={() => runProviderAction("tracking", () => adminRefreshTracking(id))}
                className="admin-btn admin-btn--ghost"
                title={!canRefreshTracking ? "Create the shipment first." : ""}
              >
                {providerActionBusy === "tracking" ? "Refreshing…" : "Refresh Tracking"}
              </button>
            </div>
            {providerActionError && <p className="mt-3 text-sm text-terracotta">{providerActionError}</p>}
          </AdminCard>

          {order.statusHistory?.length > 0 && (
            <AdminCard title="Communication / History">
              <ul className="space-y-1.5 text-xs text-charcoal-soft">
                {order.statusHistory.map((h) => (
                  <li key={h.id}>
                    {new Date(h.changedAt).toLocaleString("en-IN")} — {h.fromStatus || "created"} → {h.toStatus}
                    {h.note ? ` (${h.note})` : ""}
                  </li>
                ))}
              </ul>
            </AdminCard>
          )}
        </div>

        <aside className="space-y-4">
          <AdminCard title="Customer">
            <p className="text-sm text-charcoal-soft leading-relaxed">
              {order.customerName}
              <br />
              {order.customerEmail}
              <br />
              {order.customerPhone}
            </p>
          </AdminCard>

          <AdminCard title="Billing address">
            {order.billingAddress || order.address ? (
              <AddressBlock address={order.billingAddress || order.address} />
            ) : (
              <p className="text-sm text-charcoal-soft">—</p>
            )}
          </AdminCard>

          <AdminCard title="Shipping address">
            {order.address ? <AddressBlock address={order.address} /> : <p className="text-sm text-charcoal-soft">—</p>}
          </AdminCard>

          <AdminCard title="Order summary">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-charcoal-soft">
                <span>Subtotal</span>
                <span>{formatInr(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-charcoal-soft">
                <span>Shipping</span>
                <span>{formatInr(order.shippingAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-charcoal border-t border-charcoal/10 pt-2">
                <span>Total</span>
                <span>{formatInr(order.totalAmount)}</span>
              </div>
            </div>
          </AdminCard>

          <AdminCard title="Status controls">
            <p className="text-xs text-charcoal-soft">
              Payment status is controlled by the payment workflow and cannot be set manually here.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {isTerminal && (
                <span className="text-xs text-charcoal-soft">
                  This order is {order.status.toLowerCase()} and cannot be changed further.
                </span>
              )}
              {nextStatuses.map((s) => (
                <button
                  key={s}
                  disabled={updating}
                  onClick={() => changeStatus(s)}
                  className="admin-btn admin-btn--ghost"
                >
                  {s}
                </button>
              ))}
            </div>
            {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}
          </AdminCard>
        </aside>
      </div>
    </div>
  );
}

function AddressBlock({ address }) {
  return (
    <p className="text-sm text-charcoal-soft leading-relaxed">
      {address.fullName}
      <br />
      {address.addressLine1}
      {address.addressLine2 ? <>, {address.addressLine2}</> : null}
      <br />
      {address.city}, {address.state} {address.postalCode}
      <br />
      {address.country}
    </p>
  );
}
