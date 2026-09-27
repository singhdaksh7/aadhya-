import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { adminGetOrder, adminUpdateOrderStatus, adminUpsertShipment } from "../../lib/api";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import { formatInr } from "../../lib/format";
import { StatusPill } from "./AdminOrderList";

// Mirrors server/src/modules/orders/orderStatus.js — only these moves are
// legal from a given status, so the UI never even offers an invalid one
// (the server rejects it either way, but this avoids a round-trip 409).
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

  if (status === "loading") return <LoadingNotice />;
  if (status === "error" || !order) return <ErrorNotice message="Unable to load this order." onRetry={load} />;

  const refundNeeded = order.status === "CANCELLED" && order.paymentStatus === "PAID";
  const isTerminal = order.status === "CANCELLED" || order.status === "DELIVERED";
  const nextStatuses = ALLOWED_TRANSITIONS[order.status] || [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif-display text-2xl text-charcoal">{order.orderNumber}</h1>
        <div className="flex gap-2 text-sm">
          <StatusPill value={order.status} />
          <span className="text-charcoal-soft">·</span>
          <StatusPill value={order.paymentStatus} />
        </div>
      </div>
      <p className="mt-1 text-xs text-charcoal-soft">Placed {new Date(order.createdAt).toLocaleString("en-IN")}</p>

      {refundNeeded && (
        <div className="mt-4 rounded-xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
          This order was paid before cancellation. Refund required — process it manually; no automatic refund has
          been issued.
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-charcoal/10 bg-white/50 p-5">
          <h2 className="font-serif-display text-lg text-charcoal">Customer</h2>
          <p className="mt-2 text-sm text-charcoal-soft">
            {order.customerName}
            <br />
            {order.customerEmail}
            <br />
            {order.customerPhone}
          </p>
        </section>

        <section className="rounded-2xl border border-charcoal/10 bg-white/50 p-5">
          <h2 className="font-serif-display text-lg text-charcoal">Shipping Address</h2>
          {order.address ? (
            <p className="mt-2 text-sm text-charcoal-soft">
              {order.address.fullName}
              <br />
              {order.address.addressLine1}
              {order.address.addressLine2 ? <>, {order.address.addressLine2}</> : null}
              <br />
              {order.address.city}, {order.address.state} {order.address.postalCode}
              <br />
              {order.address.country}
            </p>
          ) : (
            <p className="mt-2 text-sm text-charcoal-soft">—</p>
          )}
        </section>

        <section className="rounded-2xl border border-charcoal/10 bg-white/50 p-5 lg:col-span-2">
          <h2 className="font-serif-display text-lg text-charcoal">Items</h2>
          <ul className="mt-3 divide-y divide-charcoal/10">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between py-2.5 text-sm">
                <span className="text-charcoal">
                  {item.productNameSnapshot} ({item.productTypeSnapshot}) × {item.quantity}
                </span>
                <span className="text-charcoal-soft">{formatInr(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1.5 border-t border-charcoal/10 pt-4 text-sm">
            <div className="flex justify-between text-charcoal-soft">
              <span>Subtotal</span>
              <span>{formatInr(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-charcoal-soft">
              <span>Shipping</span>
              <span>{formatInr(order.shippingAmount)}</span>
            </div>
            <div className="flex justify-between font-medium text-charcoal">
              <span>Total</span>
              <span>{formatInr(order.totalAmount)}</span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-charcoal/10 bg-white/50 p-5 lg:col-span-2">
          <h2 className="font-serif-display text-lg text-charcoal">Payments</h2>
          <ul className="mt-3 space-y-2 text-sm text-charcoal-soft">
            {order.payments.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  {p.provider} · {p.providerPaymentId || p.providerOrderId || "no provider reference yet"}
                </span>
                <StatusPill value={p.status} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-charcoal/10 bg-white/50 p-5">
        <h2 className="font-serif-display text-lg text-charcoal">Update Status</h2>
        <p className="mt-1 text-xs text-charcoal-soft">
          Payment status is controlled by the payment workflow and cannot be set manually here.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {isTerminal && <span className="text-xs text-charcoal-soft">This order is {order.status.toLowerCase()} and cannot be changed further.</span>}
          {nextStatuses.map((s) => (
            <button
              key={s}
              disabled={updating}
              onClick={() => changeStatus(s)}
              className="rounded-full border border-charcoal/20 px-4 py-2 text-xs font-medium text-charcoal hover:bg-charcoal/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}

        {order.statusHistory?.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-charcoal/10 pt-4 text-xs text-charcoal-soft">
            {order.statusHistory.map((h) => (
              <li key={h.id}>
                {new Date(h.changedAt).toLocaleString("en-IN")} — {h.fromStatus || "created"} → {h.toStatus}
                {h.note ? ` (${h.note})` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-charcoal/10 bg-white/50 p-5">
        <h2 className="font-serif-display text-lg text-charcoal">Fulfilment / Tracking</h2>
        <form onSubmit={saveShipment} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-charcoal-soft">
            Carrier
            <input
              className="mt-1 w-full rounded-lg border border-charcoal/20 px-3 py-2 text-sm"
              value={shipment.carrier}
              onChange={(e) => setShipment((s) => ({ ...s, carrier: e.target.value }))}
            />
          </label>
          <label className="text-xs text-charcoal-soft">
            Tracking number
            <input
              className="mt-1 w-full rounded-lg border border-charcoal/20 px-3 py-2 text-sm"
              value={shipment.trackingNumber}
              onChange={(e) => setShipment((s) => ({ ...s, trackingNumber: e.target.value }))}
            />
          </label>
          <label className="text-xs text-charcoal-soft sm:col-span-2">
            Tracking URL
            <input
              className="mt-1 w-full rounded-lg border border-charcoal/20 px-3 py-2 text-sm"
              value={shipment.trackingUrl}
              onChange={(e) => setShipment((s) => ({ ...s, trackingUrl: e.target.value }))}
            />
          </label>
          <label className="text-xs text-charcoal-soft">
            Estimated delivery
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-charcoal/20 px-3 py-2 text-sm"
              value={shipment.estimatedDelivery}
              onChange={(e) => setShipment((s) => ({ ...s, estimatedDelivery: e.target.value }))}
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={shipmentSaving}
              className="rounded-full bg-charcoal px-5 py-2 text-xs font-medium text-white disabled:opacity-40"
            >
              {shipmentSaving ? "Saving…" : "Save tracking info"}
            </button>
          </div>
        </form>
        {shipmentError && <p className="mt-3 text-sm text-terracotta">{shipmentError}</p>}
      </section>
    </div>
  );
}
