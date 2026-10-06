import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { fetchPromos } from "../lib/api";

const DEFAULT_TICKER_DURATION_SECONDS = 90;

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
  const configuredSpeed = Number(promoConfig?.speed);
  const tickerDuration = Number.isFinite(configuredSpeed) && configuredSpeed > 0
    ? configuredSpeed
    : DEFAULT_TICKER_DURATION_SECONDS;
  const pauseOnHover = promoConfig?.pauseOnHover ?? true;

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
        message: "CRAFTED BY INDIAN ARTISANS",
        couponCode: null,
        ctaLabel: null,
        ctaUrl: null,
      },
      {
        id: "default-2",
        message: promo.description || "GET ₹500 OFF ON FIRST PURCHASE",
        couponCode: promo.couponCode || "AADYA500",
        ctaLabel: promo.ctaLabel || "Shop Now",
        ctaUrl: promo.ctaUrl || "/shop",
      },
      {
        id: "default-3",
        message: "NEW SEASON COLLECTION",
        couponCode: null,
        ctaLabel: "Explore Drop",
        ctaUrl: "/new-arrivals",
      },
      {
        id: "default-4",
        message: "FREE DELIVERY ABOVE ₹2,499",
        couponCode: null,
        ctaLabel: null,
        ctaUrl: null,
      },
    ];

    return (
      <div className="flex items-center gap-6 sm:gap-8 shrink-0 px-4">
        {listToRender.map((p, idx) => (
          <React.Fragment key={p.id || idx}>
            {idx > 0 && <span className="text-white/60 font-bold">•</span>}
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-widest text-[11px] sm:text-xs text-white">
                {p.message}
              </span>
            </div>

            {p.couponCode && (
              <div className="flex items-center gap-1.5">
                <span className="text-white/80 font-medium text-[11px]">Code:</span>
                <button
                  onClick={(e) => handleCopyCode(e, p.couponCode)}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded border border-dashed border-white/60 bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white transition hover:bg-white hover:text-[#B8674A] focus:outline-none cursor-pointer"
                  aria-label={`Copy coupon code ${p.couponCode}`}
                  title="Click to copy coupon code"
                >
                  <span className="font-mono tracking-wider uppercase font-bold">{p.couponCode}</span>
                  <svg className="h-3 w-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {copiedCode === p.couponCode && (
                    <span className="text-[10px] text-[#B8674A] font-semibold bg-white px-1 rounded shadow-xs">✓ Copied</span>
                  )}
                </button>
              </div>
            )}

            {p.ctaUrl && (
              <Link
                to={p.ctaUrl}
                className="inline-flex items-center gap-1 font-bold text-[11px] uppercase tracking-wider text-amber-200 hover:text-white transition hover:underline"
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
    <div className="relative w-full overflow-hidden bg-[var(--theme-primary,#B8674A)] py-2 text-xs text-white border-b border-black/10">
      <div
        className={`animate-marquee-ticker${pauseOnHover ? " marquee-ticker-pauseable" : ""}`}
        style={{ "--ticker-duration": `${tickerDuration}s` }}
      >
        {renderTickerContent()}
        {renderTickerContent()}
        {renderTickerContent()}
        {renderTickerContent()}
      </div>
    </div>
  );
}

