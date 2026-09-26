import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { fetchProductReviews, submitProductReview, fetchCustomerReviews, updateCustomerReview } from "../lib/api";

function StarDisplay({ rating, interactive = false, onSelect = () => {}, size = "sm" }) {
  const [hoverRating, setHoverRating] = useState(0);
  const sizeClasses = size === "lg" ? "text-2xl gap-1.5" : "text-sm gap-1";

  return (
    <div className={`flex items-center text-amber-500 ${sizeClasses}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = interactive ? star <= (hoverRating || rating) : star <= rating;
        return (
          <button
            key={star}
            type={interactive ? "button" : undefined}
            disabled={!interactive}
            onClick={() => interactive && onSelect(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            className={`${interactive ? "cursor-pointer transition-transform hover:scale-110" : "cursor-default"}`}
          >
            <span className={active ? "text-amber-500" : "text-charcoal/20"}>★</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ProductReviews({ productId }) {
  const { user, status } = useCustomerAuth();
  const [reviews, setReviews] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 1 });
  const [summary, setSummary] = useState({ averageRating: 0, reviewCount: 0, ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("newest");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Customer's existing review state (if logged in)
  const [myReview, setMyReview] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formRating, setFormRating] = useState(5);
  const [formTitle, setFormTitle] = useState("");
  const [formComment, setFormComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const loadPublicReviews = useCallback(
    async (page = 1) => {
      if (!productId) return;
      setLoading(true);
      try {
        const res = await fetchProductReviews(productId, { page, sortBy, verifiedOnly });
        setReviews(res.data || []);
        setMeta(res.meta || { page: 1, limit: 10, totalItems: 0, totalPages: 1 });
        setSummary(res.meta?.summary || { averageRating: 0, reviewCount: 0, ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
      } catch (err) {
        console.error("Failed to load product reviews:", err);
      } finally {
        setLoading(false);
      }
    },
    [productId, sortBy, verifiedOnly]
  );

  const loadMyReview = useCallback(async () => {
    if (status !== "authenticated" || !productId) {
      setMyReview(null);
      return;
    }
    try {
      const res = await fetchCustomerReviews();
      const existing = (res.data || []).find((r) => r.productId === productId);
      if (existing) {
        setMyReview(existing);
        setFormRating(existing.rating);
        setFormTitle(existing.title || "");
        setFormComment(existing.comment);
      } else {
        setMyReview(null);
      }
    } catch (err) {
      console.error("Failed to fetch customer review:", err);
    }
  }, [status, productId]);

  useEffect(() => {
    loadPublicReviews(1);
    loadMyReview();
  }, [loadPublicReviews, loadMyReview]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!formComment || formComment.trim().length < 3) {
      setFormError("Please enter a review comment (at least 3 characters).");
      return;
    }

    setSubmitting(true);
    try {
      if (myReview) {
        await updateCustomerReview(myReview.id, {
          rating: formRating,
          title: formTitle.trim(),
          comment: formComment.trim(),
        });
        setFormSuccess("Your review has been updated and submitted for administrator review.");
        setIsEditing(false);
      } else {
        await submitProductReview({
          productId,
          rating: formRating,
          title: formTitle.trim(),
          comment: formComment.trim(),
        });
        setFormSuccess("Thank you! Your review has been submitted for administrator approval.");
      }
      await loadMyReview();
      await loadPublicReviews(1);
    } catch (err) {
      setFormError(err.message || "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  const totalBreakdown = summary.reviewCount || 1;

  return (
    <section className="border-t border-charcoal/10 pt-12 mt-12 space-y-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Customer Reviews</span>
          <h2 className="font-serif-display text-2xl sm:text-3xl text-charcoal mt-1">Ratings & Reviews</h2>
        </div>

        {/* Average Rating Banner */}
        <div className="flex items-center gap-4 bg-ivory/80 p-4 rounded-2xl border border-charcoal/10 shadow-sm">
          <div className="text-center">
            <span className="font-serif-display text-4xl font-bold text-charcoal">
              {summary.averageRating > 0 ? summary.averageRating.toFixed(1) : "0.0"}
            </span>
            <span className="text-xs text-charcoal-soft block mt-0.5">out of 5</span>
          </div>
          <div className="border-l border-charcoal/15 pl-4">
            <StarDisplay rating={Math.round(summary.averageRating)} size="lg" />
            <p className="text-xs text-charcoal-soft mt-1">
              Based on {summary.reviewCount} {summary.reviewCount === 1 ? "approved review" : "approved reviews"}
            </p>
          </div>
        </div>
      </div>

      {/* Rating Breakdown Bars & Write Review CTA */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Breakdown Bars */}
        <div className="md:col-span-6 bg-white p-6 rounded-2xl border border-charcoal/10 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal mb-4">Rating Breakdown</h3>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.ratingBreakdown?.[star] || 0;
            const percentage = summary.reviewCount > 0 ? Math.round((count / totalBreakdown) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-3 text-xs">
                <span className="w-12 font-medium text-charcoal">{star} Stars</span>
                <div className="flex-1 h-2.5 bg-charcoal/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                </div>
                <span className="w-10 text-right text-charcoal-soft">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Customer Review Action Card */}
        <div className="md:col-span-6 bg-ivory/50 p-6 rounded-2xl border border-charcoal/10 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-charcoal">Share Your Experience</h3>
            <p className="text-xs text-charcoal-soft mt-2 leading-relaxed">
              Have you purchased or used this product? Let fellow readers and collectors know your thoughts on quality and craftsmanship.
            </p>
          </div>

          <div className="mt-6">
            {status !== "authenticated" ? (
              <div className="rounded-xl border border-charcoal/15 bg-white p-4 text-center space-y-2">
                <p className="text-xs text-charcoal font-medium">Please sign in to write a product review.</p>
                <Link
                  to="/login"
                  className="inline-block rounded-xl bg-terracotta px-5 py-2 text-xs font-semibold text-white hover:bg-terracotta-dark transition shadow-sm"
                >
                  Sign In to Review
                </Link>
              </div>
            ) : myReview && !isEditing ? (
              <div className="rounded-xl border border-charcoal/15 bg-white p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-charcoal">Your Submitted Review</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      myReview.status === "APPROVED"
                        ? "bg-emerald-100 text-emerald-800"
                        : myReview.status === "REJECTED"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {myReview.status === "APPROVED"
                      ? "Published"
                      : myReview.status === "REJECTED"
                      ? "Rejected"
                      : "Pending Review"}
                  </span>
                </div>
                <StarDisplay rating={myReview.rating} />
                {myReview.title && <p className="text-xs font-semibold text-charcoal">{myReview.title}</p>}
                <p className="text-xs text-charcoal-soft line-clamp-2">{myReview.comment}</p>
                <button
                  onClick={() => setIsEditing(true)}
                  className="mt-2 text-xs font-semibold text-terracotta hover:underline"
                >
                  Edit Review
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full rounded-xl bg-charcoal px-5 py-2.5 text-xs font-semibold text-white hover:bg-charcoal-dark transition shadow-sm"
              >
                {myReview ? "Edit Your Review" : "Write a Review"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Review Submission Form Modal / Drawer */}
      {isEditing && (
        <form onSubmit={handleSubmitReview} className="bg-white p-6 rounded-2xl border border-charcoal/15 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-charcoal/10 pb-3">
            <h3 className="font-serif-display text-lg text-charcoal">
              {myReview ? "Edit Product Review" : "Write a Review"}
            </h3>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-xs text-charcoal-soft hover:text-charcoal"
            >
              Cancel
            </button>
          </div>

          {formError && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 font-medium">{formError}</div>}
          {formSuccess && <div className="rounded-xl bg-green-50 p-3 text-xs text-green-700 font-medium">{formSuccess}</div>}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal block">Rating</label>
            <StarDisplay rating={formRating} interactive onSelect={(r) => setFormRating(r)} size="lg" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal block">Review Title (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Beautiful slow craftsmanship"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full rounded-xl border border-charcoal/20 bg-ivory/50 px-3 py-2 text-xs text-charcoal focus:border-terracotta focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-charcoal block">Review Comment</label>
            <textarea
              rows={4}
              placeholder="Share details about the quality, packaging, texture, or reading experience..."
              value={formComment}
              onChange={(e) => setFormComment(e.target.value)}
              className="w-full rounded-xl border border-charcoal/20 bg-ivory/50 px-3 py-2 text-xs text-charcoal focus:border-terracotta focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-xl border border-charcoal/20 px-4 py-2 text-xs font-medium text-charcoal hover:bg-charcoal/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-terracotta px-6 py-2 text-xs font-semibold text-white hover:bg-terracotta-dark transition shadow-sm disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </form>
      )}

      {/* Public Reviews List */}
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-charcoal/10 pb-4">
          <h3 className="font-serif-display text-lg text-charcoal">Approved Reviews</h3>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-charcoal cursor-pointer">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="rounded border-charcoal/30 text-terracotta focus:ring-terracotta"
              />
              Verified Buyers Only
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-charcoal/20 bg-white px-3 py-1.5 text-xs text-charcoal focus:border-terracotta focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="highest">Highest Rating</option>
              <option value="lowest">Lowest Rating</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-charcoal-soft">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="py-8 text-center text-xs text-charcoal-soft bg-ivory/30 rounded-2xl border border-charcoal/10">
            No public reviews available yet. Be the first to review this product!
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="bg-white p-5 rounded-2xl border border-charcoal/10 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-xs text-charcoal">{r.customerName || r.customer?.name || "Customer"}</span>
                    {r.isVerifiedPurchase && (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                        ✓ Verified Buyer
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-charcoal-soft">
                    {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>

                <StarDisplay rating={r.rating} />

                {r.title && <h4 className="font-semibold text-xs text-charcoal pt-1">{r.title}</h4>}

                <p className="text-xs text-charcoal-soft leading-relaxed whitespace-pre-line">{r.comment}</p>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <span className="text-xs text-charcoal-soft">
              Page {meta.page} of {meta.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={meta.page <= 1}
                onClick={() => loadPublicReviews(meta.page - 1)}
                className="rounded-xl border border-charcoal/20 px-3 py-1.5 text-xs text-charcoal hover:bg-charcoal/5 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={meta.page >= meta.totalPages}
                onClick={() => loadPublicReviews(meta.page + 1)}
                className="rounded-xl border border-charcoal/20 px-3 py-1.5 text-xs text-charcoal hover:bg-charcoal/5 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
