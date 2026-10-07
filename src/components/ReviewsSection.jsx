import React, { useRef } from "react";
import HomepageSectionTitle from "./HomepageSectionTitle";

function Stars({ rating }) {
  const full = Math.round(Number(rating) || 0);
  return (
    <span aria-label={`${rating} out of 5`} className="store-primary tracking-tight">
      {"★".repeat(full)}
      <span className="opacity-25">{"★".repeat(Math.max(0, 5 - full))}</span>
    </span>
  );
}

// Admin overrides win; otherwise show the real approved-review aggregate.
export function resolveReviewSummary(settings = {}, summary = {}) {
  return {
    averageRating: settings.averageRating ?? summary.averageRating ?? 0,
    reviewCount: settings.reviewCount ?? summary.reviewCount ?? 0,
  };
}

function ReviewCard({ review, showVerified }) {
  return (
    <figure data-testid="review-card" className="flex h-full flex-col rounded-2xl border store-border store-surface p-6">
      <Stars rating={review.rating} />
      {review.title && <p className="mt-2 text-sm font-semibold store-text">{review.title}</p>}
      <blockquote className="mt-2 flex-1 text-sm leading-relaxed store-muted">“{review.comment}”</blockquote>
      <figcaption className="mt-4 flex items-center gap-2 text-xs font-semibold store-text">
        {review.customerName}
        {showVerified && review.isVerifiedPurchase && (
          <span className="rounded-full border store-border px-2 py-0.5 text-[10px] uppercase tracking-wider store-secondary">Verified</span>
        )}
      </figcaption>
    </figure>
  );
}

/** Homepage reviews section. Motion: STATIC grid, SLIDER (scroll-snap + arrows) or MARQUEE (CSS loop). */
export default function ReviewsSection({ section }) {
  const s = section.settings || {};
  const reviews = Array.isArray(section.reviews) ? section.reviews : [];
  const trackRef = useRef(null);
  if (reviews.length === 0) return null; // never render a heading over nothing

  const { averageRating, reviewCount } = resolveReviewSummary(s, section.reviewSummary);
  const motion = ["SLIDER", "MARQUEE"].includes(s.motion) ? s.motion : "STATIC";
  const showVerified = s.showVerifiedBadge !== false;
  const slide = (dir) => trackRef.current?.scrollBy({ left: dir * trackRef.current.clientWidth * 0.8, behavior: "smooth" });
  const pause = s.pauseOnHover !== false ? "hover:[animation-play-state:paused]" : "";

  return (
    <section data-testid="reviews-section" data-motion={motion} className="mx-auto max-w-7xl px-4 sm:px-8">
      <div className="mb-10 sm:mb-12">
        <HomepageSectionTitle align={s.headingAlign || "CENTER"} eyebrow={s.eyebrow} title={s.title || "What Our Customers Say"} subtitle={s.subtitle} />
        {reviewCount > 0 && (
          <p className={`mt-3 flex items-center gap-2 text-sm store-muted ${s.headingAlign === "LEFT" ? "" : "justify-center"}`} data-testid="reviews-summary">
            <Stars rating={averageRating} /> <span className="font-semibold store-text">{Number(averageRating).toFixed(1)}</span> · {reviewCount} reviews
          </p>
        )}
      </div>

      {motion === "STATIC" && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => <ReviewCard key={r.id} review={r} showVerified={showVerified} />)}
        </div>
      )}

      {motion === "SLIDER" && (
        <div className="relative">
          <div ref={trackRef} className="no-scrollbar flex snap-x gap-5 overflow-x-auto scroll-smooth">
            {reviews.map((r) => (
              <div key={r.id} className="w-[85%] shrink-0 snap-start sm:w-[45%] lg:w-[31%]">
                <ReviewCard review={r} showVerified={showVerified} />
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" aria-label="Previous reviews" onClick={() => slide(-1)} className="h-9 w-9 rounded-full border store-border store-surface">&larr;</button>
            <button type="button" aria-label="Next reviews" onClick={() => slide(1)} className="h-9 w-9 rounded-full border store-border store-surface">&rarr;</button>
          </div>
        </div>
      )}

      {motion === "MARQUEE" && (
        <div className="overflow-hidden" style={{ maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)" }}>
          <div className={`flex w-max gap-5 ${pause}`} data-testid="reviews-marquee" style={{ animation: `aadya-reviews-marquee ${s.speed || 60}s linear infinite` }}>
            {[...reviews, ...reviews].map((r, i) => (
              <div key={`${r.id}-${i}`} aria-hidden={i >= reviews.length} className="w-[300px] shrink-0">
                <ReviewCard review={r} showVerified={showVerified} />
              </div>
            ))}
          </div>
          <style>{`@keyframes aadya-reviews-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}@media (prefers-reduced-motion: reduce){[data-motion="MARQUEE"] [data-testid="reviews-marquee"]{animation:none!important}}`}</style>
        </div>
      )}
    </section>
  );
}
