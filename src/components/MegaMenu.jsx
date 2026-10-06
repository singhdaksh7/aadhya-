import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { resolveMediaUrl } from "../lib/api";

export default function MegaMenu({ item, isOpen, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item || !item.children || item.children.length === 0) {
    return null;
  }

  const children = item.children || [];
  const hasSubChildren = children.some((child) => child.children && child.children.length > 0);

  let columns = [];
  if (hasSubChildren) {
    columns = children.map((col) => ({
      title: col.name || col.title || col.label,
      slug: col.slug || col.to,
      items: col.children || [],
    }));
  } else {
    // Chunk items into up to 3 balanced columns
    const numCols = Math.min(3, Math.ceil(children.length / 3) || 1);
    const chunkSize = Math.ceil(children.length / numCols);
    for (let i = 0; i < children.length; i += chunkSize) {
      columns.push({
        title: i === 0 ? (item.name || item.title || item.label) : "Collection Highlights",
        items: children.slice(i, i + chunkSize),
      });
    }
  }

  const promoImage = item.image || item.desktopBanner || item.promoImage;
  const promoTitle = item.promoTitle || item.name || item.title || "Artisan Craftsmanship";
  const promoSubtitle = item.description || item.promoSubtitle || "Handcrafted slow-living objects for modern spaces.";
  const promoLink = item.to || (item.slug ? `/shop/category/${item.slug}` : "/shop");

  return (
    <div
      ref={menuRef}
      role="region"
      aria-label={`${item.name || item.title || item.label} Mega Menu`}
      className="absolute left-0 right-0 top-full z-50 w-full store-bg border-b store-border shadow-xl transition-all duration-200"
    >
      <div className="mx-auto max-w-7xl px-8 py-8">
        <div className="grid grid-cols-12 gap-8 items-start">
          {/* Subcategory Columns */}
          <div className={`${promoImage ? "col-span-8 grid grid-cols-3 gap-6" : "col-span-12 grid grid-cols-3 md:grid-cols-4 gap-6"}`}>
            {columns.map((col, idx) => (
              <div key={idx} className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest store-primary font-serif-display border-b store-border pb-2">
                  {col.slug ? (
                    <Link
                      to={typeof col.slug === "string" && col.slug.startsWith("/") ? col.slug : `/shop/category/${col.slug}`}
                      onClick={onClose}
                      className="hover:underline"
                    >
                      {col.title}
                    </Link>
                  ) : (
                    col.title
                  )}
                </h4>
                <ul className="space-y-2">
                  {col.items.map((sub, sIdx) => {
                    const label = sub.name || sub.title || sub.label;
                    const url = sub.url || (sub.slug ? `/shop/category/${sub.slug}` : sub.to || "#");
                    return (
                      <li key={sub.id || sIdx}>
                        <Link
                          to={url}
                          onClick={onClose}
                          className="text-xs store-text hover:store-primary transition font-medium block py-0.5"
                        >
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Feature Image Card on Right */}
          {promoImage && (
            <div className="col-span-4 pl-6 border-l store-border">
              <Link
                to={promoLink}
                onClick={onClose}
                className="group block overflow-hidden rounded-xl store-surface border store-border p-3.5 transition hover:shadow-md"
              >
                <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-stone-100 mb-3">
                  <img
                    src={resolveMediaUrl(promoImage)}
                    alt={promoTitle}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest store-secondary block">
                  Curated Edit
                </span>
                <h5 className="font-serif-display text-sm font-bold store-text group-hover:store-primary transition mt-0.5">
                  {promoTitle}
                </h5>
                {promoSubtitle && (
                  <p className="text-[11px] store-muted line-clamp-2 mt-1 leading-relaxed">
                    {promoSubtitle}
                  </p>
                )}
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider store-primary group-hover:underline">
                  Shop Now &rarr;
                </span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
