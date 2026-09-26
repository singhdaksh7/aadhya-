import { useState, useEffect, useCallback } from "react";
import { adminListReviews, adminUpdateReviewStatus, adminDeleteReview, resolveProductImageUrl } from "../../lib/api";

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-1 text-amber-500">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rating ? "text-amber-500" : "text-gray-300"}>
          ★
        </span>
      ))}
      <span className="ml-1 text-xs font-semibold text-charcoal">{rating}.0</span>
    </div>
  );
}

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadReviews = useCallback(
    async (page = 1) => {
      setLoading(true);
      setErrorMsg("");
      try {
        const params = {
          page,
          limit: 20,
          status: statusFilter === "ALL" ? undefined : statusFilter,
          search: searchQuery.trim() || undefined,
          rating: ratingFilter || undefined,
        };
        const res = await adminListReviews(params);
        setReviews(res.data || []);
        setMeta(res.meta || { page: 1, limit: 20, totalItems: 0, totalPages: 1 });
      } catch (err) {
        setErrorMsg(err.message || "Failed to load reviews.");
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, searchQuery, ratingFilter]
  );

  useEffect(() => {
    loadReviews(1);
  }, [loadReviews]);

  const handleStatusChange = async (id, newStatus) => {
    setActionLoadingId(id);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await adminUpdateReviewStatus(id, newStatus);
      setSuccessMsg(`Review updated to ${newStatus}.`);
      await loadReviews(meta.page);
    } catch (err) {
      setErrorMsg(err.message || "Failed to update review status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this review?")) return;
    setActionLoadingId(id);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await adminDeleteReview(id);
      setSuccessMsg("Review deleted successfully.");
      await loadReviews(meta.page);
    } catch (err) {
      setErrorMsg(err.message || "Failed to delete review.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-charcoal/10 pb-4">
        <div>
          <h1 className="font-serif-display text-2xl font-bold text-charcoal sm:text-3xl">Product Reviews</h1>
          <p className="mt-1 text-xs text-charcoal-soft">Moderate, approve, and manage customer product reviews.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-xs font-medium text-green-700">
          {successMsg}
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-ivory/60 p-4 rounded-2xl border border-charcoal/10">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2">
          {["ALL", "PENDING", "APPROVED", "REJECTED"].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                statusFilter === tab
                  ? "bg-terracotta text-white shadow-sm"
                  : "bg-white text-charcoal-soft border border-charcoal/15 hover:bg-charcoal/5"
              }`}
            >
              {tab === "ALL" ? "All Statuses" : tab}
            </button>
          ))}
        </div>

        {/* Search & Rating Filter */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Search comment, product, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-xl border border-charcoal/20 bg-white px-3 py-2 text-xs text-charcoal focus:border-terracotta focus:outline-none"
          />
          <select
            value={ratingFilter}
            onChange={(e) => setRatingFilter(e.target.value)}
            className="rounded-xl border border-charcoal/20 bg-white px-3 py-2 text-xs text-charcoal focus:border-terracotta focus:outline-none"
          >
            <option value="">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="overflow-x-auto rounded-2xl border border-charcoal/10 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-charcoal/5 text-charcoal-soft font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Review</th>
              <th className="px-4 py-3">Verified</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal/10">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-charcoal-soft">
                  Loading reviews...
                </td>
              </tr>
            ) : reviews.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-charcoal-soft">
                  No reviews found matching your criteria.
                </td>
              </tr>
            ) : (
              reviews.map((r) => (
                <tr key={r.id} className="hover:bg-charcoal/5 transition">
                  {/* Product */}
                  <td className="px-4 py-3 font-medium text-charcoal">
                    <div className="flex items-center gap-3">
                      {r.productImage ? (
                        <img
                          src={resolveProductImageUrl(r.productImage)}
                          alt={r.productName || "Product"}
                          className="h-10 w-10 rounded-lg object-cover border border-charcoal/10"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-charcoal/10 flex items-center justify-center text-[10px] text-charcoal-soft">
                          No Image
                        </div>
                      )}
                      <div>
                        <a
                          href={`/products/${r.productSlug || r.productId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-charcoal hover:text-terracotta"
                        >
                          {r.productName || "Unknown Product"}
                        </a>
                      </div>
                    </div>
                  </td>

                  {/* Customer */}
                  <td className="px-4 py-3">
                    <p className="font-medium text-charcoal">{r.customerName || "Customer"}</p>
                    <p className="text-[11px] text-charcoal-soft">{r.customerEmail}</p>
                  </td>

                  {/* Rating */}
                  <td className="px-4 py-3">
                    <StarRating rating={r.rating} />
                  </td>

                  {/* Review Content */}
                  <td className="px-4 py-3 max-w-xs">
                    {r.title && <p className="font-semibold text-charcoal mb-0.5">{r.title}</p>}
                    <p className="text-charcoal-soft line-clamp-3 leading-relaxed">{r.comment}</p>
                  </td>

                  {/* Verified Purchase */}
                  <td className="px-4 py-3">
                    {r.isVerifiedPurchase ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-[10px] font-semibold text-green-700 border border-green-200">
                        ✓ Verified Buyer
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-[10px] font-medium text-gray-500 border border-gray-200">
                        Unverified
                      </span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        r.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800"
                          : r.status === "REJECTED"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-charcoal-soft text-[11px]">
                    {new Date(r.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.status !== "APPROVED" && (
                        <button
                          disabled={actionLoadingId === r.id}
                          onClick={() => handleStatusChange(r.id, "APPROVED")}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      )}
                      {r.status !== "REJECTED" && (
                        <button
                          disabled={actionLoadingId === r.id}
                          onClick={() => handleStatusChange(r.id, "REJECTED")}
                          className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}
                      <button
                        disabled={actionLoadingId === r.id}
                        onClick={() => handleDelete(r.id)}
                        className="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-charcoal/10 pt-4">
          <p className="text-xs text-charcoal-soft">
            Showing Page {meta.page} of {meta.totalPages} ({meta.totalItems} total reviews)
          </p>
          <div className="flex gap-2">
            <button
              disabled={meta.page <= 1}
              onClick={() => loadReviews(meta.page - 1)}
              className="rounded-xl border border-charcoal/20 bg-white px-3 py-1.5 text-xs font-medium text-charcoal hover:bg-charcoal/5 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={meta.page >= meta.totalPages}
              onClick={() => loadReviews(meta.page + 1)}
              className="rounded-xl border border-charcoal/20 bg-white px-3 py-1.5 text-xs font-medium text-charcoal hover:bg-charcoal/5 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
