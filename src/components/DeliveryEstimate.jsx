import { useEffect, useId, useState } from "react";
import { estimateDelivery } from "../lib/api";
import { PIN_RE, formatEtaRange, readSavedPincode, savePincode } from "../lib/deliveryEstimate";

// Debounced, abortable estimate lookup. Any failure (network, 429, ...) ends in status "error" so callers stay quiet.
export function useDeliveryEstimate(pincode, items, cod, { delay = 400 } = {}) {
  const [state, setState] = useState({ status: "idle", data: null });
  const itemsKey = JSON.stringify(items || []);
  useEffect(() => {
    if (!PIN_RE.test(pincode || "")) {
      setState({ status: "idle", data: null });
      return undefined;
    }
    const ctrl = new AbortController();
    let stale = false;
    setState((s) => ({ status: "loading", data: s.data }));
    const t = setTimeout(() => {
      Promise.resolve()
        .then(() => estimateDelivery({ pincode, items: JSON.parse(itemsKey), ...(cod ? { cod: true } : {}) }, { signal: ctrl.signal }))
        .then((res) => { if (!stale) setState({ status: "ready", data: res?.data || null }); })
        .catch(() => { if (!stale) setState({ status: "error", data: null }); });
    }, delay);
    return () => { stale = true; clearTimeout(t); ctrl.abort(); };
  }, [pincode, itemsKey, cod, delay]);
  return state;
}

function EstimateMessage({ state, cod }) {
  if (state.status === "loading" && !state.data) return <p className="text-xs store-muted">Checking delivery…</p>;
  const d = state.data;
  if (state.status === "error" || !d) return null;
  const range = d.serviceable ? formatEtaRange(d.estimatedDelivery) : "";
  return (
    <div className="space-y-1">
      {d.serviceable === false ? (
        <p className="text-sm store-muted">We could not confirm delivery to this pincode</p>
      ) : range ? (
        <p className="text-sm font-medium store-text">Estimated delivery: {range}</p>
      ) : d.serviceable ? (
        <p className="text-sm store-text">Delivery is available to this pincode</p>
      ) : null}
      {cod && d.serviceable && d.codAvailable === false && (
        <p className="text-xs store-muted">Cash on delivery may not be available for this pincode. Online payment will work.</p>
      )}
    </div>
  );
}

// Informational line for checkout: never blocks anything, silent on errors.
export function CheckoutDeliveryEstimate({ pincode, items, cod }) {
  const state = useDeliveryEstimate(pincode, items, cod);
  if (state.status === "idle" || state.status === "error" || !(state.data || state.status === "loading")) return null;
  return (
    <div data-testid="checkout-delivery-estimate" role="status" aria-live="polite" className="rounded-xl border store-border store-surface px-4 py-3">
      <EstimateMessage state={state} cod={cod} />
    </div>
  );
}

// Compact "Check delivery" box for product / cart pages.
export function PincodeCheck({ items, className = "" }) {
  const [input, setInput] = useState(() => readSavedPincode());
  const [submitted, setSubmitted] = useState(() => readSavedPincode());
  const [touched, setTouched] = useState(false);
  const id = useId();
  const valid = PIN_RE.test(input);
  const state = useDeliveryEstimate(submitted, items, false, { delay: 0 });
  const onSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (valid) { savePincode(input); setSubmitted(input); }
  };
  return (
    <form onSubmit={onSubmit} data-testid="pincode-check" className={`space-y-2 ${className}`} noValidate>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider store-muted">Check delivery</label>
      <div className="flex gap-2">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          placeholder="Enter 6-digit PIN code"
          value={input}
          onChange={(e) => { setInput(e.target.value.replace(/\D/g, "").slice(0, 6)); setTouched(false); }}
          aria-invalid={touched && !valid}
          className="min-w-0 flex-1 rounded-xl border store-border store-bg px-4 py-2.5 text-sm store-text focus:border-[var(--theme-primary)] focus:outline-none"
        />
        <button type="submit" className="shrink-0 rounded-full border border-[var(--theme-text)] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider store-text transition hover:bg-[var(--theme-text)] hover:text-white">Check</button>
      </div>
      <div role="status" aria-live="polite">
        {touched && !valid && <p className="text-xs text-terracotta">Enter a valid 6-digit PIN code</p>}
        {submitted && submitted === input && <EstimateMessage state={state} cod={false} />}
      </div>
    </form>
  );
}
