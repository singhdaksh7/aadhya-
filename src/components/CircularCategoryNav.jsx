import React from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "../hooks/useSiteSettings";

export default function CircularCategoryNav({ categories = [] }) {
  const { header } = useSiteSettings();

  if (header?.showCategoryCircles === false) return null;
  if (!categories || categories.length === 0) return null;

  return (
    <div className="bg-white border-b border-charcoal/10 py-5 px-4 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-6 sm:gap-8 overflow-x-auto no-scrollbar pb-2 pt-1 scroll-smooth">
          {categories.map((cat) => (
            <Link
              key={cat.id || cat.slug}
              to={`/shop/category/${cat.slug}`}
              className="group flex flex-col items-center shrink-0 w-20 sm:w-24 text-center cursor-pointer"
            >
              {/* Circle Image Wrapper */}
              <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full p-0.5 border border-terracotta/30 group-hover:border-terracotta transition-all duration-300 shadow-sm group-hover:shadow-md overflow-hidden bg-[#FAF6F0]">
                {cat.image ? (
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="h-full w-full rounded-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-[#FAF6F0] text-terracotta font-serif-display font-semibold text-lg sm:text-xl">
                    {cat.name?.charAt(0) || "A"}
                  </div>
                )}
              </div>

              {/* Label */}
              <span className="mt-2 text-[11px] sm:text-xs font-semibold text-charcoal/90 group-hover:text-terracotta transition-colors line-clamp-1 leading-snug">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
