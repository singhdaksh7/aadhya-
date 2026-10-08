import React, { useRef } from "react";
import HomepageSectionTitle from "./HomepageSectionTitle";

function Stars({ rating }) {
  const full = Math.round(Number(rating) || 0);
  return (
    <span aria-label={`${rating} out of 5`} className="text-sm store-primary tracking-[0.15em]">
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
    <figure data-testid="review-card" className="flex h-full flex-col rounded-sm border store-border store-bg px-7 py-8 text-center">
      <Stars rating={review.rating} />
      {review.title && <p className="mt-4 font-serif-display text-base font-normal store-text">{review.title}</p>}
      <blockquote className="mt-3 flex-1 font-serif-display text-[15px] font-light italic leading-relaxed store-muted">&ldquo;{review.comment}&rdquo;</blockquote>
      <span aria-hidden="true" className="mx-auto mt-5 block h-px w-8 store-bg-primary opacity-60" />
      <figcaption className="mt-4 flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] store-text">
        {review.customerName}
        {showVerified && review.isVerifiedPurchase && (
          <span className="rounded-full border store-border px-2 py-0.5 text-[9px] tracking-wider store-secondary">Verified</span>
        )}
      </figcaption>
    </figure>
  );
}

// A marquee needs enough distinct cards to fill the viewport; below this it renders a calm static row instead.
export const MARQUEE_MIN_REVIEWS = 3;

/** Homepage reviews section. Motion: STATIC grid, SLIDER (scroll-snap + arrows) or MARQUEE (slow CSS loop). Hidden with no approved reviews. */
export default function ReviewsSection({ section }) {
  const s = section.settings || {};
  const reviews = Array.isArray(section.reviews) ? section.reviews : [];
  const trackRef = useRef(null);
  if (reviews.length === 0) return null; // never render a heading over nothing

  const { averageRating, reviewCount } = resolveReviewSummary(s, section.reviewSummary);
  const requested = ["SLIDER", "MARQUEE"].includes(s.motion) ? s.motion : "STATIC";
  const motion = requested === "MARQUEE" && reviews.length < MARQUEE_MIN_REVIEWS ? "STATIC" : requested;
  const showVerified = s.showVerifiedBadge !== false;
  const slide = (dir) => trackRef.current?.scrollBy({ left: dir * trackRef.current.clientWidth * 0.8, behavior: "smooth" });
  // Repeat the real reviews (never invented ones) until one half of the loop is wide enough to cover large screens.
  const half = Array.from({ length: Math.ceil(6 / reviews.length) * reviews.length }, (_, i) => reviews[i % reviews.length]);
  const duration = Math.min(300, Math.max(30, Number(s.speed) || 90)) * (half.length / 6);

  return (
    <section data-testid="reviews-section" data-motion={motion} className="border-y store-border store-surface py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mb-10 sm:mb-12">
          <HomepageSectionTitle align={s.headingAlign || "CENTER"} eyebrow={s.eyebrow} title={s.title || "What Our Customers Say"} subtitle={s.subtitle} />
          {reviewCount > 0 && (
            <p className={`mt-4 flex items-center gap-2 text-xs store-muted ${s.headingAlign === "LEFT" ? "" : "justify-center"}`} data-testid="reviews-summary">
              <Stars rating={averageRating} /> <span className="font-semibold store-text">{Number(averageRating).toFixed(1)}</span> &middot; {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
            </p>
          )}
        </div>

        {motion === "STATIC" && (
          <div className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${reviews.length < 3 ? "mx-auto max-w-4xl" : ""}`}>
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
            <div className="mt-6 flex justify-center gap-2">
              <button type="button" aria-label="Previous reviews" onClick={() => slide(-1)} className="h-9 w-9 rounded-full border store-border store-bg">&larr;</button>
              <button type="button" aria-label="Next reviews" onClick={() => slide(1)} className="h-9 w-9 rounded-full border store-border store-bg">&rarr;</button>
            </div>
          </div>
        )}
      </div>

      {motion === "MARQUEE" && (
        <div className="no-scrollbar overflow-hidden motion-reduce:overflow-x-auto" style={{ maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
          <div className={`reviews-marquee-track flex w-max gap-5 px-2.5 ${s.pauseOnHover !== false ? "" : "hover:![animation-play-state:running]"}`} data-testid="reviews-marquee" style={{ "--reviews-duration": `${duration}s` }}>
            {[...half, ...half].map((r, i) => (
              <div key={`${r.id}-${i}`} aria-hidden={i >= half.length} className="w-[290px] shrink-0 sm:w-[340px]">
                <ReviewCard review={r} showVerified={showVerified} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
