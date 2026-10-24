import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { verifyCashfreePayment } from "../lib/api";
import { useCart } from "../context/CartContext";

// Landing page for Cashfree's redirect (used when the popup cannot open, e.g. in-app browsers).
// The query string is NOT trusted: it only names the order; the server checks the real status with Cashfree.
export default function PaymentReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [state, setState] = useState("checking");

  useEffect(() => {
    const cashfreeOrderId = params.get("order_id");
    if (!cashfreeOrderId) {
      setState("error");
      return;
    }
    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem("tushaqsa.pendingPayment") || "null"); } catch { pending = null; }
    verifyCashfreePayment(cashfreeOrderId)
      .then((result) => {
        if (result.status === "PAID") {
          try { sessionStorage.removeItem("tushaqsa.pendingPayment"); } catch { /* ignore */ }
          clearCart();
          if (pending?.orderNumber && pending?.accessToken && pending.orderNumber === result.orderNumber) {
            navigate(`/order/${pending.orderNumber}/confirmation?token=${pending.accessToken}`, { replace: true });
          } else {
            setState("paid");
          }
        } else {
          setState(result.status === "PENDING" ? "pending" : "failed");
        }
      })
      .catch(() => setState("error"));
  }, [params, navigate, clearCart]);

  const copy = {
    checking: ["Confirming your payment…", "Please wait while we confirm your payment with our payment provider."],
    paid: ["Payment received", "Your payment was confirmed. We have emailed your order confirmation. You can also find the order in your account."],
    pending: ["Payment is processing", "Your payment is still being processed. Please do not pay again; we will confirm your order as soon as it completes."],
    failed: ["Payment not completed", "Your payment was not completed and your order is unpaid. You can return to checkout and try again."],
    error: ["We couldn't confirm your payment", "If money was deducted, please contact us with your order number and we will sort it out."],
  }[state];

  return (
    <section className="mx-auto max-w-xl px-5 py-20 text-center" data-testid="payment-return">
      <h1 className="font-serif-display text-3xl store-text">{copy[0]}</h1>
      <p className="mt-4 text-sm store-muted">{copy[1]}</p>
      {state !== "checking" && (
        <div className="mt-8 flex justify-center gap-4 text-sm">
          <Link to="/checkout" className="underline">Back to checkout</Link>
          <Link to="/" className="underline">Continue shopping</Link>
        </div>
      )}
    </section>
  );
}
