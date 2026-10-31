import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  adminGetOrder,
  adminUpdateOrderStatus,
  adminUpsertShipment,
  adminCreateShipment,
  adminDownloadInvoice,
  adminRegenerateInvoice,
  adminResendInvoice,
} from "../../lib/api";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import { formatInr } from "../../lib/format";
import { StatusBadge, AdminCard, PageHeader } from "../../components/admin/ui";
import ShipmentPackagePanel from "../../components/admin/ShipmentPackagePanel";

const ALLOWED_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
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

  const load = (silent = false) => {
    if (silent !== true) setStatus("loading");
    return adminGetOrder(id)
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
      .catch(() => { if (silent !== true) setStatus("error"); });
  };

  useEffect(() => { load(); }, [id]);

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
  if (status === "error" || !order) return <ErrorNotice message="Unable to load this order." onRetry={() => load()} />;

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
            <ul className="space-y-3 text-sm text-charcoal-soft" data-testid="admin-payments">
              {order.payments.map((p) => (
                <li key={p.id} className="space-y-1 rounded-xl border border-charcoal/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-charcoal">
                      {p.provider === "cashfree" ? "Cashfree" : p.provider === "cod" ? "Cash on Delivery" : p.provider}
                      {p.method && p.provider !== "cod" ? ` · ${p.method}` : ""}
                    </span>
                    <StatusBadge value={p.status} />
                  </div>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                    <div><dt className="inline font-medium">Amount: </dt><dd className="inline">₹{Number(p.amount).toLocaleString("en-IN")} {p.currency}</dd></div>
                    {p.providerOrderId && <div><dt className="inline font-medium">Provider order ID: </dt><dd className="inline font-mono">{p.providerOrderId}</dd></div>}
                    {p.providerPaymentId && <div><dt className="inline font-medium">Payment ID: </dt><dd className="inline font-mono">{p.providerPaymentId}</dd></div>}
                    {Number(p.refundedAmount) > 0 && <div><dt className="inline font-medium">Refunded: </dt><dd className="inline">₹{Number(p.refundedAmount).toLocaleString("en-IN")}</dd></div>}
                    <div><dt className="inline font-medium">Created: </dt><dd className="inline">{new Date(p.createdAt).toLocaleString("en-IN")}</dd></div>
                    <div><dt className="inline font-medium">Updated: </dt><dd className="inline">{new Date(p.updatedAt).toLocaleString("en-IN")}</dd></div>
                  </dl>
                  {!p.providerOrderId && p.provider !== "cod" && <p className="text-xs">No provider reference yet.</p>}
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

          {order.fulfilment?.provider !== "SHIPROCKET" && (
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
          )}

          <ShipmentPackagePanel orderId={id} order={order} onChanged={() => load(true)} />

          {order.statusHistory?.length > 0 && (
            <AdminCard title="Communication / History">
              <ul className="space-y-1.5 text-xs text-charcoal-soft">
                {order.statusHistory.map((h) => (
                  <li key={h.id}>
                    {new Date(h.changedAt).toLocaleString("en-IN")} — {String(h.fromStatus || "created").replaceAll("_", " ")} → {String(h.toStatus).replaceAll("_", " ")}
                    {h.note ? ` (${h.note})` : ""}
                    {h.source ? ` · by ${h.source === "ADMIN" ? "Admin" : h.source === "SHIPROCKET" ? "Shiprocket" : h.source === "PAYMENT" ? "payment" : "system"}` : ""}
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
