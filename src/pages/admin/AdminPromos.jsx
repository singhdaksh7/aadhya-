import React, { useEffect, useState } from "react";
import {
  adminFetchPromos,
  adminCreatePromo,
  adminUpdatePromo,
  adminDeletePromo,
} from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";

export default function AdminPromos() {
  const [promos, setPromos] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);

  const [form, setForm] = useState({
    title: "",
    message: "",
    couponCode: "",
    ctaLabel: "",
    ctaUrl: "",
    icon: "sparkles",
    startDate: "",
    endDate: "",
    isActive: true,
    sortOrder: 0,
  });

  const loadPromos = async () => {
    setStatus("loading");
    try {
      const res = await adminFetchPromos();
      setPromos(res.promos || res.data || []);
      setStatus("ready");
    } catch (err) {
      console.error("Failed to load admin promos:", err);
      setStatus("error");
      setError(err.message || "Could not fetch promo messages.");
    }
  };

  useEffect(() => {
    loadPromos();
  }, []);

  const openCreateModal = () => {
    setEditingPromo(null);
    setForm({
      title: "",
      message: "",
      couponCode: "",
      ctaLabel: "",
      ctaUrl: "",
      icon: "sparkles",
      startDate: "",
      endDate: "",
      isActive: true,
      sortOrder: promos.length * 10,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p) => {
    setEditingPromo(p);
    setForm({
      title: p.title || "",
      message: p.message || "",
      couponCode: p.couponCode || "",
      ctaLabel: p.ctaLabel || "",
      ctaUrl: p.ctaUrl || "",
      icon: p.icon || "sparkles",
      startDate: p.startDate ? new Date(p.startDate).toISOString().slice(0, 16) : "",
      endDate: p.endDate ? new Date(p.endDate).toISOString().slice(0, 16) : "",
      isActive: p.isActive ?? true,
      sortOrder: p.sortOrder || 0,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        sortOrder: Number(form.sortOrder) || 0,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      };

      if (editingPromo) {
        await adminUpdatePromo(editingPromo.id, payload);
      } else {
        await adminCreatePromo(payload);
      }

      setIsModalOpen(false);
      loadPromos();
    } catch (err) {
      alert("Failed to save promo message: " + err.message);
    }
  };

  const handleToggleActive = async (promo) => {
    try {
      await adminUpdatePromo(promo.id, { isActive: !promo.isActive });
      loadPromos();
    } catch (err) {
      alert("Failed to toggle promo message status: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this promo message?")) return;
    try {
      await adminDeletePromo(id);
      loadPromos();
    } catch (err) {
      alert("Failed to delete promo message: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-charcoal/10 pb-4">
        <div>
          <h1 className="font-serif-display text-2xl text-charcoal font-bold">Promo &amp; Coupon Ticker</h1>
          <p className="text-xs text-charcoal-soft mt-1">
            Manage animated ticker messages, promotional announcements, and copyable coupon codes.
          </p>
        </div>

        <Button onClick={openCreateModal}>+ Create Promo Message</Button>
      </div>

      {status === "loading" && <LoadingNotice />}
      {status === "error" && <ErrorNotice message={error || "Could not load promo ticker messages."} />}

      {status === "ready" && (
        <div className="rounded-2xl border border-charcoal/10 bg-white p-6 shadow-xs space-y-4">
          {promos.length === 0 ? (
            <p className="text-sm text-charcoal-soft italic py-8 text-center">
              No promo ticker messages defined. Click "+ Create Promo Message" to add one.
            </p>
          ) : (
            <div className="space-y-3">
              {promos.map((p) => (
                <div
                  key={p.id}
                  className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 transition ${
                    p.isActive ? "border-charcoal/15 bg-white shadow-xs" : "border-charcoal/10 bg-gray-50 opacity-60"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-charcoal">
                        {p.title || p.message}
                      </span>
                      {p.couponCode && (
                        <span className="text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5 bg-terracotta/10 text-terracotta font-mono">
                          CODE: {p.couponCode}
                        </span>
                      )}
                      {!p.isActive && (
                        <span className="text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5 bg-gray-200 text-gray-700">
                          Inactive
                        </span>
                      )}
                    </div>

                    {p.message && p.title && (
                      <p className="text-xs text-charcoal-soft">{p.message}</p>
                    )}

                    {(p.startDate || p.endDate) && (
                      <p className="text-[11px] font-mono text-charcoal-soft">
                        {p.startDate && `Start: ${new Date(p.startDate).toLocaleString()}`}
                        {p.startDate && p.endDate && " | "}
                        {p.endDate && `End: ${new Date(p.endDate).toLocaleString()}`}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(p)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                        p.isActive
                          ? "bg-sage-light text-green-deep hover:bg-sage/20"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {p.isActive ? "Active" : "Disabled"}
                    </button>

                    <button
                      onClick={() => openEditModal(p)}
                      className="text-xs font-semibold border border-charcoal/20 rounded-full px-3 py-1.5 text-charcoal hover:bg-[#FAF6F0] transition"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-xs font-semibold text-terracotta hover:underline px-2 py-1.5"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Promo Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/50 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4 border border-charcoal/10"
          >
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
              <h3 className="font-serif-display text-xl font-bold text-charcoal">
                {editingPromo ? "Edit Promo Ticker Message" : "Create Promo Ticker Message"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-xs font-bold text-charcoal-soft hover:text-charcoal"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-charcoal-soft">Main Text / Message *</label>
              <input
                required
                type="text"
                placeholder="e.g. Complimentary gift box on orders above ₹2,499"
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Title / Heading (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Festival Offer"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Coupon Code (Display / Copy Only)</label>
                <input
                  type="text"
                  placeholder="e.g. AADYA500"
                  value={form.couponCode}
                  onChange={(e) => setForm((f) => ({ ...f, couponCode: e.target.value.toUpperCase() }))}
                  className="w-full font-mono uppercase rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-charcoal-soft">CTA Button Label (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Shop New Arrivals"
                  value={form.ctaLabel}
                  onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-charcoal-soft">CTA Target URL (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. /new-arrivals"
                  value={form.ctaUrl}
                  onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-4 py-2.5 text-sm focus:border-terracotta focus:outline-none mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Start Date (Optional)</label>
                <input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-3 py-2 text-xs focus:border-terracotta focus:outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-charcoal-soft">End Date (Optional)</label>
                <input
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-3 py-2 text-xs focus:border-terracotta focus:outline-none mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-charcoal-soft">Sort Order</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                  className="w-full rounded-xl border border-charcoal/20 px-3 py-2 text-xs focus:border-terracotta focus:outline-none mt-1"
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="promoIsActive"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-4 w-4 text-terracotta rounded border-charcoal/30 focus:ring-terracotta"
                />
                <label htmlFor="promoIsActive" className="text-xs font-semibold text-charcoal">
                  Active
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-charcoal/10">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full px-5 py-2 text-xs font-semibold text-charcoal-soft hover:text-charcoal"
              >
                Cancel
              </button>
              <Button type="submit">Save Promo Message</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
