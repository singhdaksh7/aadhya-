import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatInr } from "../../lib/format";
import { getRecentlyViewed } from "../../lib/analytics";

// Recently-viewed products, tracked client-side only (localStorage) for
// both guests and logged-in customers — see src/lib/analytics.js. No
// server-side storage: this is deliberately simple per Phase I scope.
export default function RecentlyViewed({ excludeSlug, title = "Recently Viewed" }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    setItems(getRecentlyViewed(excludeSlug));
  }, [excludeSlug]);

  if (items.length === 0) return null;

  return (
    <div className="mt-12">
      <h3 className="mb-4 font-serif-display text-xl store-text">{title}</h3>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.map((p) => (
          <Link
            key={p.slug}
            to={`/products/${p.slug}`}
            className="min-w-[140px] flex-shrink-0 rounded-xl border border-[var(--theme-border)] store-surface p-3 hover:border-[var(--theme-primary)]/40"
          >
            {p.image && <img src={p.image} alt={p.name} className="mb-2 h-24 w-full rounded-lg object-cover" />}
            <p className="truncate text-xs font-medium store-text">{p.name}</p>
            <p className="text-xs store-primary">{formatInr(p.salePrice || p.price)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
