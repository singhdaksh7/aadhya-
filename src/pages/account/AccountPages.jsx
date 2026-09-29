import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, SectionHeading } from "../../components/ui";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
import { ApiRequestError } from "../../lib/api";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";
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
  fetchWishlist,
  fetchCustomerReviews,
  updateCustomerReview,
  deleteCustomerReview,
  accountDownloads,
  reissueAccountDownloadLink,
  fetchCustomerNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  accountInvoices,
  downloadAccountInvoice,
  accountReturnEligibility,
  createAccountReturn,
  accountReturns,
  accountReturn,
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

const fieldLabels = {
  label: "Address label",
  fullName: "Full name",
  phone: "Phone",
  addressLine1: "Address line 1",
  addressLine2: "Address line 2",
  city: "City",
  state: "State",
  postalCode: "Postal code",
  country: "Country",
};

function AccountNav() {
  const { pathname } = useLocation();
  const items = [
    { path: "/account", label: "Dashboard" },
    { path: "/account/orders", label: "Orders" },
    { path: "/account/addresses", label: "Addresses" },
    { path: "/account/wishlist", label: "Wishlist" },
    { path: "/account/reviews", label: "Reviews" },
    { path: "/account/downloads", label: "Downloads" },
    { path: "/account/invoices", label: "Invoices" },
    { path: "/account/returns", label: "Returns" },
    { path: "/account/notifications", label: "Notifications" },
  ];
  return (
    <div className="flex gap-5 overflow-x-auto border-b border-charcoal/10 text-xs font-semibold uppercase tracking-wider no-scrollbar">
      {items.map((item) => {
        const active = pathname === item.path || (item.path === "/account/returns" && pathname.startsWith("/account/returns"));
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
            placeholder={fieldLabels[k] || k}
            aria-label={fieldLabels[k] || k}
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
  const [stats, setStats] = useState({ orders: 0, wishlist: 0, addresses: 0, reviews: 0 });
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

  useEffect(() => {
    Promise.all([
      Promise.resolve().then(() => accountOrders?.() || { data: [] }).catch(() => ({ data: [] })),
      Promise.resolve().then(() => fetchWishlist?.() || { data: [] }).catch(() => ({ data: [] })),
      Promise.resolve().then(() => accountAddresses?.() || { data: [] }).catch(() => ({ data: [] })),
      Promise.resolve().then(() => fetchCustomerReviews?.() || { data: [] }).catch(() => ({ data: [] })),
    ]).then(([ordersRes, wishlistRes, addressesRes, reviewsRes]) => {
      setStats({
        orders: ordersRes?.data?.length || 0,
        wishlist: wishlistRes?.data?.length || 0,
        addresses: addressesRes?.data?.length || 0,
        reviews: reviewsRes?.data?.length || 0,
      });
    });
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

      {/* Dashboard Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link to="/account/orders" className="rounded-2xl border border-charcoal/10 bg-ivory-dark/40 p-5 transition hover:border-terracotta/40 hover:shadow-sm text-center">
          <p className="text-2xl font-bold text-terracotta">{stats.orders}</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft mt-1">Orders</p>
        </Link>
        <Link to="/account/wishlist" className="rounded-2xl border border-charcoal/10 bg-ivory-dark/40 p-5 transition hover:border-terracotta/40 hover:shadow-sm text-center">
          <p className="text-2xl font-bold text-terracotta">{stats.wishlist}</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft mt-1">Wishlist</p>
        </Link>
        <Link to="/account/addresses" className="rounded-2xl border border-charcoal/10 bg-ivory-dark/40 p-5 transition hover:border-terracotta/40 hover:shadow-sm text-center">
          <p className="text-2xl font-bold text-terracotta">{stats.addresses}</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft mt-1">Addresses</p>
        </Link>
        <Link to="/account/reviews" className="rounded-2xl border border-charcoal/10 bg-ivory-dark/40 p-5 transition hover:border-terracotta/40 hover:shadow-sm text-center">
          <p className="text-2xl font-bold text-terracotta">{stats.reviews}</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft mt-1">Reviews</p>
        </Link>
      </div>

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

function ReturnRequestPanel({ orderNumber, order }) {
  const [eligibility, setEligibility] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState({});
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    accountReturnEligibility(orderNumber)
      .then((r) => setEligibility(r.data))
      .catch(() => setEligibility({ eligible: false, reason: "Could not check return eligibility right now." }));
  }, [orderNumber]);

  if (!eligibility) return null;

  if (!eligibility.eligible) {
    return (
      <div className="rounded-3xl border border-charcoal/10 bg-white p-6">
        <h3 className="font-serif-display text-lg text-charcoal">Returns</h3>
        <p className="mt-2 text-sm text-charcoal-soft">{eligibility.reason || "This order is not eligible for return."}</p>
      </div>
    );
  }

  const eligibleItems = (order.items || []).filter((i) => (eligibility.returnableItemIds || []).includes(i.id));

  const toggleItem = (id) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id] != null) delete next[id];
      else next[id] = 1;
      return next;
    });
  };

  const setQty = (id, qty, max) => {
    const n = Math.max(1, Math.min(max, Number(qty) || 1));
    setSelected((prev) => ({ ...prev, [id]: n }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const items = Object.entries(selected).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (!items.length) return setError("Select at least one item to return.");
    if (!reason.trim()) return setError("Please provide a reason for the return.");
    setSubmitting(true);
    try {
      await createAccountReturn({ orderNumber, reason, details: details.trim() || undefined, items });
      setSuccess(true);
      setShowForm(false);
    } catch (err) {
      setError(err.message || "Could not submit the return request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-3xl border border-charcoal/10 bg-white p-6">
        <p role="status" className="rounded-xl bg-sage-light p-3 text-sm font-medium text-green-deep">
          Your return request has been submitted. Track its status under <Link className="underline" to="/account/returns">Returns</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
      <h3 className="font-serif-display text-lg text-charcoal">Returns</h3>
      {!showForm ? (
        <Button type="button" onClick={() => setShowForm(true)}>Request Return</Button>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            {eligibleItems.map((item) => {
              const checked = selected[item.id] != null;
              return (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-charcoal/10 p-3">
                  <label className="flex items-center gap-2 text-sm text-charcoal">
                    <input type="checkbox" checked={checked} onChange={() => toggleItem(item.id)} className="accent-terracotta" />
                    {item.productNameSnapshot} (Qty ordered: {item.quantity})
                  </label>
                  {checked && (
                    <input
                      type="number"
                      min={1}
                      max={item.quantity}
                      value={selected[item.id]}
                      onChange={(e) => setQty(item.id, e.target.value, item.quantity)}
                      aria-label={`Quantity to return for ${item.productNameSnapshot}`}
                      className="w-20 rounded-lg border border-charcoal/15 px-2 py-1 text-sm"
                    />
                  )}
                </div>
              );
            })}
            {!eligibleItems.length && <p className="text-xs text-charcoal-soft">No returnable items were found for this order.</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal-soft" htmlFor="return-reason">Reason</label>
            <input id="return-reason" required className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for return" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-charcoal-soft" htmlFor="return-details">Additional details (optional)</label>
            <textarea id="return-details" rows={3} className={inputClass} value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          {error && <p className="text-xs font-medium text-terracotta bg-terracotta/10 p-3 rounded-xl">{error}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit Return Request"}</Button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full px-4 text-xs font-semibold text-charcoal-soft hover:text-charcoal">Cancel</button>
          </div>
        </form>
      )}
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
            {o.invoice && <button type="button" onClick={async () => { const blob = await downloadAccountInvoice(o.invoice.id); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${o.invoice.invoiceNumber}.pdf`; a.click(); URL.revokeObjectURL(url); }} className="rounded-full border border-charcoal/20 px-4 py-2 text-xs font-semibold text-charcoal">Download Invoice</button>}
          </div>
          {o.shipment && <div className="rounded-3xl border border-charcoal/10 bg-white p-6"><h3 className="font-serif-display text-lg text-charcoal">Delivery tracking</h3><p className="mt-2 text-sm text-charcoal-soft">{o.shipment.status.replaceAll("_", " ")} {o.shipment.carrier ? `· ${o.shipment.carrier}` : ""}</p>{o.shipment.trackingNumber && <p className="mt-1 text-sm text-charcoal-soft">Tracking: {o.shipment.trackingNumber}</p>}{o.shipment.estimatedDelivery && <p className="mt-1 text-sm text-charcoal-soft">Estimated delivery: {new Date(o.shipment.estimatedDelivery).toLocaleDateString("en-IN")}</p>}{o.shipment.trackingUrl && <a className="mt-3 inline-block text-xs font-semibold text-terracotta" href={o.shipment.trackingUrl} target="_blank" rel="noreferrer">Track shipment</a>}</div>}
          <ReturnRequestPanel orderNumber={o.orderNumber} order={o} />
        </div>
      )}
      {error && <p className="text-sm font-medium text-terracotta bg-terracotta/10 p-4 rounded-xl">{error}</p>}
      <Link to="/account/orders" className="inline-block text-xs font-semibold uppercase tracking-wider text-terracotta hover:underline">
        ← Return to Order History
      </Link>
    </div>
  );
}

export function AccountInvoices() {
  const [items, setItems] = useState([]); const [error, setError] = useState("");
  useEffect(() => { accountInvoices().then((r) => setItems(r.data || [])).catch((e) => setError(e.message)); }, []);
  const download = async (item) => { try { const blob = await downloadAccountInvoice(item.id); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${item.invoiceNumber}.pdf`; a.click(); URL.revokeObjectURL(url); } catch (e) { setError(e.message); } };
  return <div className="mx-auto max-w-4xl space-y-8 px-5 py-12 sm:px-8"><SectionHeading eyebrow="Customer Account" title="Invoices" /><AccountNav />{error && <p className="rounded-xl bg-terracotta/10 p-3 text-sm text-terracotta">{error}</p>}<div className="overflow-x-auto rounded-2xl border border-charcoal/10"><table className="min-w-full text-left text-sm"><thead className="bg-ivory-dark/50 text-xs text-charcoal-soft"><tr><th className="p-4">Invoice</th><th className="p-4">Date</th><th className="p-4">Order</th><th className="p-4">Amount</th><th className="p-4"></th></tr></thead><tbody>{items.map((i)=><tr key={i.id} className="border-t border-charcoal/10"><td className="p-4 font-medium">{i.invoiceNumber}</td><td className="p-4">{new Date(i.invoiceDate).toLocaleDateString("en-IN")}</td><td className="p-4">{i.order.orderNumber}</td><td className="p-4">{formatInr(i.totalAmount)}</td><td className="p-4"><button onClick={()=>download(i)} className="text-xs font-semibold text-terracotta">Download</button></td></tr>)}</tbody></table>{!items.length && <p className="p-6 text-sm text-charcoal-soft">No invoices are available yet.</p>}</div></div>;
}

const RETURN_STATUS_LABELS = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PICKUP_SCHEDULED: "Pickup Scheduled",
  IN_TRANSIT: "In Transit",
  RECEIVED: "Received",
  REFUND_PENDING: "Refund Pending",
  REFUNDED: "Refunded",
  CLOSED: "Closed",
};

function ReturnStatusBadge({ status }) {
  const rejected = status === "REJECTED";
  const done = status === "REFUNDED" || status === "CLOSED";
  const cls = rejected ? "bg-terracotta/10 text-terracotta" : done ? "bg-sage-light text-green-deep" : "bg-beige text-charcoal";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${cls}`}>{RETURN_STATUS_LABELS[status] || status}</span>;
}

export function AccountReturns() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    accountReturns()
      .then((r) => setItems(r.data || []))
      .catch((e) => setError(e.message || "Could not load your returns."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-5 py-12 sm:px-8">
      <SectionHeading eyebrow="Customer Account" title="Returns" />
      <AccountNav />

      {loading ? (
        <p className="text-xs text-charcoal-soft">Loading returns...</p>
      ) : error ? (
        <p className="rounded-xl bg-terracotta/10 p-4 text-sm text-terracotta">{error}</p>
      ) : !items.length ? (
        <div className="rounded-3xl border border-dashed border-charcoal/20 bg-ivory-dark/30 p-12 text-center">
          <p className="text-sm text-charcoal-soft">You haven't requested any returns yet.</p>
          <Link to="/account/orders" className="mt-4 inline-block text-xs font-semibold text-terracotta hover:underline">View your orders →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((r) => (
            <Link
              key={r.id}
              to={`/account/returns/${r.id}`}
              className="flex flex-col gap-3 rounded-2xl border border-charcoal/10 bg-white p-5 transition hover:border-terracotta/30 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <span className="font-serif-display text-base text-charcoal block">Return #{r.id.slice(0, 8)}</span>
                <p className="text-xs text-charcoal-soft">
                  Order: {r.order?.orderNumber || "—"} · Requested {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : "—"}
                </p>
                <p className="text-xs text-charcoal-soft">
                  {(r.items || []).map((ri) => `${ri.orderItem?.productNameSnapshot || "Item"} × ${ri.quantity}`).join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {r.refundStatus && <span className="text-xs font-medium text-charcoal-soft">Refund: {r.refundStatus}</span>}
                <ReturnStatusBadge status={r.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const RETURN_TIMELINE_STEPS = [
  { status: "REQUESTED", label: "Requested", timestampKey: "createdAt" },
  { status: "APPROVED", label: "Approved", timestampKey: "approvedAt" },
  { status: "PICKUP_SCHEDULED", label: "Pickup Scheduled" },
  { status: "IN_TRANSIT", label: "In Transit" },
  { status: "RECEIVED", label: "Received", timestampKey: "receivedAt" },
  { status: "REFUND_PENDING", label: "Refund Pending" },
  { status: "REFUNDED", label: "Refunded", timestampKey: "completedAt" },
  { status: "CLOSED", label: "Closed", timestampKey: "completedAt" },
];

function ReturnTimeline({ returnRequest }) {
  if (returnRequest.status === "REJECTED") {
    return (
      <div className="rounded-3xl border border-terracotta/30 bg-terracotta/5 p-6">
        <p className="text-sm font-semibold text-terracotta">This return request was rejected.</p>
        {returnRequest.rejectedAt && <p className="mt-1 text-xs text-charcoal-soft">Rejected on {new Date(returnRequest.rejectedAt).toLocaleString("en-IN")}</p>}
        {returnRequest.details && <p className="mt-2 text-xs text-charcoal-soft whitespace-pre-line">{returnRequest.details}</p>}
      </div>
    );
  }

  const currentIndex = RETURN_TIMELINE_STEPS.findIndex((s) => s.status === returnRequest.status);

  return (
    <div className="rounded-3xl border border-charcoal/10 bg-white p-6">
      <h3 className="font-serif-display text-lg text-charcoal mb-5">Status Timeline</h3>
      <ol className="space-y-4">
        {RETURN_TIMELINE_STEPS.map((step, idx) => {
          const reached = currentIndex >= 0 && idx <= currentIndex;
          const current = idx === currentIndex;
          const ts = step.timestampKey ? returnRequest[step.timestampKey] : null;
          return (
            <li key={step.status} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                  current ? "bg-terracotta text-white" : reached ? "bg-sage-light text-green-deep" : "bg-charcoal/10 text-charcoal-soft"
                }`}
              >
                {reached ? "✓" : idx + 1}
              </span>
              <div>
                <p className={`text-sm font-semibold ${current ? "text-terracotta" : reached ? "text-charcoal" : "text-charcoal-soft"}`}>
                  {step.label}
                  {current && <span className="ml-2 rounded-full bg-terracotta/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-terracotta">Current</span>}
                </p>
                {ts && <p className="text-xs text-charcoal-soft">{new Date(ts).toLocaleString("en-IN")}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function AccountReturnDetail() {
  const { id } = useParams();
  const [r, setR] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setR(null);
    setNotFound(false);
    setError("");
    accountReturn(id)
      .then((res) => setR(res.data))
      .catch((e) => {
        if (e instanceof ApiRequestError && e.status === 404) setNotFound(true);
        else setError(e.message || "Could not load this return request.");
      });
  }, [id]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 space-y-6 text-center">
        <SectionHeading eyebrow="Customer Account" title="Return Not Found" />
        <p className="text-sm text-charcoal-soft">We couldn't find that return request.</p>
        <Link to="/account/returns" className="inline-block text-xs font-semibold uppercase tracking-wider text-terracotta hover:underline">← Back to Returns</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:px-8 space-y-6">
      {r && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-charcoal/10 pb-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Return Request</span>
              <h1 className="font-serif-display text-3xl text-charcoal">#{r.id.slice(0, 8)}</h1>
              <p className="mt-1 text-xs text-charcoal-soft">Order: {r.order?.orderNumber || "—"}</p>
            </div>
            <ReturnStatusBadge status={r.status} />
          </div>

          <div className="rounded-3xl border border-charcoal/10 bg-white p-6 space-y-4">
            <h3 className="font-serif-display text-lg text-charcoal">Returned Items</h3>
            <ul className="divide-y divide-charcoal/5">
              {(r.items || []).map((ri) => (
                <li key={ri.id} className="flex justify-between py-3 text-xs">
                  <span className="font-medium text-charcoal">{ri.orderItem?.productNameSnapshot || "Item"} × {ri.quantity}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-charcoal/10 pt-4 text-sm">
              <p><span className="font-semibold text-charcoal">Reason: </span><span className="text-charcoal-soft">{r.reason}</span></p>
              {r.details && <p className="mt-1"><span className="font-semibold text-charcoal">Details: </span><span className="text-charcoal-soft whitespace-pre-line">{r.details}</span></p>}
              {r.refundAmount != null && Number(r.refundAmount) > 0 && (
                <p className="mt-1"><span className="font-semibold text-charcoal">Refund amount: </span><span className="text-charcoal-soft">{formatInr(Number(r.refundAmount))}{r.refundStatus ? ` (${r.refundStatus})` : ""}</span></p>
              )}
            </div>
          </div>

          <ReturnTimeline returnRequest={r} />
        </div>
      )}
      {error && <p className="text-sm font-medium text-terracotta bg-terracotta/10 p-4 rounded-xl">{error}</p>}
      <Link to="/account/returns" className="inline-block text-xs font-semibold uppercase tracking-wider text-terracotta hover:underline">
        ← Return to Returns
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

export function AccountWishlist() {
  const { wishlist, loading, removeFromWishlist } = useWishlist();
  const { addItem } = useCart();
  const navigate = useNavigate();

  const handleMoveToCart = (item) => {
    const p = item.product;
    if (!p) return;
    const hasVariants = p.variants && p.variants.length > 0;
    if (hasVariants && !item.variant) {
      navigate(`/shop/${p.slug}`);
      return;
    }
    addItem(p, 1, item.variant);
  };

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 space-y-8">
      <SectionHeading eyebrow="Customer Account" title="My Wishlist" />
      <AccountNav />

      {loading ? (
        <p className="text-xs text-charcoal-soft">Loading wishlist...</p>
      ) : wishlist.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-charcoal/20 bg-ivory-dark/30 p-12 text-center">
          <p className="text-sm text-charcoal-soft">Your wishlist is currently empty.</p>
          <Link to="/shop" className="mt-4 inline-block rounded-full bg-terracotta px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-white">
            Discover Objects
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wishlist.map((item) => {
            const p = item.product || (item.productName ? {
              id: item.productId,
              name: item.productName,
              slug: item.productSlug,
              price: item.price,
              salePrice: item.salePrice,
              stockQuantity: item.stockQuantity,
              images: item.image ? [{ url: item.image }] : [],
            } : null);
            if (!p) return null;
            const price = Number(p.price);
            const salePrice = p.salePrice ? Number(p.salePrice) : null;
            const stockQty = p.stockQuantity ?? (p.inStock !== false ? 10 : 0);
            const outOfStock = p.inStock === false || stockQty <= 0;

            return (
              <div key={item.id} className="group relative flex flex-col overflow-hidden rounded-2xl border border-charcoal/10 bg-white p-4 transition hover:shadow-md">
                <Link to={`/shop/${p.slug}`} className="relative aspect-square w-full overflow-hidden rounded-xl bg-ivory-dark/40 mb-3">
                  <img
                    src={p.images?.[0] || p.image || "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=800&auto=format&fit=crop"}
                    alt={p.name}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </Link>

                <div className="flex-1 flex flex-col">
                  <Link to={`/shop/${p.slug}`} className="font-serif-display text-base text-charcoal hover:text-terracotta line-clamp-1 font-bold">
                    {p.name}
                  </Link>

                  {item.variant && (
                    <p className="text-xs text-charcoal-soft mt-0.5">Option: {item.variant.name}</p>
                  )}

                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-sm font-bold text-terracotta">{formatInr(salePrice ?? price)}</span>
                    {salePrice && <span className="text-xs text-charcoal-soft line-through">{formatInr(price)}</span>}
                  </div>

                  <p className="text-[11px] font-medium mt-1">
                    {outOfStock ? (
                      <span className="text-terracotta">Out of Stock</span>
                    ) : (
                      <span className="text-sage">In Stock</span>
                    )}
                  </p>

                  <div className="mt-4 pt-3 border-t border-charcoal/10 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleMoveToCart(item)}
                      disabled={outOfStock}
                      className={`flex-1 rounded-xl py-2 px-3 text-xs font-semibold uppercase tracking-wider text-white transition ${
                        outOfStock ? "bg-charcoal/30 cursor-not-allowed" : "bg-terracotta hover:bg-terracotta-dark"
                      }`}
                    >
                      {p.variants?.length > 0 && !item.variant ? "Select Option" : "Move to Cart"}
                    </button>
                    <button
                      onClick={() => removeFromWishlist(item.id)}
                      className="rounded-xl border border-charcoal/20 px-3 py-2 text-xs font-semibold text-charcoal hover:border-terracotta hover:text-terracotta transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AccountReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingReview, setEditingReview] = useState(null);
  const [editForm, setEditForm] = useState({ rating: 5, title: "", comment: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchCustomerReviews();
      setReviews(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingReview) return;
    try {
      await updateCustomerReview(editingReview.id, editForm);
      setEditingReview(null);
      setNotice("Review updated and submitted for re-moderation.");
      setTimeout(() => setNotice(""), 3000);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this review?")) return;
    try {
      await deleteCustomerReview(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 space-y-8">
      <SectionHeading eyebrow="Customer Account" title="My Reviews" />
      <AccountNav />

      {notice && <div className="rounded-xl bg-sage-light p-4 text-xs font-semibold text-green-deep">{notice}</div>}
      {error && <div className="rounded-xl bg-terracotta/10 p-4 text-xs font-semibold text-terracotta">{error}</div>}

      {/* Edit Review Modal / Form */}
      {editingReview && (
        <form onSubmit={handleUpdate} className="rounded-3xl border border-terracotta/30 bg-ivory-dark/40 p-6 space-y-4 shadow-sm">
          <h3 className="font-serif-display text-lg font-bold text-charcoal">Edit Review</h3>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">Rating</label>
            <div className="flex gap-2 text-xl cursor-pointer">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setEditForm({ ...editForm, rating: star })}
                  className={star <= editForm.rating ? "text-amber-500" : "text-charcoal/20"}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">Title</label>
            <input
              required
              className="w-full rounded-xl border border-charcoal/15 bg-white px-4 py-2.5 text-sm text-charcoal focus:border-terracotta focus:outline-none"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">Review Comment</label>
            <textarea
              required
              rows={3}
              className="w-full rounded-xl border border-charcoal/15 bg-white px-4 py-2.5 text-sm text-charcoal focus:border-terracotta focus:outline-none"
              value={editForm.comment}
              onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
            />
          </div>
          <div className="flex gap-3">
            <Button type="submit">Save &amp; Submit for Moderation</Button>
            <button
              type="button"
              onClick={() => setEditingReview(null)}
              className="rounded-full border border-charcoal/20 px-5 py-2.5 text-xs font-semibold text-charcoal hover:bg-charcoal/5"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-charcoal-soft">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-charcoal/20 bg-ivory-dark/30 p-12 text-center">
          <p className="text-sm text-charcoal-soft">You haven't written any reviews yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-2xl border border-charcoal/10 bg-white p-5 space-y-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-charcoal/5 pb-3">
                <Link to={`/shop/${r.product?.slug}`} className="font-serif-display text-base font-bold text-charcoal hover:text-terracotta">
                  {r.product?.name || "Product"}
                </Link>
                <div className="flex items-center gap-2">
                  {r.status === "PENDING" && (
                    <span className="rounded-full bg-amber-100 px-3 py-0.5 text-[10px] font-semibold text-amber-800 uppercase tracking-wider">
                      Pending Moderation
                    </span>
                  )}
                  {r.status === "APPROVED" && (
                    <span className="rounded-full bg-sage-light px-3 py-0.5 text-[10px] font-semibold text-green-deep uppercase tracking-wider">
                      Published
                    </span>
                  )}
                  {r.status === "REJECTED" && (
                    <span className="rounded-full bg-terracotta/10 px-3 py-0.5 text-[10px] font-semibold text-terracotta uppercase tracking-wider">
                      Rejected
                    </span>
                  )}
                  {r.isVerifiedPurchase && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700">
                      Verified Buyer
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center text-amber-500 text-sm">
                {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
              </div>

              <h4 className="font-semibold text-sm text-charcoal">{r.title}</h4>
              <p className="text-xs text-charcoal-soft leading-relaxed">{r.comment}</p>

              <div className="pt-2 flex items-center justify-between text-xs border-t border-charcoal/5 text-charcoal-soft">
                <span>Submitted on {new Date(r.createdAt).toLocaleDateString()}</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditingReview(r);
                      setEditForm({ rating: r.rating, title: r.title, comment: r.comment });
                    }}
                    className="text-charcoal hover:text-terracotta underline font-medium"
                  >
                    Edit Review
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-terracotta hover:underline font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AccountDownloads() {
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    accountDownloads()
      .then((res) => setDownloads(res.data || []))
      .catch(() => setError("Could not load your downloads."))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (item) => {
    setBusyId(item.orderItemId || item.orderNumber + item.pdfFilename);
    try {
      const res = await reissueAccountDownloadLink(item.orderItemId);
      const url = `${(import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "")}/downloads/${res.data.token}`;
      window.location.href = url;
    } catch (err) {
      setError(err.message || "Could not start the download.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 space-y-8">
      <SectionHeading eyebrow="Customer Account" title="My Downloads" />
      <AccountNav />

      {loading ? (
        <p className="text-xs text-charcoal-soft">Loading downloads...</p>
      ) : error ? (
        <p className="rounded-xl bg-terracotta/10 p-4 text-sm text-terracotta">{error}</p>
      ) : downloads.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-charcoal/20 bg-ivory-dark/30 p-12 text-center">
          <p className="text-sm text-charcoal-soft">You don't have any digital books yet.</p>
          <Link to="/books" className="mt-4 inline-block rounded-full bg-terracotta px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-white">
            Browse Books
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-charcoal/10 rounded-2xl border border-charcoal/10">
          {downloads.map((d) => {
            const disabled = d.paymentStatus !== "PAID" || d.expired || d.exhausted;
            const reason = d.paymentStatus !== "PAID" ? "Payment pending" : d.expired ? "Link expired" : d.exhausted ? "Download limit reached" : null;
            return (
              <div key={d.orderItemId || `${d.orderNumber}-${d.pdfFilename}`} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-charcoal">{d.productTitle}</p>
                  <p className="text-xs text-charcoal-soft">{d.pdfFilename}</p>
                  <p className="mt-1 text-xs text-charcoal-soft">
                    Downloads used: {d.downloadCount}{d.maxDownloads != null ? ` / ${d.maxDownloads}` : ""}
                    {d.expiresAt ? ` · Expires ${new Date(d.expiresAt).toLocaleDateString("en-IN")}` : ""}
                  </p>
                </div>
                <div className="shrink-0">
                  <Button type="button" disabled={disabled || busyId} onClick={() => handleDownload(d)}>
                    {busyId ? "Preparing…" : "Download"}
                  </Button>
                  {disabled && reason && <p className="mt-1 text-xs text-terracotta text-right">{reason}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AccountNotifications() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = () => {
    setLoading(true);
    fetchCustomerNotifications()
      .then((res) => {
        setItems(res.data || []);
        setUnreadCount(res.meta?.unreadCount ?? 0);
      })
      .catch(() => setError("Could not load your notifications."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleMarkRead = async (id) => {
    setBusyId(id);
    try {
      await markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err.message || "Could not update the notification.");
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(err.message || "Could not update notifications.");
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 space-y-8">
      <SectionHeading eyebrow="Customer Account" title="Notifications" />
      <AccountNav />

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        </p>
        {unreadCount > 0 && (
          <Button type="button" onClick={handleMarkAllRead} disabled={markingAll}>
            {markingAll ? "Marking..." : "Mark all read"}
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-charcoal-soft">Loading notifications...</p>
      ) : error ? (
        <p className="rounded-xl bg-terracotta/10 p-4 text-sm text-terracotta">{error}</p>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-charcoal/20 bg-ivory-dark/30 p-12 text-center">
          <p className="text-sm text-charcoal-soft">You don't have any notifications yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-charcoal/10 rounded-2xl border border-charcoal/10">
          {items.map((n) => (
            <div
              key={n.id}
              className={`flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between ${n.isRead ? "" : "bg-terracotta/5"}`}
            >
              <div>
                <p className="font-medium text-charcoal">{n.title}</p>
                <p className="text-xs text-charcoal-soft">{n.message}</p>
                <p className="mt-1 text-xs text-charcoal-soft">{new Date(n.createdAt).toLocaleDateString("en-IN")}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {n.link && (
                  <Link to={n.link} className="text-xs font-semibold uppercase tracking-wider text-terracotta">
                    View
                  </Link>
                )}
                {!n.isRead && (
                  <Button type="button" disabled={busyId === n.id} onClick={() => handleMarkRead(n.id)}>
                    {busyId === n.id ? "..." : "Mark read"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
