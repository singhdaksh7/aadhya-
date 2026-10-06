import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { fetchPromos } from "../lib/api";
import { normalizeHeaderSettings } from "../lib/headerCmsHelpers";

export default function PromoStrip({ promoConfig }) {
  const { header, promoStrip: settingsPromo, shipping, general } = useSiteSettings();
  const [promos, setPromos] = useState([]);
  const [copiedCode, setCopiedCode] = useState(null);

  const cms = normalizeHeaderSettings(header, shipping, general);
  const tickerConfig = cms.promoTicker || {};

  useEffect(() => {
    let active = true;
    fetchPromos()
      .then((res) => {
        if (active && res.data?.length > 0) {
          const now = new Date();
          const valid = res.data
            .filter((p) => p.isActive !== false)
            .filter((p) => {
              if (p.startDate && new Date(p.startDate) > now) return false;
              if (p.endDate && new Date(p.endDate) < now) return false;
              return true;
            })
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          setPromos(valid);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const promo = promoConfig || settingsPromo || {
    active: true,
    description: "Get ₹500 off on your first purchase above ₹2,999",
    couponCode: "AADYA500",
    ctaLabel: "Shop Now",
    ctaUrl: "/shop",
  };

  const isEnabled = promoConfig?.enabled ?? tickerConfig.enabled ?? true;
  if (!isEnabled) return null;

  const configuredSpeed = Number(promoConfig?.speed ?? tickerConfig.speed);
  const tickerDuration = Number.isFinite(configuredSpeed) && configuredSpeed >= 10
    ? configuredSpeed
    : 90;

  const pauseOnHover = promoConfig?.pauseOnHover ?? tickerConfig.pauseOnHover ?? true;
  const separatorStyle = promoConfig?.separator ?? tickerConfig.separator ?? "dot";
  const showCouponCode = promoConfig?.showCouponCode ?? tickerConfig.showCouponCode ?? true;
  const showCta = promoConfig?.showCta ?? tickerConfig.showCta ?? true;

  const handleCopyCode = (e, code) => {
    e.preventDefault();
    e.stopPropagation();
    if (code) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const renderSeparator = () => {
    switch (separatorStyle) {
      case "diamond":
        return <span className="text-white/60 font-bold">◆</span>;
      case "line":
        return <span className="text-white/40 font-light">|</span>;
      case "none":
        return null;
      case "dot":
      default:
        return <span className="text-white/60 font-bold">•</span>;
    }
  };

  const fallbackMsg = tickerConfig.fallbackMessage || "Crafted by Master Indian Artisans • Free Delivery Above ₹2,499";

  const listToRender = promos.length > 0
    ? promos
    : (tickerConfig.hideWhenEmpty && !tickerConfig.fallbackMessage ? [] : [
        {
          id: "default-1",
          message: fallbackMsg,
          couponCode: promo.couponCode || "AADYA500",
          ctaLabel: promo.ctaLabel || "Shop Now",
          ctaUrl: promo.ctaUrl || "/shop",
        },
      ]);

  if (listToRender.length === 0) {
    return null;
  }

  const renderTickerContent = () => {
    return (
      <div className="flex items-center gap-6 sm:gap-8 shrink-0 px-4">
        {listToRender.map((p, idx) => (
          <React.Fragment key={p.id || idx}>
            {idx > 0 && renderSeparator()}
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-widest text-[11px] sm:text-xs text-white">
                {p.message || p.title || p.description}
              </span>
            </div>

            {showCouponCode && p.couponCode && (
              <div className="flex items-center gap-1.5">
                <span className="text-white/80 font-medium text-[11px]">Code:</span>
                <button
                  onClick={(e) => handleCopyCode(e, p.couponCode)}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded border border-dashed border-white/60 bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white transition hover:bg-white hover:store-primary focus:outline-none cursor-pointer"
                  aria-label={`Copy coupon code ${p.couponCode}`}
                  title="Click to copy coupon code"
                >
                  <span className="font-mono tracking-wider uppercase font-bold">{p.couponCode}</span>
                  <svg className="h-3 w-3 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {copiedCode === p.couponCode && (
                    <span className="text-[10px] store-primary font-semibold bg-white px-1 rounded shadow-xs">✓ Copied</span>
                  )}
                </button>
              </div>
            )}

            {showCta && p.ctaUrl && (
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
    <div className="relative w-full overflow-hidden store-bg-primary py-2 text-xs text-white border-b border-black/10">
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
