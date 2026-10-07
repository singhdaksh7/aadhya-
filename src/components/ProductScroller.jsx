import React, { useRef } from "react";

/** Horizontal scroll-snap product row with prev/next arrows (used when a section enables "Show arrows"). */
export default function ProductScroller({ children }) {
  const ref = useRef(null);
  const slide = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  const btn = "absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border store-border store-surface shadow-md md:flex";
  return (
    <div className="relative" data-testid="product-scroller">
      <button type="button" aria-label="Scroll left" onClick={() => slide(-1)} className={`${btn} -left-3`}>&larr;</button>
      <div ref={ref} className="no-scrollbar flex snap-x gap-4 overflow-x-auto scroll-smooth sm:gap-6">
        {React.Children.map(children, (child) => (
          <div className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23.5%]">{child}</div>
        ))}
      </div>
      <button type="button" aria-label="Scroll right" onClick={() => slide(1)} className={`${btn} -right-3`}>&rarr;</button>
    </div>
  );
}
