import { useEffect, useState } from "react";
import {
  adminListCoupons,
  adminCreateCoupon,
  adminUpdateCoupon,
  adminDeleteCoupon,
  adminListCategories,
  adminListProducts,
  adminListCollections,
} from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";

const emptyForm = {
  id: null,
  code: "",
  name: "",
  description: "",
  discountType: "PERCENTAGE",
  value: "",
  minimumOrderAmount: "0",
  maximumDiscountAmount: "",
  validFrom: "",
  validUntil: "",
  usageLimit: "",
  perCustomerLimit: "",
  isActive: true,
  targetType: "ALL",
  targetId: "",
};

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [status, setStatus] = useState("loading");
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    setStatus("loading");
    Promise.all([
      adminListCoupons(),
      adminListCategories(),
      adminListProducts({ limit: 100 }),
      adminListCollections(),
    ])
      .then(([coupRes, catRes, prodRes, colRes]) => {
        setCoupons(coupRes.data);
        setCategories(catRes.data.filter((c) => c.isActive));
        setProducts(prodRes.data);
        setCollections(colRes.data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [reloadToken]);

  const startEdit = (c) => {
    const firstTarget = c.targets?.[0] || { targetType: "ALL", targetId: "" };
    setForm({
      id: c.id,
      code: c.code,
      name: c.name || "",
      description: c.description || "",
      discountType: c.discountType,
      value: String(c.value),
      minimumOrderAmount: String(c.minimumOrderAmount || 0),
      maximumDiscountAmount: c.maximumDiscountAmount != null ? String(c.maximumDiscountAmount) : "",
      validFrom: c.validFrom ? new Date(c.validFrom).toISOString().slice(0, 16) : "",
      validUntil: c.validUntil ? new Date(c.validUntil).toISOString().slice(0, 16) : "",
      usageLimit: c.usageLimit != null ? String(c.usageLimit) : "",
      perCustomerLimit: c.perCustomerLimit != null ? String(c.perCustomerLimit) : "",
      isActive: c.isActive,
      targetType: firstTarget.targetType || "ALL",
      targetId: firstTarget.targetId || "",
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const targets = [{ targetType: form.targetType, targetId: form.targetId || null }];

    const payload = {
      code: form.code,
      name: form.name || null,
      description: form.description || null,
      discountType: form.discountType,
      value: Number(form.value),
      minimumOrderAmount: Number(form.minimumOrderAmount || 0),
      maximumDiscountAmount: form.maximumDiscountAmount !== "" ? Number(form.maximumDiscountAmount) : null,
      validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : undefined,
      validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
      usageLimit: form.usageLimit !== "" ? Number(form.usageLimit) : null,
      perCustomerLimit: form.perCustomerLimit !== "" ? Number(form.perCustomerLimit) : null,
      isActive: form.isActive,
      targetType: form.targetType,
      targets,
    };

    try {
      if (form.id) await adminUpdateCoupon(form.id, payload);
      else await adminCreateCoupon(payload);
      setForm(emptyForm);
      setReloadToken((t) => t + 1);
    } catch (err) {
      setError(err.message || "Could not save this coupon.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!confirm(`Delete coupon "${c.code}"?`)) return;
    try {
      await adminDeleteCoupon(c.id);
      setReloadToken((t) => t + 1);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <h1 className="font-serif-display text-2xl text-charcoal">Coupons & Offers</h1>

      <form onSubmit={onSubmit} className="mt-6 max-w-2xl space-y-4 rounded-2xl border border-charcoal/10 p-5 bg-white">
        <p className="text-sm font-medium text-charcoal">{form.id ? "Edit Coupon" : "New Coupon"}</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Coupon Code</label>
            <input
              required
              placeholder="e.g. WELCOME10"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Coupon Name</label>
            <input
              placeholder="e.g. 10% Welcome Discount"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Discount Type</label>
            <select
              value={form.discountType}
              onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value }))}
              className={inputCls}
            >
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="FIXED">Fixed Amount (₹)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Discount Value</label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              placeholder={form.discountType === "PERCENTAGE" ? "10" : "500"}
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Min Order (₹)</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={form.minimumOrderAmount}
              onChange={(e) => setForm((f) => ({ ...f, minimumOrderAmount: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        {form.discountType === "PERCENTAGE" && (
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Max Discount Amount Cap (₹)</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 1000 (leave blank for no cap)"
              value={form.maximumDiscountAmount}
              onChange={(e) => setForm((f) => ({ ...f, maximumDiscountAmount: e.target.value }))}
              className={inputCls}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Valid From</label>
            <input
              type="datetime-local"
              value={form.validFrom}
              onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Valid Until</label>
            <input
              type="datetime-local"
              value={form.validUntil}
              onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Total Usage Limit</label>
            <input
              type="number"
              min="1"
              placeholder="Unlimited if empty"
              value={form.usageLimit}
              onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Per-Customer Limit</label>
            <input
              type="number"
              min="1"
              placeholder="Unlimited if empty"
              value={form.perCustomerLimit}
              onChange={(e) => setForm((f) => ({ ...f, perCustomerLimit: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        {/* Target selector */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Target Eligibility</label>
            <select
              value={form.targetType}
              onChange={(e) => setForm((f) => ({ ...f, targetType: e.target.value, targetId: "" }))}
              className={inputCls}
            >
              <option value="ALL">All Products</option>
              <option value="CATEGORY">Specific Category</option>
              <option value="PRODUCT">Specific Product</option>
              <option value="COLLECTION">Specific Collection</option>
            </select>
          </div>

          {form.targetType === "CATEGORY" && (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Select Category</label>
              <select
                required
                value={form.targetId}
                onChange={(e) => setForm((f) => ({ ...f, targetId: e.target.value }))}
                className={inputCls}
              >
                <option value="" disabled>Select category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {form.targetType === "PRODUCT" && (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Select Product</label>
              <select
                required
                value={form.targetId}
                onChange={(e) => setForm((f) => ({ ...f, targetId: e.target.value }))}
                className={inputCls}
              >
                <option value="" disabled>Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {form.targetType === "COLLECTION" && (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">Select Collection</label>
              <select
                required
                value={form.targetId}
                onChange={(e) => setForm((f) => ({ ...f, targetId: e.target.value }))}
                className={inputCls}
              >
                <option value="" disabled>Select collection…</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name || c.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <textarea
          placeholder="Internal notes / Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className={inputCls}
        />

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active
          </label>
        </div>

        {error && <p className="text-sm text-terracotta">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button disabled={saving}>{saving ? "Saving…" : form.id ? "Save Changes" : "Create Coupon"}</Button>
          {form.id && (
            <Button type="button" variant="secondary" onClick={() => setForm(emptyForm)}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-charcoal/10 bg-white">
        {status === "loading" && <LoadingNotice />}
        {status === "error" && <ErrorNotice message="Unable to load coupons." />}
        {status === "ready" && (
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-ivory-dark text-xs uppercase tracking-wide text-charcoal-soft">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Min Order</th>
                <th className="px-4 py-3">Used</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/10">
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-mono font-bold text-charcoal">{c.code}</td>
                  <td className="px-4 py-3 text-charcoal">
                    {c.discountType === "PERCENTAGE" ? `${c.value}%` : `₹${c.value}`}
                    {c.maximumDiscountAmount ? ` (Max ₹${c.maximumDiscountAmount})` : ""}
                  </td>
                  <td className="px-4 py-3 text-charcoal-soft">₹{c.minimumOrderAmount || 0}</td>
                  <td className="px-4 py-3 text-charcoal-soft">
                    {c.usageCount} {c.usageLimit ? `/ ${c.usageLimit}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 whitespace-nowrap text-xs">
                      <button
                        onClick={() => startEdit(c)}
                        className="rounded-full border border-charcoal/20 bg-white px-3 py-1 font-medium text-charcoal transition hover:border-terracotta hover:text-terracotta"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(c)}
                        className="rounded-full border border-terracotta/20 bg-terracotta/5 px-3 py-1 font-medium text-terracotta transition hover:bg-terracotta hover:text-ivory"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  let cls = "bg-charcoal/10 text-charcoal-soft";
  if (status === "ACTIVE") cls = "bg-emerald-100 text-emerald-800 font-semibold";
  if (status === "UPCOMING") cls = "bg-blue-100 text-blue-800 font-semibold";
  if (status === "EXPIRED") cls = "bg-amber-100 text-amber-800";
  if (status === "DISABLED") cls = "bg-rose-100 text-rose-800";

  return <span className={`rounded-full px-2.5 py-1 text-xs ${cls}`}>{status}</span>;
}

const inputCls = "w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-charcoal/40 focus:outline-none";
