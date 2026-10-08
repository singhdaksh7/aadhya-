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
    textTheme: "LIGHT",
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
    textTheme: "LIGHT",
    active: true
  }
];

// Script faces read badly in ALL CAPS, so an admin-entered shouty eyebrow is title-cased.
export const scriptCase = (text) => (typeof text === "string" && text.length > 3 && text === text.toUpperCase()
  ? text.toLowerCase().replace(/(^|\s)(\S)/g, (_, space, ch) => space + ch.toUpperCase())
  : text);

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
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

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
  const position = ["LEFT", "CENTER", "RIGHT"].includes(currentBanner.textPosition) ? currentBanner.textPosition : "LEFT";
  const blockClass = position === "RIGHT" ? "ml-auto items-end text-right" : position === "CENTER" ? "mx-auto items-center text-center" : "mr-auto items-start text-left";
  // Image-first: the copy always sits ON the image in light type over a dark gradient (never a white wash).
  const overlayClass = position === "RIGHT"
    ? "bg-gradient-to-l from-charcoal/70 via-charcoal/35 to-charcoal/5"
    : position === "CENTER"
    ? "bg-gradient-to-t from-charcoal/70 via-charcoal/40 to-charcoal/20"
    : "bg-gradient-to-r from-charcoal/70 via-charcoal/35 to-charcoal/5";

  return (
    <section
      data-testid="hero-carousel"
      className="relative w-full store-surface overflow-hidden group border-b store-border"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Hero Banner Carousel"
    >
      <div className="relative w-full h-[clamp(500px,72vh,620px)] sm:h-[clamp(560px,74vh,780px)] overflow-hidden">
        {banners.map((banner, index) => {
          const isActive = index === currentIndex;
          return (
            <div
              key={banner.id || index}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              <picture className="h-full w-full">
                <source media="(max-width: 639px)" srcSet={banner.mobileImage || banner.desktopImage} />
                <img
                  src={banner.desktopImage}
                  alt={banner.headline || banner.title || "Aadya Storefront Banner"}
                  className="h-full w-full object-cover object-center"
                />
              </picture>
              <div data-testid="hero-overlay" className={`absolute inset-0 ${overlayClass}`} />
            </div>
          );
        })}

        <div className="relative z-20 h-full w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 flex items-center pb-8 sm:pb-0">
          <div key={currentBanner.id || currentIndex} data-testid="hero-copy" data-position={position} className={`hero-rise flex max-w-[34rem] flex-col text-white ${blockClass}`}>
            {currentBanner.eyebrow && (
              <span data-testid="hero-eyebrow" className="font-script text-3xl leading-none text-white/95 sm:text-4xl lg:text-5xl">
                {scriptCase(currentBanner.eyebrow)}
              </span>
            )}

            <h1 className="mt-3 font-serif-display text-[2rem] font-light leading-[1.08] tracking-[-0.01em] text-balance sm:mt-4 sm:text-5xl lg:text-[3.5rem]">
              {currentBanner.headline || currentBanner.title}
              {currentBanner.highlightText && (
                <span className="block italic font-light text-white/95 mt-1">
                  {currentBanner.highlightText}
                </span>
              )}
            </h1>

            {(currentBanner.description || currentBanner.subtitle) && (
              <p className="mt-4 max-w-md text-sm font-light leading-[1.7] text-white/85 sm:mt-5 sm:text-[15px]">
                {currentBanner.description || currentBanner.subtitle}
              </p>
            )}

            <div className={`mt-7 flex flex-wrap items-center gap-3 sm:mt-9 sm:gap-4 ${position === "CENTER" ? "justify-center" : position === "RIGHT" ? "justify-end" : ""}`}>
              {currentBanner.primaryCtaLabel && (
                <Link
                  to={currentBanner.primaryCtaUrl || "/shop"}
                  data-testid="hero-cta-primary"
                  className="border border-transparent store-bg-primary px-7 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-white transition store-primary-hover sm:px-9 sm:py-3.5"
                >
                  {currentBanner.primaryCtaLabel}
                </Link>
              )}
              {currentBanner.secondaryCtaLabel && (
                <Link
                  to={currentBanner.secondaryCtaUrl || "/collections"}
                  data-testid="hero-cta-secondary"
                  className="border border-white/80 bg-transparent px-7 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-white transition hover:bg-white hover:text-charcoal sm:px-9 sm:py-3.5"
                >
                  {currentBanner.secondaryCtaLabel}
                </Link>
              )}
            </div>
          </div>
        </div>

        {banners.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-3 sm:left-8 lg:left-10 top-1/2 -translate-y-1/2 z-30 hidden h-11 w-11 items-center justify-center rounded-full border border-white/50 text-white backdrop-blur-sm transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:flex cursor-pointer"
              aria-label="Previous Banner"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              className="absolute right-3 sm:right-8 lg:right-10 top-1/2 -translate-y-1/2 z-30 hidden h-11 w-11 items-center justify-center rounded-full border border-white/50 text-white backdrop-blur-sm transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:flex cursor-pointer"
              aria-label="Next Banner"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {banners.length > 1 && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-500 cursor-pointer ${
                  idx === currentIndex ? "w-8 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
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
