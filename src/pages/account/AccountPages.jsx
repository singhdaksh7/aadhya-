import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, SectionHeading } from "../../components/ui";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { ApiRequestError } from "../../lib/api";
import {
  accountAddresses,
  accountOrder,
  accountOrders,
  changeAccountPassword,
  createAddress,
  deleteAddress,
  forgotPassword,
  resetPassword,
  setDefaultAddress,
  updateAccountProfile,
  updateAddress,
} from "../../lib/api";
import { formatInr } from "../../lib/format";

const blank = {
  label: "Home",
  fullName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  isDefault: false,
};

const fields = Object.keys(blank).filter((k) => k !== "isDefault");

function AccountNav() {
  const { pathname } = useLocation();
  const items = [
    { path: "/account", label: "Profile" },
    { path: "/account/orders", label: "Orders" },
    { path: "/account/addresses", label: "Addresses" },
  ];
  return (
    <div className="flex gap-5 overflow-x-auto border-b border-charcoal/10 text-xs font-semibold uppercase tracking-wider no-scrollbar">
      {items.map((item) => {
        const active = pathname === item.path;
        return <Link key={item.path} to={item.path} className={`shrink-0 border-b-2 px-1 pb-3 transition ${active ? "border-terracotta text-terracotta" : "border-transparent text-charcoal-soft hover:text-terracotta"}`}>{item.label}</Link>;
      })}
    </div>
  );
}

