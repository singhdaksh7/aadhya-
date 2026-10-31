import React, { useEffect, useState } from "react";
import {
  adminListWhatsNew,
  adminCreateWhatsNew,
  adminUpdateWhatsNew,
  adminDeleteWhatsNew,
} from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import ImagePickerInput from "../../components/admin/ImagePickerInput";

const emptyForm = {
  title: "",
  subtitle: "",
  imageUrl: "",
  badge: "",
  ctaLabel: "",
  ctaUrl: "",
  startDate: "",
  endDate: "",
  isActive: true,
  sortOrder: 0,
};

const toLocalInput = (d) => (d ? new Date(d).toISOString().slice(0, 16) : "");
const inputCls = "w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-charcoal/40 focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft";

export default function AdminWhatsNew() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    setStatus("loading");
    adminListWhatsNew()
      .then((res) => {
        setItems(res.data || []);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [reloadToken]);

  const reload = () => setReloadToken((t) => t + 1);

  const startEdit = (i) => {
    setEditingId(i.id);
    setError(null);
    setForm({
      title: i.title,
      subtitle: i.subtitle || "",
      imageUrl: i.imageUrl || "",
      badge: i.badge || "",
      ctaLabel: i.ctaLabel || "",
      ctaUrl: i.ctaUrl || "",
      startDate: toLocalInput(i.startDate),
      endDate: toLocalInput(i.endDate),
      isActive: i.isActive,
      sortOrder: i.sortOrder ?? 0,
    });
  };

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title,
      subtitle: form.subtitle || null,
      imageUrl: form.imageUrl || null,
      badge: form.badge || null,
      ctaLabel: form.ctaLabel || null,
      ctaUrl: form.ctaUrl || null,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      if (editingId) await adminUpdateWhatsNew(editingId, payload);
      else await adminCreateWhatsNew(payload);
      reset();
      reload();
    } catch (err) {
      setError(err.message || "Could not save this item.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (i) => {
    try {
      await adminUpdateWhatsNew(i.id, { isActive: !i.isActive });
      reload();
    } catch (err) {
      alert(err.message);
    }
  };

  const remove = async (i) => {
    if (!confirm(`Delete "${i.title}"?`)) return;
    try {
      await adminDeleteWhatsNew(i.id);
      reload();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__eyebrow">Marketing</p>
          <h1 className="admin-page-header__title">What's New</h1>
          <p className="admin-page-header__desc">Announcements and highlights shown on the storefront Offers page.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="admin-card max-w-2xl space-y-4 p-5">
        <p className="text-sm font-medium text-charcoal">{editingId ? "Edit Item" : "New Item"}</p>

        <div>
          <label className={labelCls}>Title</label>
          <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="e.g. Diwali Collection is here" />
        </div>
        <div>
          <label className={labelCls}>Subtitle</label>
          <textarea value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} className={inputCls} />
        </div>
        <ImagePickerInput
          label="Image"
          sizeHint="1200 × 900 px (4:3)"
          value={form.imageUrl}
          onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
          pickerTitle="Select What's New image"
          inputClassName={inputCls}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Badge</label>
            <input value={form.badge} onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))} className={inputCls} placeholder="New" />
          </div>
          <div>
            <label className={labelCls}>Button label</label>
            <input value={form.ctaLabel} onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))} className={inputCls} placeholder="Explore" />
          </div>
          <div>
            <label className={labelCls}>Button link</label>
            <input value={form.ctaUrl} onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))} className={inputCls} placeholder="/collections" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Show from</label>
            <input type="datetime-local" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Show until</label>
            <input type="datetime-local" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sort order</label>
            <input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} className={inputCls} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
          Active
        </label>

        {error && <p className="text-sm text-terracotta">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button disabled={saving}>{saving ? "Saving…" : editingId ? "Save Changes" : "Create Item"}</Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>
          )}
        </div>
      </form>

      <div className="admin-card mt-5 overflow-x-auto">
        {status === "loading" && <LoadingNotice />}
        {status === "error" && <ErrorNotice message="Unable to load What's New items." />}
        {status === "ready" && items.length === 0 && (
          <p className="py-8 text-center text-sm italic text-charcoal-soft">No items yet. Create one above.</p>
        )}
        {status === "ready" && items.length > 0 && (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-ivory-dark text-xs uppercase tracking-wide text-charcoal-soft">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/10">
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 font-medium text-charcoal">{i.title}</td>
                  <td className="px-4 py-3 text-xs text-charcoal-soft">
                    {i.startDate ? new Date(i.startDate).toLocaleDateString() : "Always"} – {i.endDate ? new Date(i.endDate).toLocaleDateString() : "No end"}
                  </td>
                  <td className="px-4 py-3 text-charcoal-soft">{i.sortOrder}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(i)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${i.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-700"}`}
                    >
                      {i.isActive ? "Active" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 whitespace-nowrap text-xs">
                      <button onClick={() => startEdit(i)} className="rounded-full border border-charcoal/20 bg-white px-3 py-1 font-medium text-charcoal transition hover:border-terracotta hover:text-terracotta">Edit</button>
                      <button onClick={() => remove(i)} className="rounded-full border border-terracotta/20 bg-terracotta/5 px-3 py-1 font-medium text-terracotta transition hover:bg-terracotta hover:text-ivory">Delete</button>
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
