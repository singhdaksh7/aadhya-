import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button, SectionHeading } from "../components/ui";
import { LoadingNotice } from "../components/StateNotice";
import { useCart } from "../context/CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { formatInr } from "../lib/format";
import { loadRazorpayScript } from "../lib/razorpay";
import {
  checkoutPreview as fetchCheckoutPreview,
  createOrder,
  createRazorpayOrder,
  verifyRazorpayPayment,
  accountAddresses,
  createAddress,
  ApiRequestError,
} from "../lib/api";

const PHONE_RE = /^[6-9]\d{9}$/;
const PIN_RE = /^\d{6}$/;

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  fullName: "",
  addressPhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
};

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Required";
  if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = "Enter a valid email";
  if (!PHONE_RE.test(form.phone)) errors.phone = "Enter a valid 10-digit mobile number";
  if (!form.fullName.trim()) errors.fullName = "Required";
  if (!PHONE_RE.test(form.addressPhone)) errors.addressPhone = "Enter a valid 10-digit mobile number";
  if (!form.addressLine1.trim()) errors.addressLine1 = "Required";
  if (!form.city.trim()) errors.city = "Required";
  if (!form.state.trim()) errors.state = "Required";
  if (!PIN_RE.test(form.postalCode)) errors.postalCode = "Enter a valid 6-digit PIN code";
  return errors;
}

