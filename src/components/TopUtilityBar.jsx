import React from "react";
import { Link } from "react-router-dom";

export default function TopUtilityBar() {
  return (
    <div className="bg-[#FAF6F0] border-b border-charcoal/10 text-charcoal text-[11px] sm:text-xs py-2 px-4 sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Left / Center items */}
        <div className="flex items-center gap-4 sm:gap-8 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            <svg className="h-3.5 w-3.5 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span className="font-medium text-charcoal/90">Free Shipping on Orders &gt; ₹2,499</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <svg className="h-3.5 w-3.5 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="font-medium text-charcoal/80">Easy 7-Day Returns</span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            <svg className="h-3.5 w-3.5 text-terracotta" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="font-medium text-charcoal/80">100% Secure Checkout</span>
          </div>
        </div>

        {/* Right side links */}
        <div className="flex items-center gap-4 shrink-0 text-charcoal-soft">
          <Link to="/track-order" className="hover:text-terracotta transition font-medium">
            Track Order
          </Link>
          <span className="text-charcoal/20">|</span>
          <Link to="/faq" className="hover:text-terracotta transition font-medium">
            Help & FAQ
          </Link>
        </div>
      </div>
    </div>
  );
}
