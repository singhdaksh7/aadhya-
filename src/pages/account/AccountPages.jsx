import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, SectionHeading } from "../../components/ui";
import { useCustomerAuth } from "../../context/CustomerAuthContext";
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
  return (
    <div className="flex border-b border-charcoal/10 gap-6 text-xs font-semibold uppercase tracking-wider mb-8">
      <Link to="/account" className="pb-3 border-b-2 border-terracotta text-terracotta">
        Profile &amp; Security
      </Link>
      <Link to="/account/orders" className="pb-3 text-charcoal-soft hover:text-terracotta">
        Order History
      </Link>
      <Link to="/account/addresses" className="pb-3 text-charcoal-soft hover:text-terracotta">
        Saved Addresses
      </Link>
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

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = register ? { ...form, phone: form.phone.trim() || undefined } : form;
      await (register ? join : login)(payload);
      const p = q.get("returnTo");
      nav(p?.startsWith("/") && !p.startsWith("//") ? p : "/account");
    } catch (e) {
      setError(e.message);
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
        </div>

        {error && <p className="text-xs font-medium text-terracotta bg-terracotta/10 p-3 rounded-xl">{error}</p>}

        <Button className="w-full py-3">{register ? "Create account" : "Log in"}</Button>
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

  return (
    <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 space-y-8">
      <SectionHeading eyebrow="Customer Account" title="Welcome, Sanctuary Member" />

      <AccountNav />

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
