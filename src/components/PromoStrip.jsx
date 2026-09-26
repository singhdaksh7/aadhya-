import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { fetchPromos } from "../lib/api";

export default function PromoStrip({ promoConfig }) {
  const { promoStrip: settingsPromo } = useSiteSettings();
  const [promos, setPromos] = useState([]);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    let active = true;
    fetchPromos()
      .then((res) => {
        if (active && res.data?.length > 0) {
          setPromos(res.data);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const promo = promoConfig || settingsPromo || {
    active: true,
    description: "Get ₹500 off on your first purchase above ₹2,999",
    couponCode: "AADYA500",
    ctaLabel: "Shop Now",
    ctaUrl: "/shop",
  };

  const handleCopyCode = (e, code) => {
    e.preventDefault();
    e.stopPropagation();
    if (code) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const renderTickerContent = () => {
    const listToRender = promos.length > 0 ? promos : [
      {
        id: "default-1",
        message: promo.description || "Get ₹500 off on your first purchase",
        couponCode: promo.couponCode || "AADYA500",
        ctaLabel: promo.ctaLabel || "Shop Now",
        ctaUrl: promo.ctaUrl || "/shop",
      },
      { id: "default-2", message: "Free Shipping above ₹2,499", couponCode: null, ctaLabel: null, ctaUrl: null },
      { id: "default-3", message: "New Season Collection", couponCode: null, ctaLabel: "Explore Drop", ctaUrl: "/new-arrivals" },
    ];

    return (
      <div className="flex items-center gap-6 sm:gap-8 shrink-0 px-4">
        {listToRender.map((p, idx) => (
          <React.Fragment key={p.id || idx}>
            {idx > 0 && <span className="text-terracotta/40 font-bold">•</span>}
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-terracotta/10 text-terracotta shrink-0">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm-7 8h14a1 1 0 001-1v-5a1 1 0 00-1-1H5a1 1 0 00-1 1v5a1 1 0 001 1z" />
                </svg>
              </span>
              <span className="font-medium text-charcoal">{p.message}</span>
            </div>

            {p.couponCode && (
              <div className="flex items-center gap-1.5">
                <span className="text-charcoal-soft font-medium">Code:</span>
                <button
                  onClick={(e) => handleCopyCode(e, p.couponCode)}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-terracotta bg-white px-2.5 py-0.5 text-xs font-semibold text-terracotta transition hover:bg-terracotta hover:text-white focus:outline-none focus:ring-1 focus:ring-terracotta cursor-pointer"
                  aria-label={`Copy coupon code ${p.couponCode}`}
                  title="Click to copy coupon code"
                >
                  <span className="font-mono tracking-wider uppercase font-bold">{p.couponCode}</span>
                  <svg className="h-3 w-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {copiedCode === p.couponCode && (
                    <span className="text-[10px] text-terracotta font-semibold bg-white/90 px-1 rounded shadow-xs">✓ Copied</span>
                  )}
                </button>
              </div>
            )}

            {p.ctaUrl && (
              <Link
                to={p.ctaUrl}
                className="inline-flex items-center gap-1 font-semibold text-terracotta hover:text-terracotta-dark transition hover:underline"
              >
                <span>{p.ctaLabel || "Shop Now"}</span>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="relative w-full overflow-hidden bg-[#FAF6F0] border-y border-charcoal/10 py-2.5 text-xs text-charcoal">
      <div className="animate-marquee-ticker">
        {renderTickerContent()}
        {renderTickerContent()}
        {renderTickerContent()}
        {renderTickerContent()}
      </div>
    </div>
  );
}
