import React, { useState, useEffect } from "react";
import {
  adminFetchBulkGiftingInquiries,
  adminUpdateBulkGiftingInquiry,
} from "../../lib/api";

const STATUS_BADGES = {
  NEW: "bg-blue-100 text-blue-800 border-blue-200",
  CONTACTED: "bg-amber-100 text-amber-800 border-amber-200",
  QUALIFIED: "bg-purple-100 text-purple-800 border-purple-200",
  CLOSED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export default function AdminBulkInquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const loadInquiries = async () => {
    setLoading(true);
    try {
      const res = await adminFetchBulkGiftingInquiries({
        page,
        limit: 20,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      });
      setInquiries(res.items || []);
      setPagination(res.pagination || { total: 0, totalPages: 1 });
    } catch (err) {
      console.error("Failed to load inquiries:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInquiries();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadInquiries();
  };

  const openDetail = (item) => {
    setSelectedInquiry(item);
    setEditStatus(item.status);
    setEditNotes(item.internalNotes || "");
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!selectedInquiry) return;
    setUpdating(true);
    try {
      const res = await adminUpdateBulkGiftingInquiry(selectedInquiry.id, {
        status: editStatus,
        internalNotes: editNotes,
      });
      setSelectedInquiry(res.data);
      setInquiries((prev) =>
        prev.map((it) => (it.id === res.data.id ? res.data : it))
      );
    } catch (err) {
      alert("Failed to update inquiry: " + (err.message || "Unknown error"));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Bulk Gifting Inquiries</h1>
          <p className="text-xs sm:text-sm text-charcoal-soft">
            Manage large corporate orders, festival requests, and bespoke gifting enquiries.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-charcoal/10 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-semibold text-charcoal whitespace-nowrap">Filter Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-charcoal/20 px-3 py-1.5 text-xs text-charcoal focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="NEW">NEW</option>
            <option value="CONTACTED">CONTACTED</option>
            <option value="QUALIFIED">QUALIFIED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search name, email, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-charcoal/20 px-3 py-1.5 text-xs text-charcoal w-full sm:w-64 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-charcoal px-4 py-1.5 text-xs font-semibold text-white hover:bg-charcoal/90"
          >
            Search
          </button>
        </form>
      </div>

      {/* Table & Detail Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`${selectedInquiry ? "lg:col-span-7" : "lg:col-span-12"} transition-all`}>
          <div className="bg-white rounded-2xl border border-charcoal/10 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-xs text-charcoal-soft">Loading inquiries...</div>
            ) : inquiries.length === 0 ? (
              <div className="p-12 text-center text-xs text-charcoal-soft">No inquiries found matching criteria.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-charcoal/5 border-b border-charcoal/10 text-charcoal-soft font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Client</th>
                      <th className="p-3">Occasion & Qty</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Date</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal/10">
                    {inquiries.map((inq) => (
                      <tr
                        key={inq.id}
                        className={`hover:bg-charcoal/5 transition cursor-pointer ${
                          selectedInquiry?.id === inq.id ? "bg-charcoal/10" : ""
                        }`}
                        onClick={() => openDetail(inq)}
                      >
                        <td className="p-3">
                          <div className="font-semibold text-charcoal">{inq.name}</div>
                          <div className="text-charcoal-soft">{inq.email}</div>
                          {inq.company && <div className="text-[11px] text-charcoal-soft/80">{inq.company}</div>}
                        </td>
                        <td className="p-3">
                          <div className="text-charcoal">{inq.occasion}</div>
                          <div className="text-charcoal-soft font-mono">Qty: {inq.quantity}</div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                              STATUS_BADGES[inq.status] || "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {inq.status}
                          </span>
                        </td>
                        <td className="p-3 text-charcoal-soft whitespace-nowrap">
                          {new Date(inq.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(inq);
                            }}
                            className="text-xs font-semibold text-charcoal underline hover:text-charcoal/80"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Selected Inquiry Detail Side Drawer */}
        {selectedInquiry && (
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-charcoal/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
              <h3 className="font-serif-display text-lg font-bold text-charcoal">Inquiry Details</h3>
              <button
                type="button"
                onClick={() => setSelectedInquiry(null)}
                className="text-charcoal-soft hover:text-charcoal text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-charcoal-soft font-semibold block">Client Name</span>
                <span className="text-charcoal font-medium text-sm">{selectedInquiry.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-charcoal-soft font-semibold block">Email</span>
                  <a href={`mailto:${selectedInquiry.email}`} className="text-blue-600 underline">
                    {selectedInquiry.email}
                  </a>
                </div>
                <div>
                  <span className="text-charcoal-soft font-semibold block">Phone</span>
                  <a href={`tel:${selectedInquiry.phone}`} className="text-blue-600 underline">
                    {selectedInquiry.phone}
                  </a>
                </div>
              </div>
              {selectedInquiry.company && (
                <div>
                  <span className="text-charcoal-soft font-semibold block">Company</span>
                  <span className="text-charcoal">{selectedInquiry.company}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-charcoal-soft font-semibold block">Quantity</span>
                  <span className="text-charcoal font-mono">{selectedInquiry.quantity} pcs</span>
                </div>
                <div>
                  <span className="text-charcoal-soft font-semibold block">Budget</span>
                  <span className="text-charcoal">{selectedInquiry.budget || "Unspecified"}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-charcoal-soft font-semibold block">Occasion</span>
                  <span className="text-charcoal">{selectedInquiry.occasion}</span>
                </div>
                <div>
                  <span className="text-charcoal-soft font-semibold block">Preferred Date</span>
                  <span className="text-charcoal">{selectedInquiry.preferredDate || "Flexible"}</span>
                </div>
              </div>
              {selectedInquiry.location && (
                <div>
                  <span className="text-charcoal-soft font-semibold block">Location</span>
                  <span className="text-charcoal">{selectedInquiry.location}</span>
                </div>
              )}
              <div>
                <span className="text-charcoal-soft font-semibold block">Message / Requirements</span>
                <div className="mt-1 p-3 rounded-xl bg-charcoal/5 text-charcoal leading-relaxed whitespace-pre-wrap">
                  {selectedInquiry.message}
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdate} className="pt-4 border-t border-charcoal/10 space-y-3">
              <div>
                <label className="text-xs font-semibold text-charcoal block mb-1">Update Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full rounded-xl border border-charcoal/20 px-3 py-2 text-xs text-charcoal focus:outline-none"
                >
                  <option value="NEW">NEW</option>
                  <option value="CONTACTED">CONTACTED</option>
                  <option value="QUALIFIED">QUALIFIED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-charcoal block mb-1">Internal Notes</label>
                <textarea
                  rows="3"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Record call logs, quote details, custom quotes sent..."
                  className="w-full rounded-xl border border-charcoal/20 p-2.5 text-xs text-charcoal focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={updating}
                className="w-full rounded-xl bg-charcoal py-2 text-xs font-semibold text-white hover:bg-charcoal/90 disabled:opacity-50"
              >
                {updating ? "Saving..." : "Save Status & Notes"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