function AddressForm({ form, setForm, onSubmit, label }) {
  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-charcoal/10 bg-ivory-dark/30 p-6 space-y-4">
      <h3 className="font-serif-display text-lg text-charcoal">{label}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((k) => (
          <input
            key={k}
            className="w-full rounded-xl border border-charcoal/15 bg-white px-4 py-2.5 text-sm text-charcoal focus:border-terracotta focus:outline-none"
            required={k !== "addressLine2"}
            placeholder={k}
            value={form[k] || ""}
            onChange={(e) => setForm({ ...form, [k]: e.target.value })}
          />
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs font-medium text-charcoal cursor-pointer">
        <input
          type="checkbox"
          checked={form.isDefault}
          onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          className="accent-terracotta rounded"
        />
        <span>Set as default shipping address</span>
      </label>
      <Button className="w-full sm:w-auto">{label}</Button>
    </form>
  );
}

export function Login({ register = false }) {
  const { login, register: join } = useCustomerAuth();
  const nav = useNavigate();
  const [q] = useSearchParams();
  const [form, set] = useState({ name: "", email: "", password: "", phone: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (register && (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password) || form.password.length < 10)) {
      setError("Password must be at least 10 characters and include a letter and a number.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const payload = register ? { ...form, phone: form.phone.trim() || undefined } : form;
      await (register ? join : login)(payload);
      const p = q.get("returnTo");
      nav(p?.startsWith("/") && !p.startsWith("//") ? p : "/account");
    } catch (e) {
      if (register && e instanceof ApiRequestError) {
        setError(e.status === 400 ? "Please check the highlighted fields." : e.status === 409 ? "An account with this email already exists. Try signing in." : e.status === 429 ? "Too many attempts. Please try again in a few minutes." : "We couldn't create your account right now. Please try again.");
      } else setError(e.message || "We couldn't complete that request right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <SectionHeading eyebrow="Account Portal" title={register ? "Create Your Account" : "Welcome Back"} />
      <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl border border-charcoal/10 bg-ivory-dark/40 p-6 sm:p-8 shadow-sm">
        {register && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">Full Name</label>
            <input
              required
              placeholder="Name"
              className="w-full rounded-xl border border-charcoal/15 bg-white px-4 py-2.5 text-sm text-charcoal focus:border-terracotta focus:outline-none"
              value={form.name}
              onChange={(e) => set({ ...form, name: e.target.value })}
            />
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">Email Address</label>
          <input
            required
            type="email"
            placeholder="Email"
            className="w-full rounded-xl border border-charcoal/15 bg-white px-4 py-2.5 text-sm text-charcoal focus:border-terracotta focus:outline-none"
            value={form.email}
            onChange={(e) => set({ ...form, email: e.target.value })}
          />
        </div>
        {register && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">Mobile Phone (Optional)</label>
            <input
              placeholder="phone"
              className="w-full rounded-xl border border-charcoal/15 bg-white px-4 py-2.5 text-sm text-charcoal focus:border-terracotta focus:outline-none"
              value={form.phone}
              onChange={(e) => set({ ...form, phone: e.target.value })}
            />
            <p className="mt-1 text-xs text-charcoal-soft">10-digit Indian mobile number</p>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">Password</label>
          <input
            required
            type="password"
            minLength="10"
            placeholder="Password"
            className="w-full rounded-xl border border-charcoal/15 bg-white px-4 py-2.5 text-sm text-charcoal focus:border-terracotta focus:outline-none"
            value={form.password}
            onChange={(e) => set({ ...form, password: e.target.value })}
          />
          {register && <p className="mt-1 text-xs text-charcoal-soft">At least 10 characters, including a letter and a number.</p>}
        </div>

        {error && <p className="text-xs font-medium text-terracotta bg-terracotta/10 p-3 rounded-xl">{error}</p>}

        <Button disabled={submitting} className="w-full py-3">{submitting ? (register ? "Creating account..." : "Signing in...") : (register ? "Create account" : "Log in")}</Button>
      </form>

      <div className="mt-6 text-center text-xs text-charcoal-soft space-x-3">
        <Link className="hover:text-terracotta underline" to={register ? "/login" : "/register"}>
          {register ? "Already registered? Sign In" : "New to Aadya? Create an account"}
        </Link>
        <span>•</span>
        <Link className="hover:text-terracotta underline" to="/forgot-password">
          Forgot Password?
        </Link>
      </div>
    </div>
  );
}

const inputClass = "w-full rounded-xl border border-charcoal/15 bg-white px-4 py-2.5 text-sm text-charcoal focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/15";

function SummaryCard({ title, detail, action, to }) {
  return <Link to={to} className="group rounded-2xl border border-charcoal/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-terracotta/35 hover:shadow-md">
    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-terracotta">{title}</p>
    <p className="mt-2 text-sm leading-relaxed text-charcoal-soft">{detail}</p>
    <span className="mt-4 inline-block text-xs font-semibold text-charcoal group-hover:text-terracotta">{action} <span aria-hidden="true">→</span></span>
  </Link>;
}

function OrderSummary({ orders, loading, error }) {
  return <section className="rounded-3xl border border-charcoal/10 bg-white p-6 shadow-sm sm:p-7" aria-labelledby="recent-orders-heading">
    <div className="flex items-baseline justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-terracotta">Purchases</p><h2 id="recent-orders-heading" className="mt-1 font-serif-display text-2xl text-charcoal">Recent Orders</h2></div><Link to="/account/orders" className="shrink-0 text-xs font-semibold text-terracotta hover:underline">View all orders →</Link></div>
    {loading ? <div className="mt-6 space-y-3"><div className="h-16 animate-pulse rounded-2xl bg-ivory-dark/60" /><div className="h-16 animate-pulse rounded-2xl bg-ivory-dark/60" /></div> : error ? <p className="mt-6 rounded-xl bg-terracotta/10 p-4 text-sm text-terracotta">We couldn’t load your orders. Please try again later.</p> : orders.length ? <div className="mt-6 divide-y divide-charcoal/10">{orders.slice(0, 3).map((order) => <div key={order.id || order.orderNumber} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div><Link to={`/account/orders/${order.orderNumber}`} className="font-medium text-charcoal hover:text-terracotta">{order.orderNumber}</Link><p className="mt-1 text-xs text-charcoal-soft">{order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Order date unavailable"} · {order.status} · {order.paymentStatus}</p></div><div className="flex items-center justify-between gap-4"><span className="font-semibold text-charcoal">{formatInr(Number(order.totalAmount))}</span><Link to={`/account/orders/${order.orderNumber}`} className="text-xs font-semibold text-terracotta hover:underline">View order</Link></div></div>)}</div> : <div className="mt-6 rounded-2xl bg-ivory-dark/55 p-6"><p className="font-medium text-charcoal">No orders yet.</p><p className="mt-1 text-sm text-charcoal-soft">Your purchases and order status will appear here.</p><Link to="/shop" className="mt-4 inline-block text-xs font-semibold text-terracotta hover:underline">Explore the Store →</Link></div>}
  </section>;
}

function AddressSummary({ addresses, loading, error }) {
  const address = addresses.find((item) => item.isDefault) || addresses[0];
  return <section className="rounded-3xl border border-charcoal/10 bg-white p-6 shadow-sm sm:p-7" aria-labelledby="delivery-address-heading">
    <div className="flex items-baseline justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-terracotta">Delivery</p><h2 id="delivery-address-heading" className="mt-1 font-serif-display text-2xl text-charcoal">Default Delivery Address</h2></div><Link to="/account/addresses" className="shrink-0 text-xs font-semibold text-terracotta hover:underline">Manage addresses →</Link></div>
    {loading ? <div className="mt-6 h-28 animate-pulse rounded-2xl bg-ivory-dark/60" /> : error ? <p className="mt-6 rounded-xl bg-terracotta/10 p-4 text-sm text-terracotta">We couldn’t load your addresses. Please try again later.</p> : address ? <div className="mt-6 text-sm leading-relaxed text-charcoal-soft"><span className="inline-flex rounded-full bg-sage-light px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-green-deep">{address.label}</span><p className="mt-3 font-medium text-charcoal">{address.fullName}</p><p>{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ""}</p><p>{address.city}, {address.state} – {address.postalCode}</p></div> : <div className="mt-6 rounded-2xl bg-ivory-dark/55 p-6"><p className="font-medium text-charcoal">No delivery address saved yet.</p><Link to="/account/addresses" className="mt-4 inline-block text-xs font-semibold text-terracotta hover:underline">Add address →</Link></div>}
  </section>;
}

export function Account() {
  const { user, logout, updateUser } = useCustomerAuth();
  const nav = useNavigate();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [ordersState, setOrdersState] = useState({ loading: true, error: false });
  const [addressesState, setAddressesState] = useState({ loading: true, error: false });

  useEffect(() => {
    Promise.resolve().then(accountOrders).then((res) => setOrders(res?.data || [])).catch(() => setOrdersState({ loading: false, error: true })).finally(() => setOrdersState((state) => ({ ...state, loading: false })));
    Promise.resolve().then(accountAddresses).then((res) => setAddresses(res?.data || [])).catch(() => setAddressesState({ loading: false, error: true })).finally(() => setAddressesState((state) => ({ ...state, loading: false })));
  }, []);

  const saveProfile = async (event) => {
    event.preventDefault(); setError(""); setMessage(""); setSaving(true);
    try { const result = await updateAccountProfile({ name, phone: phone || null }); const customer = result?.data?.customer || result?.data || { name, phone: phone || null }; setName(customer.name || name); setPhone(customer.phone || ""); updateUser(customer); setMessage("Profile updated successfully."); setEditing(false); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const changePassword = async (event) => {
    event.preventDefault(); setError(""); setMessage("");
    if (pw.newPassword !== pw.confirmPassword) return setError("New passwords do not match.");
    if (!/(?=.*[A-Za-z])(?=.*\d).{10,}/.test(pw.newPassword)) return setError("Use at least 10 characters, including a letter and a number.");
    setChangingPassword(true);
    try { await changeAccountPassword(pw); await logout(); nav("/login", { replace: true }); }
    catch (err) { setError(err.message); } finally { setChangingPassword(false); }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12 space-y-8">
      <section className="rounded-3xl border border-charcoal/10 bg-ivory-dark/45 p-6 shadow-sm sm:flex sm:items-center sm:justify-between sm:p-8"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-terracotta">Customer Account</p><h1 className="mt-2 font-serif-display text-3xl text-charcoal sm:text-4xl">Welcome back, {user.name}</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-charcoal-soft">Manage your profile, orders, addresses and account security.</p></div><div className="mt-6 flex items-center gap-3 sm:mt-0 sm:pl-8"><div aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full bg-sage-light font-serif-display text-lg text-green-deep">{user.name?.trim()?.charAt(0)?.toUpperCase() || "A"}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-charcoal">{user.name}</p><p className="truncate text-xs text-charcoal-soft">{user.email}</p></div></div></section>
      <AccountNav />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SummaryCard title="Orders" detail="View your purchases and order status." action="View orders" to="/account/orders" /><SummaryCard title="Addresses" detail="Manage your delivery addresses." action="Manage addresses" to="/account/addresses" /><SummaryCard title="Profile" detail="Update your personal information." action="Edit profile" to="#personal-information" /><SummaryCard title="Security" detail="Password and account security." action="Manage security" to="#security" /></div>
      <div className="grid gap-6 lg:grid-cols-3"><div className="space-y-6 lg:col-span-2"><OrderSummary orders={orders} {...ordersState} /><AddressSummary addresses={addresses} {...addressesState} /></div><div className="space-y-6"><section id="personal-information" className="rounded-3xl border border-charcoal/10 bg-white p-6 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-terracotta">Profile</p><div className="mt-1 flex items-center justify-between gap-3"><h2 className="font-serif-display text-2xl text-charcoal">Personal Information</h2>{!editing && <button type="button" onClick={() => { setError(""); setMessage(""); setEditing(true); }} className="text-xs font-semibold text-terracotta hover:underline">Edit profile</button>}</div>{editing ? <form className="mt-6 space-y-4" onSubmit={saveProfile}><div><label htmlFor="account-name" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Full Name</label><input id="account-name" required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></div><div><label htmlFor="account-email" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Email Address</label><input id="account-email" readOnly className={`${inputClass} cursor-not-allowed bg-ivory-dark/40`} value={user.email} /></div><div><label htmlFor="account-phone" className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Phone Number</label><input id="account-phone" className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile phone" /></div><div className="flex gap-3"><Button type="submit" disabled={saving} className="flex-1">{saving ? "Saving..." : "Save changes"}</Button><button type="button" onClick={() => { setName(user.name); setPhone(user.phone || ""); setEditing(false); }} className="rounded-full px-4 text-xs font-semibold text-charcoal-soft hover:text-charcoal">Cancel</button></div></form> : <dl className="mt-6 space-y-4 text-sm"><div><dt className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Full Name</dt><dd className="mt-1 text-charcoal">{user.name}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Email Address</dt><dd className="mt-1 break-all text-charcoal">{user.email}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Phone Number</dt><dd className="mt-1 text-charcoal">{user.phone || "Not added"}</dd></div></dl>}</section><section id="security" className="rounded-3xl border border-charcoal/10 bg-white p-6 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-terracotta">Security</p><div className="mt-1 flex items-center justify-between gap-3"><div><h2 className="font-serif-display text-2xl text-charcoal">Password &amp; Security</h2><p className="mt-2 text-sm text-charcoal-soft">Keep your Aadya account secure.</p></div><span aria-label="Password protected" className="text-lg tracking-widest text-charcoal-soft">••••••••</span></div>{!securityOpen ? <button type="button" onClick={() => { setError(""); setMessage(""); setSecurityOpen(true); }} className="mt-5 text-xs font-semibold text-terracotta hover:underline">Change password</button> : <form className="mt-6 space-y-4 border-t border-charcoal/10 pt-5" onSubmit={changePassword}>{[["currentPassword", "Current Password"], ["newPassword", "New Password"], ["confirmPassword", "Confirm New Password"]].map(([key, label]) => <div key={key}><label htmlFor={key} className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal-soft">{label}</label><input id={key} required minLength="10" type={showPasswords ? "text" : "password"} className={inputClass} placeholder={label} value={pw[key]} onChange={(e) => setPw({ ...pw, [key]: e.target.value })} /></div>)}<label className="flex cursor-pointer items-center gap-2 text-xs text-charcoal-soft"><input type="checkbox" checked={showPasswords} onChange={(e) => setShowPasswords(e.target.checked)} /> Show passwords</label><p className="text-xs leading-relaxed text-charcoal-soft">At least 10 characters, including a letter and a number. You’ll be asked to sign in again after changing it.</p><div className="flex gap-3"><Button type="submit" disabled={changingPassword} className="flex-1">{changingPassword ? "Changing..." : "Change password"}</Button><button type="button" onClick={() => setSecurityOpen(false)} className="rounded-full px-4 text-xs font-semibold text-charcoal-soft hover:text-charcoal">Cancel</button></div></form>}</section></div></div>
      {error && <p className="text-xs font-medium text-terracotta bg-terracotta/10 p-3 rounded-xl">{error}</p>}
      {message && <p role="status" className="text-xs font-medium text-green-deep bg-sage-light p-3 rounded-xl">{message}</p>}
      <section className="border-t border-charcoal/10 pt-6"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-charcoal-soft">Account Actions</p><button type="button" onClick={logout} className="mt-3 text-xs font-semibold text-terracotta hover:underline">Sign out</button></section>
    </div>
  );
}

export function Addresses() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    accountAddresses()
      .then((r) => setItems(r.data))
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateAddress(editing.id, form);
      } else {
        await createAddress(form);
      }
      setForm(blank);
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 space-y-8">
      <SectionHeading eyebrow="Customer Account" title="Saved Addresses" />
      <AccountNav />

      <AddressForm form={form} setForm={setForm} onSubmit={save} label={editing ? "Save address" : "Add address"} />
      {error && <p className="text-xs font-medium text-terracotta bg-terracotta/10 p-3 rounded-xl">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 pt-4">
        {items.map((a) => (
          <article key={a.id} className="rounded-2xl border border-charcoal/10 bg-white p-5 space-y-2 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="font-serif-display text-base text-charcoal">{a.label}</span>
              {a.isDefault && (
                <span className="rounded-full bg-sage-light px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-green-deep">
                  Default
                </span>
              )}
            </div>
            <p className="text-xs text-charcoal-soft leading-relaxed">
              <strong className="text-charcoal block">{a.fullName}</strong>
              {a.addressLine1}, {a.addressLine2 ? `${a.addressLine2}, ` : ""}
              {a.city}, {a.state} {a.postalCode}
              <br />
              Ph: {a.phone}
            </p>
            <div className="pt-3 flex gap-4 text-xs font-medium border-t border-charcoal/5">
              <button
                className="text-charcoal hover:text-terracotta underline"
                onClick={() => {
                  setEditing(a);
                  setForm(a);
                }}
              >
                Edit
              </button>
              <button
                className="text-charcoal hover:text-terracotta underline"
                onClick={async () => {
                  try {
                    await setDefaultAddress(a.id);
                    load();
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Set default
              </button>
              <button
                className="text-terracotta hover:underline ml-auto"
                onClick={async () => {
                  try {
                    await deleteAddress(a.id);
                    load();
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
        {!items.length && <p className="text-sm text-charcoal-soft col-span-2">No saved addresses yet.</p>}
      </div>
    </div>
  );
}

export function Orders() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    accountOrders().then((r) => setItems(r.data || []));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 space-y-8">
      <SectionHeading eyebrow="Customer Account" title="Order History" />
      <AccountNav />

      <div className="space-y-4">
        {items.map((o) => (
          <Link
            className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border border-charcoal/10 bg-white p-5 transition hover:border-terracotta/30 hover:shadow-md"
            key={o.id}
            to={`/account/orders/${o.orderNumber}`}
          >
            <div className="space-y-1">
              <span className="font-serif-display text-base text-charcoal block">{o.orderNumber}</span>
              <p className="text-xs text-charcoal-soft">Status: <span className="font-semibold text-terracotta">{o.status}</span> • Payment: {o.paymentStatus}</p>
            </div>
            <div className="mt-3 sm:mt-0 flex items-center justify-between sm:justify-end gap-4">
              <span className="text-base font-bold text-terracotta">{formatInr(Number(o.totalAmount))}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-charcoal underline">View Details →</span>
            </div>
          </Link>
        ))}
        {!items.length && (
          <div className="rounded-3xl border border-dashed border-charcoal/20 bg-ivory-dark/30 p-12 text-center">
            <p className="text-sm text-charcoal-soft">No account orders yet.</p>
            <Link to="/shop" className="mt-4 inline-block rounded-full bg-terracotta px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-ivory">
              Browse Storefront
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function OrderDetail() {
  const { orderNumber } = useParams();
  const [o, set] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    accountOrder(orderNumber)
      .then((r) => set(r.data))
      .catch((e) => setError(e.message));
  }, [orderNumber]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 space-y-8">
      {o && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between border-b border-charcoal/10 pb-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Order Summary</span>
              <h1 className="font-serif-display text-3xl text-charcoal">{o.orderNumber}</h1>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full bg-sage-light px-3 py-1 text-xs font-semibold uppercase tracking-wider text-green-deep">
                {o.status}
              </span>
              <span className="rounded-full bg-beige px-3 py-1 text-xs font-semibold uppercase tracking-wider text-charcoal">
                {o.paymentStatus}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
            <h3 className="font-serif-display text-lg text-charcoal">Purchased Items</h3>
            <ul className="divide-y divide-charcoal/5">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between py-3 text-xs">
                  <span className="font-medium text-charcoal">
                    {i.productNameSnapshot} × {i.quantity}
                  </span>
                  <span className="font-semibold text-terracotta">{formatInr(Number(i.lineTotal))}</span>
                </li>
              ))}
            </ul>

            <div className="flex justify-between border-t border-charcoal/10 pt-4 text-sm font-bold text-charcoal">
              <span>Total Amount</span>
              <span className="text-terracotta text-lg">{formatInr(Number(o.totalAmount))}</span>
            </div>
          </div>
        </div>
      )}
      {error && <p className="text-sm font-medium text-terracotta bg-terracotta/10 p-4 rounded-xl">{error}</p>}
      <Link to="/account/orders" className="inline-block text-xs font-semibold uppercase tracking-wider text-terracotta hover:underline">
        ← Return to Order History
      </Link>
    </div>
  );
}

export function Forgot() {
  const [email, set] = useState("");
  const [done, setDone] = useState(false);

  return (
    <form
      className="mx-auto max-w-md px-5 py-16 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        await forgotPassword(email);
        setDone(true);
      }}
    >
      <SectionHeading eyebrow="Security" title="Reset Password" />
      <p className="text-xs text-charcoal-soft">Enter your registered email address to receive password reset instructions.</p>
      <input
        required
        className="w-full rounded-xl border border-charcoal/15 bg-white px-4 py-3 text-sm text-charcoal focus:border-terracotta focus:outline-none"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => set(e.target.value)}
      />
      <Button className="w-full py-3">Send reset link</Button>
      {done && (
        <div className="rounded-2xl bg-sage-light p-4 text-xs font-medium text-green-deep">
          If an account exists for this email, password reset instructions have been sent.
        </div>
      )}
    </form>
  );
}

export function Reset() {
  const [q] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      className="mx-auto max-w-md px-5 py-16 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password !== confirm) return setError("Passwords do not match.");
        try {
          await resetPassword({ token: q.get("token"), newPassword: password, confirmPassword: confirm });
          setDone(true);
        } catch (e) {
          setError(e.message);
        }
      }}
    >
      <SectionHeading eyebrow="Security" title="Choose New Password" />
      <input
        required
        type="password"
        minLength="10"
        placeholder="New password"
        className="w-full rounded-xl border border-charcoal/15 bg-white px-4 py-3 text-sm text-charcoal focus:border-terracotta focus:outline-none"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        required
        type="password"
        minLength="10"
        placeholder="Confirm new password"
        className="w-full rounded-xl border border-charcoal/15 bg-white px-4 py-3 text-sm text-charcoal focus:border-terracotta focus:outline-none"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <Button className="w-full py-3">Reset password</Button>
      {error && <p className="text-xs font-medium text-terracotta bg-terracotta/10 p-3 rounded-xl">{error}</p>}
      {done && <p className="text-xs font-medium text-sage bg-sage-light p-3 rounded-xl">Password reset. You can now log in.</p>}
    </form>
  );
}
