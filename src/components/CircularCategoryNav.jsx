import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { fetchCategories, resolveMediaUrl } from "../lib/api";
import { normalizeHeaderSettings } from "../lib/headerCmsHelpers";

export default function CircularCategoryNav({ categories: initialCategories = [] }) {
  const { header, shipping, general } = useSiteSettings();
  const [categories, setCategories] = useState(initialCategories);
  const scrollRef = useRef(null);

  const cms = normalizeHeaderSettings(header, shipping, general);
  const circularConfig = cms.circularCategories || {};

  useEffect(() => {
    if (initialCategories && initialCategories.length > 0) {
      setCategories(initialCategories);
      return;
    }

    let active = true;
    fetchCategories()
      .then((res) => {
        if (!active) return;
        if (Array.isArray(res.data) && res.data.length > 0) {
          const activeCats = res.data.filter((c) => c.isActive !== false);
          setCategories(activeCats);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [initialCategories]);

  if (cms.enabled === false || circularConfig.enabled === false) return null;

  const scroll = (direction) => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.6;
      scrollRef.current.scrollTo({
        left: direction === "left" ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: "smooth",
      });
    }
  };

  let listToRender = [];
  if (circularConfig.mode === "MANUAL" && Array.isArray(circularConfig.items) && circularConfig.items.length > 0) {
    listToRender = circularConfig.items
      .filter((i) => i.enabled !== false)
      .slice(0, circularConfig.maxItems || 12)
      .map((item, idx) => {
        const catMatch = categories.find((c) => c.id === item.categoryId || c.slug === item.slug);
        return {
          id: item.categoryId || item.slug || `manual-${idx}`,
          name: item.displayLabelOverride || catMatch?.name || item.slug || "Category",
          slug: item.slug || catMatch?.slug || "",
          image: item.imageOverride || catMatch?.image || catMatch?.desktopBanner,
          badge: item.badgeText,
          destination: item.destinationOverride || (catMatch?.slug ? `/shop/category/${catMatch.slug}` : "#"),
        };
      });
  } else {
    listToRender = categories
      .slice(0, circularConfig.maxItems || 12)
      .map((cat) => ({
        id: cat.id || cat.slug,
        name: cat.name,
        slug: cat.slug,
        image: cat.image || cat.desktopBanner,
        badge: null,
        destination: `/shop/category/${cat.slug || ""}`,
      }));
  }

  if (listToRender.length === 0) return null;

  const circleSizeClass =
    circularConfig.desktopSize === "small"
      ? "h-14 w-14 sm:h-16 sm:w-16 lg:h-18 lg:w-18"
      : circularConfig.desktopSize === "large"
      ? "h-20 w-20 sm:h-24 sm:w-24 lg:h-26 lg:w-26"
      : "h-18 w-18 sm:h-20 sm:w-20 lg:h-22 lg:w-22";

  return (
    <div className="store-bg border-b store-border py-4 px-4 sm:px-8 relative group/scroller">
      <div className="mx-auto max-w-7xl relative">
        {/* Desktop Left Scroll Button */}
        {circularConfig.showArrows !== false && (
          <button
            onClick={() => scroll("left")}
            className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full store-surface store-border border shadow-md text-charcoal opacity-0 group-hover/scroller:opacity-100 transition-opacity hover:store-bg-primary hover:text-white cursor-pointer"
            aria-label="Scroll left"
          >
            &larr;
          </button>
        )}

        {/* Categories Scroller Container */}
        <div
          ref={scrollRef}
          className="flex items-start gap-5 sm:gap-7 overflow-x-auto no-scrollbar pb-1 pt-1 scroll-smooth"
        >
          {listToRender.map((cat, idx) => {
            const isFirst = idx === 0;
            const route = cat.destination || `/shop/category/${cat.slug || ""}`;

            return (
              <Link
                key={cat.id || idx}
                to={route}
                className="group flex flex-col items-center shrink-0 w-20 sm:w-24 text-center cursor-pointer"
              >
                {/* Circle Image Container */}
                <div
                  className={`relative ${circleSizeClass} rounded-full p-0.5 border border-charcoal/15 group-hover:border-[var(--theme-primary)] transition-all duration-300 shadow-xs group-hover:shadow-md overflow-hidden store-surface`}
                >
                  {cat.image ? (
                    <img
                      src={resolveMediaUrl(cat.image)}
                      alt={cat.name}
                      loading="lazy"
                      className="h-full w-full rounded-full object-cover transition-transform duration-500 group-hover:scale-108"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full store-surface store-primary font-serif-display font-semibold text-lg sm:text-xl">
                      {cat.name?.charAt(0) || "A"}
                    </div>
                  )}
                  {(cat.badge || isFirst) && (
                    <span className="absolute top-0 right-0 store-bg-primary text-white text-[8px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider shadow-xs">
                      {cat.badge || "NEW"}
                    </span>
                  )}
                </div>

                {/* Category Label */}
                {circularConfig.showLabels !== false && (
                  <span className="mt-2 text-[11px] sm:text-xs font-medium store-text group-hover:store-primary transition-colors line-clamp-2 leading-tight max-w-[90px]">
                    {cat.name}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Desktop Right Scroll Button */}
        {circularConfig.showArrows !== false && (
          <button
            onClick={() => scroll("right")}
            className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full store-surface store-border border shadow-md text-charcoal opacity-0 group-hover/scroller:opacity-100 transition-opacity hover:store-bg-primary hover:text-white cursor-pointer"
            aria-label="Scroll right"
          >
            &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
