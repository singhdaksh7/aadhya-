import { useSiteSettings } from "../hooks/useSiteSettings";
import SystemPage from "./SystemPage";

// Page copy (intro, failed/duplicate-payment guidance, SEO) is managed in Admin → Pages ("payments").
// The list of accepted methods is derived from Store Settings → Payments so it can never advertise a
// method that is switched off. No gateway identifiers or credentials are ever rendered here.
function EnabledMethods() {
  const payments = useSiteSettings()?.payments || {};
  const methods = [];
  if (payments.cashfreeEnabled !== false && payments.cashfreeAvailable !== false) {
    methods.push({ id: "online", label: payments.cashfreeDisplayLabel || "Pay online (UPI, cards, net banking)", note: "Online payments are securely processed through Cashfree Payments." });
  }
  if (payments.codEnabled) {
    methods.push({ id: "cod", label: payments.codDisplayLabel || "Cash on Delivery", note: "Offered on eligible orders; it is shown at checkout only when it is available for your order." });
  }
  return (
    <section className="space-y-3" data-testid="enabled-payment-methods">
      <h2 className="font-serif-display text-2xl store-text">Payment methods available now</h2>
      {methods.length ? (
        <ul className="space-y-3">
          {methods.map((m) => (
            <li key={m.id} className="rounded-2xl border store-border store-surface p-4">
              <p className="text-sm font-semibold store-text">{m.label}</p>
              <p className="mt-1 text-sm store-muted">{m.note}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm store-muted">Payment methods are shown at checkout.</p>
      )}
    </section>
  );
}

export default function PaymentInfo() {
  return (
    <SystemPage slug="payments" eyebrow="Customer Policies" fallbackTitle="Payment Information">
      <EnabledMethods />
    </SystemPage>
  );
}
