import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
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
  const navItems = [
    { path: "/account", label: "Dashboard / Profile" },
    { path: "/account/orders", label: "Orders" },
    { path: "/account/addresses", label: "Addresses" },
    { path: "/account/wishlist", label: "Wishlist" },
    { path: "/account/reviews", label: "Reviews" },
  ];

  return (
    <div className="flex border-b border-charcoal/10 gap-6 text-xs font-semibold uppercase tracking-wider mb-8 overflow-x-auto no-scrollbar">
      {navItems.map((item) => {
        const isActive = pathname === item.path || (item.path === "/account" && pathname === "/account/profile");
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`pb-3 whitespace-nowrap border-b-2 transition ${
              isActive ? "border-terracotta text-terracotta font-bold" : "border-transparent text-charcoal-soft hover:text-terracotta"
            }`}
          >
            {item.label}
          </Link>
        );
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

export function Account() {
  const { user, logout } = useCustomerAuth();
  const nav = useNavigate();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [stats, setStats] = useState({ orders: 0, wishlist: 0, addresses: 0, reviews: 0 });

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

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 space-y-8">
      <SectionHeading eyebrow="Customer Account" title="Welcome, Sanctuary Member" />

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

      <div className="grid gap-8 md:grid-cols-2">
        {/* Profile Details Form */}
        <form
          className="rounded-3xl border border-charcoal/10 bg-ivory-dark/40 p-6 sm:p-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await updateAccountProfile({ name, phone: phone || null });
              setMessage("Profile saved.");
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          <h2 className="font-serif-display text-xl text-charcoal">Profile Information</h2>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">Full Name</label>
            <input
              required
              className="w-full rounded-xl border border-charcoal/15 bg-white px-4 py-2.5 text-sm text-charcoal focus:border-terracotta focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">Phone Number</label>
            <input
              className="w-full rounded-xl border border-charcoal/15 bg-white px-4 py-2.5 text-sm text-charcoal focus:border-terracotta focus:outline-none"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile Phone"
            />
          </div>
          <p className="text-xs text-charcoal-soft pt-1">{`Email: ${user.email}`}</p>
          <Button className="w-full">Save profile</Button>
        </form>

        {/* Change Password Form */}
        <form
          className="rounded-3xl border border-charcoal/10 bg-ivory-dark/40 p-6 sm:p-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pw.newPassword !== pw.confirmPassword) return setError("New passwords do not match.");
            try {
              await changeAccountPassword(pw);
              await logout();
              nav("/login", { replace: true });
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          <h2 className="font-serif-display text-xl text-charcoal">Security &amp; Password</h2>
          {[
            ["currentPassword", "Current Password"],
            ["newPassword", "New Password"],
            ["confirmPassword", "Confirm New Password"],
          ].map(([k, l]) => (
            <div key={k}>
              <label className="block text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-1">{l}</label>
              <input
                required
                minLength="10"
                type="password"
                className="w-full rounded-xl border border-charcoal/15 bg-white px-4 py-2.5 text-sm text-charcoal focus:border-terracotta focus:outline-none"
                placeholder={l}
                value={pw[k]}
                onChange={(e) => setPw({ ...pw, [k]: e.target.value })}
              />
            </div>
          ))}
          <Button className="w-full">Change password</Button>
        </form>
      </div>

      {error && <p className="text-xs font-medium text-terracotta bg-terracotta/10 p-3 rounded-xl">{error}</p>}
      {message && <p className="text-xs font-medium text-sage bg-sage-light p-3 rounded-xl">{message}</p>}

      <div className="pt-4 flex justify-between items-center border-t border-charcoal/10">
        <button onClick={logout} className="text-xs font-semibold uppercase tracking-wider text-terracotta hover:underline">
          Logout
        </button>
      </div>
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