export default function CheckoutPage() {
  const { items, isLoading: cartLoading, clearCart } = useCart();
  const navigate = useNavigate();
  const { user } = useCustomerAuth();

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(null);
  const [previewStatus, setPreviewStatus] = useState("loading");
  const [stage, setStage] = useState("form"); // form | placing | paying | payment_unavailable | failed
  const [pendingOrder, setPendingOrder] = useState(null); // { orderId, orderNumber, accessToken }
  const [serverError, setServerError] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [saveAddress, setSaveAddress] = useState(false);

  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        name: f.name || user.name || "",
        email: f.email || user.email || "",
        phone: f.phone || user.phone || "",
        fullName: f.fullName || user.name || "",
        addressPhone: f.addressPhone || user.phone || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSavedAddresses([]);
      return;
    }
    accountAddresses()
      .then((r) => {
        const addresses = r.data || [];
        setSavedAddresses(addresses);
        const chosen = addresses.find((a) => a.isDefault) || addresses[0];
        if (chosen) {
          setSelectedAddressId(chosen.id);
          setForm((f) => ({
            ...f,
            fullName: chosen.fullName,
            addressPhone: chosen.phone,
            addressLine1: chosen.addressLine1,
            addressLine2: chosen.addressLine2 || "",
            city: chosen.city,
            state: chosen.state,
            postalCode: chosen.postalCode,
            country: chosen.country || "India",
          }));
        }
      })
      .catch(() => {});
  }, [user]);

  const cartKey = useMemo(() => items.map((i) => `${i.product.slug}:${i.quantity}`).join(","), [items]);

  useEffect(() => {
    if (cartLoading || items.length === 0) return;
    let cancelled = false;
    setPreviewStatus("loading");
    fetchCheckoutPreview(items.map((i) => ({ slug: i.product.slug, quantity: i.quantity })))
      .then((res) => {
        if (cancelled) return;
        setPreview(res.data);
        setPreviewStatus("ready");
      })
      .catch(() => !cancelled && setPreviewStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [cartKey, cartLoading]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const startPayment = async (orderId, orderNumber, accessToken) => {
    setStage("paying");
    let options;
    try {
      options = await createRazorpayOrder(orderId);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setServerError(err.message);
      }
      setStage("payment_unavailable");
      return;
    }

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded || !window.Razorpay) {
      setServerError("Could not load the payment window. Check your connection and try again.");
      setStage("payment_unavailable");
      return;
    }

    const razorpay = new window.Razorpay({
      key: options.keyId,
      amount: options.amount,
      currency: options.currency,
      name: options.name,
      description: options.description,
      order_id: options.razorpayOrderId,
      prefill: options.prefill,
      handler: async (response) => {
        try {
          await verifyRazorpayPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          clearCart();
          navigate(`/order/${orderNumber}/confirmation?token=${accessToken}`, { replace: true });
        } catch {
          setServerError("We couldn't verify your payment. If money was deducted, contact us with your order number.");
          setStage("failed");
        }
      },
      modal: {
        ondismiss: () => {
          setStage("failed");
        },
      },
      theme: { color: "#3c4a3a" },
    });

    razorpay.on("payment.failed", () => setStage("failed"));
    razorpay.open();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setServerError(null);
    setStage("placing");
    try {
      let savedAddressId = selectedAddressId || undefined;
      if (user && !savedAddressId && saveAddress) {
        const duplicate = savedAddresses.find(
          (a) =>
            a.fullName === form.fullName &&
            a.phone === form.addressPhone &&
            a.addressLine1 === form.addressLine1 &&
            a.postalCode === form.postalCode
        );
        if (duplicate) savedAddressId = duplicate.id;
        else {
          const saved = await createAddress({
            label: "Checkout",
            fullName: form.fullName,
            phone: form.addressPhone,
            addressLine1: form.addressLine1,
            addressLine2: form.addressLine2 || null,
            city: form.city,
            state: form.state,
            postalCode: form.postalCode,
            country: form.country,
            isDefault: false,
          });
          savedAddressId = saved.data.id;
        }
      }

      const res = await createOrder(
        {
          customer: { name: form.name, email: form.email, phone: form.phone },
          shippingAddress: {
            fullName: form.fullName,
            phone: form.addressPhone,
            addressLine1: form.addressLine1,
            addressLine2: form.addressLine2 || undefined,
            city: form.city,
            state: form.state,
            postalCode: form.postalCode,
            country: form.country,
          },
          items: items.map((i) => ({ slug: i.product.slug, quantity: i.quantity })),
          savedAddressId,
        },
        Boolean(user)
      );
      const { orderId, orderNumber, accessToken } = res.data;
      setPendingOrder({ orderId, orderNumber, accessToken });
      await startPayment(orderId, orderNumber, accessToken);
    } catch (err) {
      setServerError(err instanceof ApiRequestError ? err.message : "Could not place your order. Please try again.");
      setStage("form");
    }
  };

  const retryPayment = () => {
    if (!pendingOrder) return;
    setServerError(null);
    startPayment(pendingOrder.orderId, pendingOrder.orderNumber, pendingOrder.accessToken);
  };

  if (!cartLoading && items.length === 0 && stage === "form") {
    return <Navigate to="/cart" replace />;
  }

  const inputCls = (field) =>
    `w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none ${
      errors[field] ? "border-terracotta" : "border-charcoal/15 focus:border-charcoal/40"
    }`;

  return (
    <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <title>Checkout — Aadya Society</title>
      <SectionHeading eyebrow="Checkout" title="Checkout" />

      {cartLoading ? (
        <LoadingNotice label="Loading your cart…" />
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <form onSubmit={onSubmit} className="space-y-8">
            <fieldset className="space-y-4">
              <legend className="mb-1 font-serif-display text-lg text-charcoal">Contact Details</legend>
              <Field label="Name" error={errors.name}>
                <input value={form.name} onChange={set("name")} className={inputCls("name")} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email" error={errors.email}>
                  <input type="email" value={form.email} onChange={set("email")} className={inputCls("email")} />
                </Field>
                <Field label="Phone" error={errors.phone}>
                  <input
                    value={form.phone}
                    onChange={set("phone")}
                    className={inputCls("phone")}
                    data-testid="contact-phone"
                  />
                </Field>
              </div>
            </fieldset>

            <fieldset className="space-y-4">
              <legend className="mb-1 font-serif-display text-lg text-charcoal">Shipping Address</legend>
              {user && (
                <div className="space-y-2 rounded-xl border border-charcoal/10 p-3 text-sm">
                  {savedAddresses.map((a) => (
                    <label key={a.id} className="block">
                      <input
                        type="radio"
                        name="savedAddress"
                        checked={selectedAddressId === a.id}
                        onChange={() => {
                          setSelectedAddressId(a.id);
                          setForm((f) => ({
                            ...f,
                            fullName: a.fullName,
                            addressPhone: a.phone,
                            addressLine1: a.addressLine1,
                            addressLine2: a.addressLine2 || "",
                            city: a.city,
                            state: a.state,
                            postalCode: a.postalCode,
                            country: a.country,
                          }));
                        }}
                      />{" "}
                      {a.label} — {a.fullName}{a.isDefault ? " (Default)" : ""}
                    </label>
                  ))}
                  <label className="block">
                    <input
                      type="radio"
                      name="savedAddress"
                      checked={!selectedAddressId}
                      onChange={() => setSelectedAddressId("")}
                    />{" "}
                    Use a new address
                  </label>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full Name" error={errors.fullName}>
                  <input value={form.fullName} onChange={set("fullName")} className={inputCls("fullName")} />
                </Field>
                <Field label="Phone" error={errors.addressPhone}>
                  <input
                    value={form.addressPhone}
                    onChange={set("addressPhone")}
                    className={inputCls("addressPhone")}
                    data-testid="address-phone"
                  />
                </Field>
              </div>
              <Field label="Address Line 1" error={errors.addressLine1}>
                <input value={form.addressLine1} onChange={set("addressLine1")} className={inputCls("addressLine1")} />
              </Field>
              <Field label="Address Line 2 (optional)">
                <input value={form.addressLine2} onChange={set("addressLine2")} className={inputCls("addressLine2")} />
              </Field>
              <div className="grid grid-cols-3 gap-4">
                <Field label="City" error={errors.city}>
                  <input value={form.city} onChange={set("city")} className={inputCls("city")} />
                </Field>
                <Field label="State" error={errors.state}>
                  <input value={form.state} onChange={set("state")} className={inputCls("state")} />
                </Field>
                <Field label="PIN Code" error={errors.postalCode}>
                  <input value={form.postalCode} onChange={set("postalCode")} className={inputCls("postalCode")} />
                </Field>
              </div>
              <Field label="Country">
                <input value={form.country} onChange={set("country")} className={inputCls("country")} />
              </Field>
              {user && !selectedAddressId && (
                <label className="block text-sm">
                  <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} /> Save this address to my account
                </label>
              )}
            </fieldset>

            {serverError && <p className="text-sm text-terracotta">{serverError}</p>}

            {stage === "failed" && (
              <div className="rounded-xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
                Payment didn't go through. Your order is saved and your cart is untouched — you can retry.
                <Button type="button" className="mt-3 w-full" onClick={retryPayment}>
                  Retry Payment
                </Button>
              </div>
            )}

            {stage === "payment_unavailable" && (
              <div className="rounded-xl bg-sage-light px-4 py-3 text-sm text-green-deep">
                Your order #{pendingOrder?.orderNumber} has been saved as pending. Online payment isn't available in
                this environment right now — we'll reach out to complete it, or you can retry shortly.
              </div>
            )}

            {stage !== "failed" && stage !== "payment_unavailable" && (
              <Button
                className="w-full"
                disabled={stage === "placing" || stage === "paying" || previewStatus !== "ready" || preview?.hasBlockingIssues}
              >
                {stage === "placing" ? "Placing Order…" : stage === "paying" ? "Opening Payment…" : "Pay Securely"}
              </Button>
            )}
          </form>

          <OrderSummary preview={preview} status={previewStatus} />
        </div>
      )}
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-terracotta">{error}</span>}
    </label>
  );
}

function OrderSummary({ preview, status }) {
  return (
    <div className="h-fit rounded-2xl border border-charcoal/10 bg-white/50 p-6">
      <h2 className="font-serif-display text-lg text-charcoal">Order Summary</h2>

      {status === "loading" && <p className="mt-4 text-sm text-charcoal-soft">Calculating totals…</p>}
      {status === "error" && <p className="mt-4 text-sm text-terracotta">Unable to calculate your order right now.</p>}

      {status === "ready" && preview && (
        <>
          <ul className="mt-4 space-y-3">
            {preview.items.map((item) => (
              <li key={item.slug} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-charcoal">
                    {item.product?.name || item.slug} × {item.quantity}
                  </span>
                  <span className="text-charcoal-soft">{item.ok ? formatInr(item.lineTotal) : "—"}</span>
                </div>
                {item.message && <p className="mt-1 text-xs text-terracotta">{item.message}</p>}
              </li>
            ))}
          </ul>

          <div className="mt-5 space-y-1.5 border-t border-charcoal/10 pt-4 text-sm">
            <div className="flex justify-between text-charcoal-soft">
              <span>Subtotal</span>
              <span>{formatInr(preview.subtotal)}</span>
            </div>
            <div className="flex justify-between text-charcoal-soft">
              <span>Shipping</span>
              <span>{preview.shipping === 0 ? "Free" : formatInr(preview.shipping)}</span>
            </div>
            <div className="flex justify-between pt-2 font-serif-display text-base text-charcoal">
              <span>Total</span>
              <span>{formatInr(preview.total)}</span>
            </div>
          </div>

          {preview.hasBlockingIssues && (
            <p className="mt-4 text-xs text-terracotta">
              Some items need attention before you can pay. Please{" "}
              <a href="/cart" className="underline">
                return to your cart
              </a>{" "}
              to fix them.
            </p>
          )}
        </>
      )}
    </div>
  );
}
