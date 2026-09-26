import React from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { formatInr } from "../lib/format";

export default function TopUtilityBar() {
  const { header, freeShippingThreshold, shipping } = useSiteSettings();
  const threshold = shipping?.freeShippingThreshold ?? freeShippingThreshold ?? 2499;

  if (header?.showUtilityBar === false) return null;

  const defaultItems = [
    { id: "ub-1", enabled: true, title: `Free Shipping on Orders > ${formatInr(threshold)}`, link: "/shipping" },
    { id: "ub-2", enabled: true, title: "Easy 7-Day Returns", link: "/returns" },
    { id: "ub-3", enabled: true, title: "100% Secure Checkout", link: "/faq" },
  ];

  const items = (header?.utilityBarItems?.length ? header.utilityBarItems : defaultItems).filter((i) => i.enabled !== false);

  return (
    <div className="bg-[#FAF6F0] border-b border-charcoal/10 text-charcoal text-[11px] sm:text-xs py-2 px-4 sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Left / Center items */}
        <div className="flex items-center gap-4 sm:gap-8 overflow-x-auto no-scrollbar">
          {items.map((item) => (
            <div key={item.id || item.title} className="flex items-center gap-1.5 shrink-0">
              <svg className="h-3.5 w-3.5 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              {item.link ? (
                <Link to={item.link} className="font-medium text-charcoal/90 hover:text-terracotta transition">
                  {item.title}
                </Link>
              ) : (
                <span className="font-medium text-charcoal/90">{item.title}</span>
              )}
            </div>
          ))}
        </div>

        {/* Right side links */}
        <div className="flex items-center gap-4 shrink-0 text-charcoal-soft">
          <Link to="/track-order" className="hover:text-terracotta transition font-medium">
            Track Order
          </Link>
          <span className="text-charcoal/20">|</span>
          <Link to="/faq" className="hover:text-terracotta transition font-medium">
            Help &amp; FAQ
          </Link>
        </div>
      </div>
    </div>
  );
}

