import React from "react";
import { Link } from "react-router-dom";

export default function PromoBanners2Up() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="relative rounded-3xl overflow-hidden bg-ivory border border-charcoal/10 p-8 sm:p-10 flex flex-col justify-between space-y-6 shadow-xs group">
          <div className="space-y-2 z-10">
            <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">Artisan Curations</span>
            <h3 className="font-serif-display text-2xl sm:text-3xl text-charcoal font-bold">Terracotta &amp; Minerals</h3>
            <p className="text-xs sm:text-sm text-charcoal-soft">Earth-born vessels, hand-pressed urns and raw clay decor accents.</p>
          </div>
          <div>
            <Link
              to="/collections/earth-collection"
              className="inline-block rounded-xl bg-terracotta px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-terracotta/90 transition"
            >
              Shop Clay Collection →
            </Link>
          </div>
        </div>

        <div className="relative rounded-3xl overflow-hidden bg-sage-light border border-sage/20 p-8 sm:p-10 flex flex-col justify-between space-y-6 shadow-xs group">
          <div className="space-y-2 z-10">
            <span className="text-xs font-semibold uppercase tracking-widest text-green-deep">Mindful Spaces</span>
            <h3 className="font-serif-display text-2xl sm:text-3xl text-green-deep font-bold">Brass &amp; Slow Lighting</h3>
            <p className="text-xs sm:text-sm text-green-deep/80">Hand-chased oil lamps, brass sconces and warm ambient accents.</p>
          </div>
          <div>
            <Link
              to="/collections/brass-lighting"
              className="inline-block rounded-xl bg-green-deep px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-green-deep/90 transition"
            >
              Explore Brass Lighting →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
