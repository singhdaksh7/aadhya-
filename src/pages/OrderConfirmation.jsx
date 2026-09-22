import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { SectionHeading, Button, Tag } from "../components/ui";
import { LoadingNotice, ErrorNotice } from "../components/StateNotice";
import { fetchOrderConfirmation } from "../lib/api";
import { formatInr } from "../lib/format";

export default function OrderConfirmation() {
  const { orderNumber } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    fetchOrderConfirmation(orderNumber, token)
      .then((res) => {
        setOrder(res.data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [orderNumber, token]);

  if (status === "loading") return <LoadingNotice label="Loading your order…" />;
  if (status === "error") {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center sm:px-8">
        <ErrorNotice message="We couldn't find this order confirmation. Check the link, or look it up on the Track Order page." />
        <Button to="/track-order" className="mt-4">
          Track an Order
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
      <title>{`Order ${order.orderNumber} — Aadya Society`}</title>

      <SectionHeading
        eyebrow="Order Confirmed"
        title={`Thank you, ${order.customerName}!`}
        description={`Order ${order.orderNumber} is on its way to being prepared.`}
      />

      <div className="mt-8 flex flex-wrap gap-2">
        <Tag>Order: {order.status}</Tag>
        <Tag>Payment: {order.paymentStatus}</Tag>
      </div>

      <div className="mt-8 rounded-2xl border border-charcoal/10 bg-white/50 p-6">
        <h2 className="font-serif-display text-lg text-charcoal">Items</h2>
        <ul className="mt-4 divide-y divide-charcoal/10">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between py-3 text-sm">
              <span className="text-charcoal">
                {item.productNameSnapshot} × {item.quantity}
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
            <span>{Number(order.shippingAmount) === 0 ? "Free" : formatInr(order.shippingAmount)}</span>
          </div>
          <div className="flex justify-between pt-2 font-serif-display text-base text-charcoal">
            <span>Total</span>
            <span>{formatInr(order.totalAmount)}</span>
          </div>
        </div>
      </div>

      {order.address && (
        <div className="mt-6 rounded-2xl border border-charcoal/10 bg-white/50 p-6">
          <h2 className="font-serif-display text-lg text-charcoal">Shipping Address</h2>
          <p className="mt-2 text-sm leading-relaxed text-charcoal-soft">
            {order.address.fullName}
            <br />
            {order.address.addressLine1}
            {order.address.addressLine2 ? <>, {order.address.addressLine2}</> : null}
            <br />
            {order.address.city}, {order.address.state} {order.address.postalCode}
            <br />
            {order.address.country}
          </p>
        </div>
      )}

      <Link to="/shop" className="mt-8 inline-block text-sm text-charcoal-soft underline underline-offset-4 hover:text-charcoal">
        ← Continue shopping
      </Link>
    </div>
  );
}
