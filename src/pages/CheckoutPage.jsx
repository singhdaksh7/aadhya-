import { cloneElement, isValidElement, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button, SectionHeading } from "../components/ui";
import { LoadingNotice } from "../components/StateNotice";
import { useCart } from "../context/CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useSiteSettings } from "../hooks/useSiteSettings";
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

const toAddressForm = (address = {}) => ({
  fullName: address.fullName || "", phone: address.phone || "", alternatePhone: address.alternatePhone || "",
  email: address.email || "", addressLine1: address.addressLine1 || "", addressLine2: address.addressLine2 || "",
  landmark: address.landmark || "", city: address.city || "", state: address.state || "",
  postalCode: address.postalCode || "", country: address.country || "India",
});

const addressFields = ["fullName", "phone", "addressLine1", "city", "state", "postalCode"];
function validateAddress(address, prefix, errors) {
  for (const field of addressFields) if (!String(address[field] || "").trim()) errors[`${prefix}${field}`] = "Required";
  if (address.phone && !PHONE_RE.test(address.phone)) errors[`${prefix}phone`] = "Enter a valid 10-digit mobile number";
  if (address.alternatePhone && !PHONE_RE.test(address.alternatePhone)) errors[`${prefix}alternatePhone`] = "Enter a valid 10-digit mobile number";
  if (address.postalCode && !PIN_RE.test(address.postalCode)) errors[`${prefix}postalCode`] = "Enter a valid 6-digit PIN code";
  if (address.email && !/^\S+@\S+\.\S+$/.test(address.email)) errors[`${prefix}email`] = "Enter a valid email";
}

// A PDF-only cart has nothing to ship, so the address block is skipped
// entirely — both in the UI and in this validation.
function validate(form, { requireAddress = true } = {}) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Required";
  if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = "Enter a valid email";
  if (!PHONE_RE.test(form.phone)) errors.phone = "Enter a valid 10-digit mobile number";
  if (!requireAddress) return errors;
  if (!form.fullName.trim()) errors.fullName = "Required";
  if (!PHONE_RE.test(form.addressPhone)) errors.addressPhone = "Enter a valid 10-digit mobile number";
  if (!form.addressLine1.trim()) errors.addressLine1 = "Required";
  if (!form.city.trim()) errors.city = "Required";
  if (!form.state.trim()) errors.state = "Required";
  if (!PIN_RE.test(form.postalCode)) errors.postalCode = "Enter a valid 6-digit PIN code";
  return errors;
}

