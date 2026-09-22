import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { adminGetOrder, adminUpdateOrderStatus } from "../../lib/api";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import { formatInr } from "../../lib/format";
import { StatusPill } from "./AdminOrderList";

const NEXT_STATUSES = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

export default function AdminOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("loading");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

  const load = () => {
    setStatus("loading");
    adminGetOrder(id)
      .then((res) => {
        setOrder(res.data);
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

  if (status === "loading") return <LoadingNotice />;
  if (status === "error" || !order) return <ErrorNotice message="Unable to load this order." onRetry={load} />;

  const refundNeeded = order.status === "CANCELLED" && order.paymentStatus === "PAID";
  const isTerminal = order.status === "CANCELLED" || order.status === "DELIVERED";

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
          {NEXT_STATUSES.map((s) => (
            <button
              key={s}
              disabled={updating || isTerminal || s === order.status}
              onClick={() => changeStatus(s)}
              className="rounded-full border border-charcoal/20 px-4 py-2 text-xs font-medium text-charcoal hover:bg-charcoal/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}
      </section>
    </div>
  );
}
