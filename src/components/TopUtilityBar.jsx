import React from "react";
import { Link } from "react-router-dom";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { normalizeHeaderSettings, interpolateText } from "../lib/headerCmsHelpers";

export function UtilityIcon({ name, className = "h-3.5 w-3.5 text-stone-400" }) {
  switch (name) {
    case "truck":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      );
    case "returns":
    case "refresh":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    case "shield":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case "phone":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      );
    case "help":
    case "info":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "location":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "sparkle":
    case "gift":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function TopUtilityBar() {
  const { header, freeShippingThreshold, shipping, general, promoStrip } = useSiteSettings();
  const threshold = shipping?.freeShippingThreshold ?? freeShippingThreshold ?? 2499;

  const cms = normalizeHeaderSettings(header, shipping, general);

  if (cms.enabled === false || cms.utilityBar.enabled === false) {
    return null;
  }

  const items = cms.utilityBar.items || [];
  const activeItems = items.filter((i) => i.enabled !== false);

  // Group or separate left vs right items
  const leftItems = activeItems.filter((i) => i.id !== "ub-4" && i.id !== "ub-5");
  const rightItems = activeItems.filter((i) => i.id === "ub-4" || i.id === "ub-5");

  const rawCenter = cms.utilityBar.centerMessage || promoStrip?.description || "";
  const interpolatedCenter = interpolateText(rawCenter, { freeShippingThreshold: threshold, storeName: general?.storeName });

  return (
    <div className="bg-[#1C1917] border-b border-white/10 text-stone-300 text-[11px] sm:text-xs py-1.5 px-4 sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 sm:gap-4">
        {/* Left items */}
        <div className="flex min-w-0 flex-1 items-center gap-4 sm:flex-none sm:gap-6 sm:shrink-0">
          {leftItems.map((item, idx) => {
            const displayLabel = interpolateText(item.label || item.title || "", { freeShippingThreshold: threshold, storeName: general?.storeName });
            const itemUrl = item.url || item.link;
            const isExternal = item.linkType === "external" || /^https?:\/\//.test(itemUrl || "");

            return (
              <div
                key={item.id || idx}
                className={`flex min-w-0 items-center gap-1.5 sm:shrink-0 ${
                  item.showDesktop === false ? "lg:hidden" : ""
                } ${idx > 0 ? "hidden sm:flex" : ""}`}
              >
                <UtilityIcon name={item.icon} className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                {itemUrl && item.linkType !== "none" ? (
                  isExternal ? (
                    <a
                      href={itemUrl}
                      target={item.openInNewTab ? "_blank" : "_self"}
                      rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                      className="font-medium hover:text-white transition truncate"
                    >
                      {displayLabel}
                    </a>
                  ) : (
                    <Link to={itemUrl} className="font-medium hover:text-white transition truncate">
                      {displayLabel}
                    </Link>
                  )
                ) : (
                  <span className="font-medium text-stone-300 truncate">{displayLabel}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Center item (desktop) */}
        {cms.utilityBar.centerMessageEnabled !== false && interpolatedCenter && (
          <div className="hidden lg:flex items-center justify-center text-center font-medium text-amber-200/90 text-xs truncate max-w-md">
            {cms.utilityBar.centerMessageLink ? (
              <Link to={cms.utilityBar.centerMessageLink} className="hover:underline truncate">
                {interpolatedCenter}
              </Link>
            ) : (
              <span className="truncate">{interpolatedCenter}</span>
            )}
          </div>
        )}

        {/* Right side links */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0 whitespace-nowrap text-stone-400">
          {rightItems.length > 0 ? (
            rightItems.map((item, idx) => {
              const displayLabel = interpolateText(item.label || item.title || "", { freeShippingThreshold: threshold, storeName: general?.storeName });
              const itemUrl = item.url || item.link || "#";
              const isExternal = item.linkType === "external" || /^https?:\/\//.test(itemUrl);

              return (
                <React.Fragment key={item.id || idx}>
                  {idx > 0 && <span className="hidden text-stone-600 sm:inline">|</span>}
                  {isExternal ? (
                    <a
                      href={itemUrl}
                      target={item.openInNewTab ? "_blank" : "_self"}
                      rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                      className={`hover:text-white transition font-medium ${idx > 0 ? "hidden sm:inline" : ""}`}
                    >
                      {displayLabel}
                    </a>
                  ) : (
                    <Link to={itemUrl} className={`hover:text-white transition font-medium ${idx > 0 ? "hidden sm:inline" : ""}`}>
                      {displayLabel}
                    </Link>
                  )}
                </React.Fragment>
              );
            })
          ) : (
            <>
              <Link to="/track-order" className="hover:text-white transition font-medium">
                Track Order
              </Link>
              <span className="hidden text-stone-600 sm:inline">|</span>
              <Link to="/faq" className="hidden hover:text-white transition font-medium sm:inline">
                Help &amp; FAQ
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