export default function CheckoutPage() {
  const { items, isLoading: cartLoading, clearCart, appliedCoupon, couponError, applyCoupon, removeCoupon } = useCart();
  const navigate = useNavigate();
  const { user } = useCustomerAuth();
  const { payments } = useSiteSettings();

  const razorpayEnabled = payments?.razorpayEnabled ?? true;
  const codEnabled = payments?.codEnabled ?? true;
  const [paymentMethod, setPaymentMethod] = useState("razorpay");

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(null);
  const [previewStatus, setPreviewStatus] = useState("loading");
  const [stage, setStage] = useState("form"); // form | placing | paying | payment_unavailable | failed
  const [pendingOrder, setPendingOrder] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [saveAddress, setSaveAddress] = useState(false);
  const [billingAddress, setBillingAddress] = useState(() => toAddressForm());
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [billingAddressId, setBillingAddressId] = useState("");
  const [saveBillingAddress, setSaveBillingAddress] = useState(false);

  useEffect(() => {
    if (!razorpayEnabled && codEnabled) {
      setPaymentMethod("cod");
    } else if (razorpayEnabled) {
      setPaymentMethod("razorpay");
    }
  }, [razorpayEnabled, codEnabled]);

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
      setBillingAddress((address) => ({
        ...address,
        fullName: address.fullName || user.name || "",
        email: address.email || user.email || "",
        phone: address.phone || user.phone || "",
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
        const shipping = addresses.find((a) => a.isDefaultShipping || a.isDefault) || addresses[0];
        const billing = addresses.find((a) => a.isDefaultBilling) || addresses[0];
        if (shipping) {
          setSelectedAddressId(shipping.id);
          setForm((f) => ({
            ...f,
            ...toAddressForm(shipping), addressPhone: shipping.phone,
          }));
        }
        if (billing) { setBillingAddressId(billing.id); setBillingAddress(toAddressForm({ ...billing, email: user.email })); }
      })
      .catch(() => {});
  }, [user]);

  const cartKey = useMemo(
    () => `${items.map((i) => `${i.product.slug}:${i.quantity}:${i.bookFormat || ""}`).join(",")}:${appliedCoupon?.code || ""}`,
    [items, appliedCoupon]
  );

  // Digital (PDF) items ship nothing — a cart made entirely of them needs
  // no shipping address at all. A mixed or physical-only cart still does.
  const isDigitalOnly = items.length > 0 && items.every((i) => i.bookFormat === "PDF");

  useEffect(() => {
    if (cartLoading || items.length === 0) return;
    let cancelled = false;
    setPreviewStatus("loading");
    fetchCheckoutPreview({
      items: items.map((i) => ({ slug: i.product.slug, quantity: i.quantity, bookFormat: i.bookFormat || undefined })),
      couponCode: appliedCoupon?.code || undefined,
    })
      .then((res) => {
        if (cancelled) return;
        setPreview(res.data);
        setPreviewStatus("ready");
      })
      .catch(() => !cancelled && setPreviewStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [cartKey, cartLoading, appliedCoupon]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setShipping = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setBilling = (key) => (e) => {
    const value = e.target.value;
    setBillingAddress((f) => ({ ...f, [key]: value }));
    if (sameAsShipping) setForm((f) => ({ ...f, [key === "phone" ? "addressPhone" : key]: value, ...(key === "email" ? { email: value, name: f.name || billingAddress.fullName } : {}) }));
  };

  useEffect(() => {
    if (sameAsShipping) setForm((f) => ({ ...f, fullName: billingAddress.fullName, addressPhone: billingAddress.phone, alternatePhone: billingAddress.alternatePhone, addressLine1: billingAddress.addressLine1, addressLine2: billingAddress.addressLine2, landmark: billingAddress.landmark, city: billingAddress.city, state: billingAddress.state, postalCode: billingAddress.postalCode, country: billingAddress.country, name: billingAddress.fullName || f.name, email: billingAddress.email || f.email, phone: billingAddress.phone || f.phone }));
  }, [sameAsShipping, billingAddress]);

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
      theme: { color: "#b8674a" },
    });

    razorpay.on("payment.failed", () => setStage("failed"));
    razorpay.open();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate(form, { requireAddress: !isDigitalOnly });
    if (!isDigitalOnly) {
      validateAddress(toAddressForm({ ...form, phone: form.addressPhone }), "shipping.", validationErrors);
      if (!sameAsShipping) validateAddress(billingAddress, "billing.", validationErrors);
    }
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setServerError(null);
    setStage("placing");
    try {
      let savedAddressId = selectedAddressId || undefined;
      let billingSavedAddressId = sameAsShipping ? savedAddressId : billingAddressId || undefined;
      if (!isDigitalOnly && user && !savedAddressId && (saveAddress || (sameAsShipping && saveBillingAddress))) {
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
            alternatePhone: form.alternatePhone || undefined,
            email: form.email,
            landmark: form.landmark || undefined,
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
        if (sameAsShipping) billingSavedAddressId = savedAddressId;
      }

      if (!isDigitalOnly && user && !sameAsShipping && !billingSavedAddressId && saveBillingAddress) {
        const saved = await createAddress({ label: "Checkout billing", ...billingAddress, isDefaultBilling: false, isDefaultShipping: false });
        billingSavedAddressId = saved.data.id;
      }

      const res = await createOrder(
        {
          customer: { name: form.name, email: form.email, phone: form.phone },
          ...(isDigitalOnly
            ? {}
            : {
                shippingAddress: {
                  fullName: form.fullName,
                  phone: form.addressPhone,
                  alternatePhone: form.alternatePhone || undefined,
                  email: form.email,
                  landmark: form.landmark || undefined,
                  addressLine1: form.addressLine1,
                  addressLine2: form.addressLine2 || undefined,
                  city: form.city,
                  state: form.state,
                  postalCode: form.postalCode,
                  country: form.country,
                },
                billingAddress: sameAsShipping
                  ? undefined
                  : {
                      ...billingAddress,
                      alternatePhone: billingAddress.alternatePhone || undefined,
                      email: billingAddress.email || undefined,
                      landmark: billingAddress.landmark || undefined,
                      addressLine2: billingAddress.addressLine2 || undefined,
                    },
                billingSameAsShipping: sameAsShipping,
              }),
          items: items.map((i) => ({ slug: i.product.slug, quantity: i.quantity, bookFormat: i.bookFormat || undefined })),
          couponCode: appliedCoupon?.code || undefined,
          savedAddressId,
          billingSavedAddressId,
          paymentMethod,
        },
        Boolean(user)
      );
      const { orderId, orderNumber, accessToken } = res.data;
      setPendingOrder({ orderId, orderNumber, accessToken });
      if (paymentMethod === "cod") {
        clearCart();
        navigate(`/order/${orderNumber}/confirmation?token=${accessToken}`, { replace: true });
      } else {
        await startPayment(orderId, orderNumber, accessToken);
      }
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
      errors[field] ? "border-[var(--theme-primary)]" : "store-border focus:border-[var(--theme-primary)]"
    }`;

  return (
    <div className="store-bg store-text py-12 pb-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-8 space-y-8">
        <title>Checkout — Aadya Storefront</title>
        <SectionHeading eyebrow="Express Retail Checkout" title="Checkout" />

        {cartLoading ? (
          <LoadingNotice label="Loading your cart…" />
        ) : (
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
            <form onSubmit={onSubmit} className="space-y-8">
              <fieldset className="space-y-4">
                <legend className="mb-1 font-serif-display text-lg store-text font-bold">Contact Details</legend>
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

              {isDigitalOnly ? (
                <p className="rounded-xl border store-border store-surface p-4 text-xs sm:text-sm store-muted">
                  This order is entirely digital (PDF) — no shipping address is needed. Your download(s) will be available in your account after payment.
                </p>
              ) : (
              <>
              <fieldset className="space-y-4">
                <legend className="mb-1 font-serif-display text-lg store-text font-bold">Billing / Communication Address</legend>
                {user && <SavedAddressPicker addresses={savedAddresses} selectedId={billingAddressId} type="billing" onSelect={(a) => { setBillingAddressId(a?.id || ""); if (sameAsShipping) setSelectedAddressId(a?.id || ""); if (a) setBillingAddress(toAddressForm({ ...a, email: a.email || form.email })); }} />}
                <CheckoutAddressFields value={billingAddress} onChange={setBilling} errors={errors} prefix="billing." includeEmail />
                {user && !billingAddressId && <label className="block text-xs cursor-pointer"><input type="checkbox" checked={saveBillingAddress} onChange={(e) => setSaveBillingAddress(e.target.checked)} /> Save as a billing address</label>}
              </fieldset>
              <label className="flex items-center gap-2 rounded-xl border store-border store-surface p-3 text-sm font-medium cursor-pointer"><input type="checkbox" checked={sameAsShipping} onChange={(e) => setSameAsShipping(e.target.checked)} /> Shipping address is same as billing address</label>
              {!sameAsShipping && <fieldset className="space-y-4">
                <legend className="mb-1 font-serif-display text-lg store-text font-bold">Shipping Address</legend>
                {user && (
                  <div className="space-y-2 rounded-xl border store-border store-surface p-3 text-xs sm:text-sm">
                    {savedAddresses.map((a) => (
                      <label key={a.id} className="block cursor-pointer">
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
                        {a.label} — {a.fullName}{a.isDefaultShipping || a.isDefault ? " (Default shipping)" : ""}
                      </label>
                    ))}
                    <label className="block cursor-pointer">
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
                <div className="grid grid-cols-2 gap-4"><Field label="Alternate mobile (optional)" error={errors["shipping.alternatePhone"]}><input value={form.alternatePhone || ""} onChange={setShipping("alternatePhone")} className={inputCls("shipping.alternatePhone")} /></Field><Field label="Landmark (optional)"><input value={form.landmark || ""} onChange={setShipping("landmark")} className={inputCls("landmark")} /></Field></div>
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
                  <label className="block text-xs sm:text-sm cursor-pointer">
                    <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} /> Save this address to my account
                  </label>
                )}
              </fieldset>
              }
              {sameAsShipping && <p className="text-xs store-muted">Shipping will use the billing / communication address above.</p>}
              </>
              )}

              <fieldset className="space-y-4">
                <legend className="mb-1 font-serif-display text-lg store-text font-bold">Payment Method</legend>
                {!razorpayEnabled && !codEnabled ? (
                  <p className="text-xs font-semibold store-primary">No payment methods are currently available.</p>
                ) : (
                  <div className="space-y-2 rounded-xl border store-border store-surface p-4 text-xs sm:text-sm">
                    {razorpayEnabled && (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="razorpay"
                          checked={paymentMethod === "razorpay"}
                          onChange={() => setPaymentMethod("razorpay")}
                          className="accent-[var(--theme-primary)]"
                        />
                        <span className="font-medium store-text">
                          {payments?.razorpayDisplayLabel || "Pay Online via Razorpay (UPI, Cards, NetBanking)"}
                        </span>
                      </label>
                    )}
                    {codEnabled && (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="cod"
                          checked={paymentMethod === "cod"}
                          onChange={() => setPaymentMethod("cod")}
                          className="accent-[var(--theme-primary)]"
                        />
                        <span className="font-medium store-text">
                          {payments?.codDisplayLabel || "Cash on Delivery (COD)"}
                        </span>
                      </label>
                    )}
                  </div>
                )}
              </fieldset>

              {serverError && <p className="text-sm font-semibold text-terracotta">{serverError}</p>}

              {stage === "failed" && (
                <div className="rounded-xl bg-terracotta/10 px-4 py-3 text-sm text-terracotta">
                  Payment didn't go through. Your order is saved and your cart is untouched — you can retry.
                  <Button type="button" className="mt-3 w-full bg-terracotta text-white" onClick={retryPayment}>
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
                <button
                  type="submit"
                  disabled={
                    stage === "placing" ||
                    stage === "paying" ||
                    previewStatus !== "ready" ||
                    preview?.hasBlockingIssues ||
                    (!razorpayEnabled && !codEnabled)
                  }
                  className="w-full rounded-full store-bg-primary py-4 text-xs font-semibold uppercase tracking-wider text-white shadow-xs transition store-primary-hover disabled:opacity-50"
                >
                  {stage === "placing"
                    ? "Placing Order…"
                    : stage === "paying"
                    ? "Opening Payment Window…"
                    : paymentMethod === "cod"
                    ? "Place Order (Cash on Delivery)"
                    : "Pay Securely via Razorpay"}
                </button>
              )}
            </form>

            <OrderSummary
              preview={preview}
              status={previewStatus}
              appliedCoupon={appliedCoupon}
              couponError={couponError}
              applyCoupon={applyCoupon}
              removeCoupon={removeCoupon}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  const errorId = error ? `error-${label.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}` : undefined;
  const child = isValidElement(children)
    ? cloneElement(children, {
        "aria-invalid": error ? "true" : undefined,
        "aria-describedby": errorId,
      })
    : children;
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide store-muted">{label}</span>
      {child}
      {error && (
        <span id={errorId} className="mt-1 block text-xs store-primary font-medium">
          {error}
        </span>
      )}
    </label>
  );
}

function SavedAddressPicker({ addresses, selectedId, type, onSelect }) {
  const isDefault = (address) => type === "billing" ? address.isDefaultBilling || address.isDefault : address.isDefaultShipping || address.isDefault;
  return <div className="space-y-2 rounded-xl border store-border store-surface p-3 text-xs sm:text-sm">
    {addresses.map((address) => <label key={address.id} className="block cursor-pointer"><input type="radio" name={`saved-${type}`} checked={selectedId === address.id} onChange={() => onSelect(address)} /> {address.label} — {address.fullName}{isDefault(address) ? " (Default)" : ""}</label>)}
    <label className="block cursor-pointer"><input type="radio" name={`saved-${type}`} checked={!selectedId} onChange={() => onSelect(null)} /> Use a new address</label>
  </div>;
}

function CheckoutAddressFields({ value, onChange, errors, prefix, includeEmail = false }) {
  const field = (key, label, extra = {}) => <Field label={label} error={errors[`${prefix}${key}`]}><input {...extra} value={value[key] || ""} onChange={onChange(key)} className={`w-full rounded-xl border px-4 py-2.5 text-sm ${errors[`${prefix}${key}`] ? "border-[var(--theme-primary)]" : "store-border"}`} /></Field>;
  return <>
    <div className="grid gap-4 sm:grid-cols-2">{field("fullName", "Full Name")}{includeEmail && field("email", "Billing email", { type: "email" })}{field("phone", "Mobile", { "data-testid": "address-phone" })}{field("alternatePhone", "Alternate mobile (optional)")}</div>
    {field("addressLine1", "Address Line 1")}{field("addressLine2", "Address Line 2 (optional)")}{field("landmark", "Landmark (optional)")}
    <div className="grid gap-4 sm:grid-cols-3">{field("city", "City")}{field("state", "State")}{field("postalCode", "PIN Code")}</div>{field("country", "Country")}
  </>;
}

function OrderSummary({ preview, status, appliedCoupon, couponError, applyCoupon, removeCoupon }) {
  const [couponInput, setCouponInput] = useState("");
  const [validating, setValidating] = useState(false);

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    setValidating(true);
    const ok = await applyCoupon(couponInput);
    if (ok) setCouponInput("");
    setValidating(false);
  };

  return (
    <div className="h-fit rounded-2xl border store-border store-surface p-6 space-y-4">
      <h2 className="font-serif-display text-lg font-bold store-text">Order Summary</h2>

      {appliedCoupon ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              {appliedCoupon.code} applied
            </span>
            <button type="button" onClick={removeCoupon} className="text-[11px] text-rose-600 hover:underline font-medium">
              Remove
            </button>
          </div>
          <p className="text-[11px] text-emerald-700">You saved {formatInr(appliedCoupon.discountAmount)}</p>
        </div>
      ) : (
        <form onSubmit={handleApplyCoupon} className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider store-muted">Have a promo code?</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder="Enter code"
              aria-label="Coupon code"
              className="flex-1 rounded-full border store-border store-bg px-3 py-1.5 text-xs store-text store-ring-primary focus:outline-none uppercase font-mono"
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={validating}
              className="rounded-full store-bg-primary px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white transition store-primary-hover disabled:opacity-50"
            >
              {validating ? "..." : "Apply"}
            </button>
          </div>
          {couponError && <p className="text-[11px] store-primary font-medium">{couponError}</p>}
        </form>
      )}

      {status === "loading" && <p className="text-xs store-muted">Calculating totals…</p>}
      {status === "error" && <p className="text-xs text-terracotta">Unable to calculate your order right now.</p>}

      {status === "ready" && preview && (
        <>
          <ul className="space-y-3">
            {preview.items.map((item) => (
              <li key={item.slug} className="text-xs sm:text-sm">
                <div className="flex justify-between gap-2">
                  <span className="store-text font-medium">
                    {item.product?.name || item.slug} × {item.quantity}
                  </span>
                  <span className="store-muted font-semibold">{item.ok ? formatInr(item.lineTotal) : "—"}</span>
                </div>
                {item.message && <p className="mt-1 text-xs text-terracotta">{item.message}</p>}
              </li>
            ))}
          </ul>

          <div className="space-y-2 border-t store-border pt-4 text-xs sm:text-sm">
            <div className="flex justify-between store-muted">
              <span>Subtotal</span>
              <span className="font-medium store-text">{formatInr(preview.subtotal)}</span>
            </div>
            {preview.discount > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Coupon Discount ({preview.coupon?.code || "Applied"})</span>
                <span>-{formatInr(preview.discount)}</span>
              </div>
            )}
            <div className="flex justify-between store-muted">
              <span>Shipping</span>
              <span>{preview.shipping === 0 ? <span className="text-emerald-700 font-semibold">FREE</span> : formatInr(preview.shipping)}</span>
            </div>
            <div className="flex justify-between pt-2 font-serif-display text-base font-bold store-text border-t store-border">
              <span>Total</span>
              <span className="store-primary text-lg">{formatInr(preview.total)}</span>
            </div>
          </div>

          {preview.hasBlockingIssues && (
            <p className="text-xs text-terracotta">
              Some items need attention before you can pay. Please{" "}
              <a href="/cart" className="underline font-semibold">
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
