import React from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { formatInr } from "../lib/format";

export default function TopUtilityBar() {
  const { header, freeShippingThreshold, shipping, promoStrip } = useSiteSettings();
  const threshold = shipping?.freeShippingThreshold ?? freeShippingThreshold ?? 2499;

  if (header?.showUtilityBar === false) return null;

  const defaultLeftItems = [
    { id: "ub-1", title: `Free Shipping ${formatInr(threshold)}+`, link: "/shipping", icon: "truck" },
    { id: "ub-2", title: "Easy 7-Day Returns", link: "/returns", icon: "returns" },
    { id: "ub-3", title: "100% Secure Checkout", link: "/faq", icon: "shield" },
  ];

  const centerText = header?.utilityBarCenterText || promoStrip?.description || "Get ₹500 off on your first purchase above ₹2,999";

  return (
    <div className="bg-[#1C1917] border-b border-white/10 text-stone-300 text-[11px] sm:text-xs py-1.5 px-4 sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* Left items */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          {defaultLeftItems.map((item) => (
            <div key={item.id} className="flex items-center gap-1.5 shrink-0">
              {item.icon === "truck" && (
                <svg className="h-3.5 w-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              )}
              {item.icon === "returns" && (
                <svg className="h-3.5 w-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {item.icon === "shield" && (
                <svg className="h-3.5 w-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              )}
              {item.link ? (
                <Link to={item.link} className="font-medium hover:text-white transition">
                  {item.title}
                </Link>
              ) : (
                <span className="font-medium text-stone-300">{item.title}</span>
              )}
            </div>
          ))}
        </div>

        {/* Center item (desktop) */}
        <div className="hidden lg:flex items-center justify-center text-center font-medium text-amber-200/90 text-xs truncate max-w-md">
          <span>{centerText}</span>
        </div>

        {/* Right side links */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-stone-400">
          <Link to="/track-order" className="hover:text-white transition font-medium">
            Track Order
          </Link>
          <span className="text-stone-600">|</span>
          <Link to="/faq" className="hover:text-white transition font-medium">
            Help &amp; FAQ
          </Link>
        </div>
      </div>
    </div>
  );
}


