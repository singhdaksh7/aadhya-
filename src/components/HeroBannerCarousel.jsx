import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { fetchBanners } from "../lib/api";

const DEFAULT_BANNERS = [
  {
    id: "hero-1",
    desktopImage: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1800&auto=format&fit=crop",
    mobileImage: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=800&auto=format&fit=crop",
    eyebrow: "Aadya Home & Lifestyle",
    headline: "Decor that",
    highlightText: "Feels Like Home",
    description: "Discover handcrafted oil lamps, unglazed clay vessels, linen textiles, and slow design objects created for peaceful sanctuaries.",
    primaryCtaLabel: "Shop Home Decor",
    primaryCtaUrl: "/shop",
    secondaryCtaLabel: "Explore Collections",
    secondaryCtaUrl: "/collections",
    textPosition: "LEFT",
    textTheme: "DARK",
    active: true
  },
  {
    id: "hero-2",
    desktopImage: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=1800&auto=format&fit=crop",
    mobileImage: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=800&auto=format&fit=crop",
    eyebrow: "Artisan Heritage",
    headline: "Slow Living",
    highlightText: "Sacred Proportions",
    description: "Every piece carries centuries of craftsmanship from India's celebrated artisan clusters, bringing warmth to modern spaces.",
    primaryCtaLabel: "View New Drops",
    primaryCtaUrl: "/new-arrivals",
    secondaryCtaLabel: "Our Craft Story",
    secondaryCtaUrl: "/about",
    textPosition: "LEFT",
    textTheme: "DARK",
    active: true
  }
];

export default function HeroBannerCarousel({ bannersOverride }) {
  const { heroBanners: settingsBanners } = useSiteSettings();
  const [fetchedBanners, setFetchedBanners] = useState([]);
  
  useEffect(() => {
    let active = true;
    fetchBanners("HOME_HERO")
      .then((res) => {
        if (active && res.data?.length > 0) {
          setFetchedBanners(res.data);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const rawBanners = bannersOverride || (fetchedBanners.length > 0 ? fetchedBanners : settingsBanners) || DEFAULT_BANNERS;
  const banners = Array.isArray(rawBanners) && rawBanners.length > 0 ? rawBanners.filter(b => b.isActive !== false && b.active !== false) : DEFAULT_BANNERS;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (banners.length <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 6000);

    return () => clearInterval(timerRef.current);
  }, [banners.length, isPaused]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  const currentBanner = banners[currentIndex] || DEFAULT_BANNERS[0];

  return (
    <section
      className="relative w-full bg-[#FAF6F0] overflow-hidden group border-b border-charcoal/10"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Hero Banner Carousel"
    >
      {/* Full-width container edge-to-edge */}
      <div className="relative w-full h-[clamp(480px,70vh,600px)] sm:h-[clamp(620px,75vh,850px)] overflow-hidden">
        {/* Background Images */}
        {banners.map((banner, index) => {
          const isActive = index === currentIndex;
          return (
            <div
              key={banner.id || index}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              {/* Desktop & Mobile Responsive Full Bleed Images */}
              <picture className="h-full w-full">
                <source media="(max-width: 639px)" srcSet={banner.mobileImage || banner.desktopImage} />
                <img
                  src={banner.desktopImage}
                  alt={banner.headline || "Aadya Storefront Banner"}
                  className="h-full w-full object-cover object-center"
                />
              </picture>
              {/* Directional Gradient Overlay for readability */}
              <div
                className={`absolute inset-0 ${
                  banner.textPosition === "RIGHT"
                    ? "bg-gradient-to-l from-white/95 via-white/70 to-transparent sm:from-white/90 sm:via-white/50"
                    : banner.textPosition === "CENTER"
                    ? "bg-gradient-to-t from-white/95 via-white/60 to-transparent sm:from-white/90 sm:via-white/40"
                    : "bg-gradient-to-r from-white/95 via-white/75 to-transparent sm:from-white/90 sm:via-white/50"
                }`}
              />
            </div>
          );
        })}

        {/* Safe Inner Container for Hero Text Overlay Content */}
        <div className="relative z-20 h-full w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 flex items-center">
          <div
            className={`max-w-xl space-y-4 sm:space-y-6 ${
              currentBanner.textPosition === "RIGHT"
                ? "ml-auto text-right"
                : currentBanner.textPosition === "CENTER"
                ? "mx-auto text-center"
                : "mr-auto text-left"
            }`}
          >
            {currentBanner.eyebrow && (
              <span className="inline-block rounded-full bg-white/90 backdrop-blur border border-charcoal/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-terracotta shadow-xs">
                {currentBanner.eyebrow}
              </span>
            )}

            <h1 className="font-serif-display text-3xl sm:text-5xl lg:text-6xl text-charcoal leading-[1.1] tracking-tight font-bold">
              {currentBanner.headline}{" "}
              {currentBanner.highlightText && (
                <span className="block italic font-serif text-terracotta mt-1">
                  {currentBanner.highlightText}
                </span>
              )}
            </h1>

            {currentBanner.description && (
              <p className="text-sm sm:text-base text-charcoal-soft leading-relaxed max-w-md">
                {currentBanner.description}
              </p>
            )}

            <div
              className={`flex flex-wrap items-center gap-3 sm:gap-4 pt-2 ${
                currentBanner.textPosition === "CENTER" ? "justify-center" : ""
              }`}
            >
              {currentBanner.primaryCtaLabel && (
                <Link
                  to={currentBanner.primaryCtaUrl || "/shop"}
                  className="rounded-full bg-terracotta px-7 py-3 text-xs sm:text-sm font-semibold uppercase tracking-wider text-white transition hover:bg-terracotta-dark shadow-md"
                >
                  {currentBanner.primaryCtaLabel}
                </Link>
              )}
              {currentBanner.secondaryCtaLabel && (
                <Link
                  to={currentBanner.secondaryCtaUrl || "/collections"}
                  className="rounded-full border border-charcoal/20 bg-white/90 backdrop-blur px-7 py-3 text-xs sm:text-sm font-semibold uppercase tracking-wider text-charcoal transition hover:border-terracotta hover:text-terracotta"
                >
                  {currentBanner.secondaryCtaLabel}
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Edge Carousel Arrows (20-40px from screen edges) */}
        {banners.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-4 sm:left-8 lg:left-10 top-1/2 -translate-y-1/2 z-30 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/85 backdrop-blur text-charcoal shadow-md border border-charcoal/10 transition hover:bg-white hover:scale-105 focus:outline-none focus:ring-2 focus:ring-terracotta cursor-pointer"
              aria-label="Previous Banner"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 sm:right-8 lg:right-10 top-1/2 -translate-y-1/2 z-30 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white/85 backdrop-blur text-charcoal shadow-md border border-charcoal/10 transition hover:bg-white hover:scale-105 focus:outline-none focus:ring-2 focus:ring-terracotta cursor-pointer"
              aria-label="Next Banner"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Slide Pagination Dots */}
        {banners.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentIndex ? "w-8 bg-terracotta" : "w-2.5 bg-charcoal/30 hover:bg-charcoal/60"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

