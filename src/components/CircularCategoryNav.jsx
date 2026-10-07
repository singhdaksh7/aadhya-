import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { fetchCategories, resolveMediaUrl } from "../lib/api";
import { normalizeHeaderSettings } from "../lib/headerCmsHelpers";
import { buildCategoryStripModel } from "../lib/navModel";
import NavAnchor from "./NavAnchor";

// Media box width in px per [shape family][size]. Rectangles are wider (4:3) but kept compact.
const SIZES = {
  square: { mobile: { small: 56, medium: 72, large: 88 }, desktop: { small: 72, medium: 96, large: 120 } },
  rect: { mobile: { small: 84, medium: 108, large: 132 }, desktop: { small: 108, medium: 144, large: 180 } },
};

export const SHAPE_STYLES = {
  CIRCLE: { radius: "rounded-full", aspect: "aspect-square", family: "square" },
  SQUARE: { radius: "rounded-none", aspect: "aspect-square", family: "square" },
  ROUNDED_SQUARE: { radius: "rounded-2xl", aspect: "aspect-square", family: "square" },
  RECTANGLE: { radius: "rounded-lg", aspect: "aspect-[4/3]", family: "rect" },
};

const GAP_PX = { compact: 8, comfortable: 16 };

/**
 * Optional category scroller strip rendered under the primary navigation. It is a normal-flow
 * element (never sticky/fixed) and scrolls its items inside its own container so the page
 * never gets wider.
 *
 * `cms` / `forceViewport` let the admin preview render the draft configuration.
 */
export default function CircularCategoryNav({ categories: categoriesProp, cms: cmsProp, forceViewport = null }) {
  const { header, shipping, general } = useSiteSettings();
  const [fetched, setFetched] = useState([]);
  const [failedImages, setFailedImages] = useState({});
  const [fitWidth, setFitWidth] = useState(null);
  const scrollRef = useRef(null);

  const cms = useMemo(
    () => cmsProp || normalizeHeaderSettings(header, shipping, general),
    [cmsProp, header, shipping, general]
  );
  const enabled = cms?.circularCategories?.enabled === true && cms?.enabled !== false;
  const needsFetch = categoriesProp === undefined && enabled;

  useEffect(() => {
    if (!needsFetch) return undefined;
    let active = true;
    fetchCategories()
      .then((res) => {
        if (active && Array.isArray(res?.data)) setFetched(res.data.filter((c) => c.isActive !== false));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [needsFetch]);

  const categories = categoriesProp !== undefined ? categoriesProp : fetched;
  const model = useMemo(() => buildCategoryStripModel({ cms, categories }), [cms, categories]);

  const cfg = model?.config;
  const shape = SHAPE_STYLES[cfg?.shape] || SHAPE_STYLES.CIRCLE;
  const gap = GAP_PX[cfg?.spacingDensity] ?? GAP_PX.comfortable;
  const mobileW = SIZES[shape.family].mobile[cfg?.mobileSize] ?? SIZES[shape.family].mobile.medium;
  const desktopW = SIZES[shape.family].desktop[cfg?.desktopSize] ?? SIZES[shape.family].desktop.medium;
  const itemCount = model?.items.length ?? 0;

  // On mobile, size items so either whole items fit exactly or the next one peeks in
  // (showPartialNextMobile). Falls back to the fixed sizes if the container can't be measured.
  useLayoutEffect(() => {
    if (!model || forceViewport === "desktop") return undefined;
    const measure = () => {
      const el = scrollRef.current;
      if (!el) return;
      const isDesktop = forceViewport !== "mobile" && typeof window !== "undefined" && window.matchMedia?.("(min-width: 768px)").matches;
      const cw = el.clientWidth;
      const g = GAP_PX[cfg.spacingDensity] ?? GAP_PX.comfortable;
      const n = Math.floor((cw + g) / (mobileW + g));
      if (isDesktop || !cw || n < 1 || itemCount <= n) {
        setFitWidth(null);
        return;
      }
      const w = cfg.showPartialNextMobile !== false ? (cw - n * g) / (n + 0.5) : (cw - (n - 1) * g) / n;
      setFitWidth(Math.max(40, Math.floor(w)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [model, cfg, forceViewport, mobileW, itemCount]);

  if (!model) return null;

  const showDesktop = cfg.showDesktop !== false;
  const showMobile = cfg.showMobile !== false;
  if (forceViewport === "desktop" && !showDesktop) return null;
  if (forceViewport === "mobile" && !showMobile) return null;

  const visibility = forceViewport
    ? ""
    : showDesktop && showMobile
      ? ""
      : showDesktop
        ? "hidden md:block"
        : "md:hidden";

  const itemStyle =
    forceViewport === "desktop"
      ? { width: desktopW }
      : forceViewport === "mobile"
        ? { width: fitWidth || mobileW }
        : { "--strip-w-m": `${fitWidth || mobileW}px`, "--strip-w-d": `${desktopW}px` };
  const itemWidthClass = forceViewport ? "" : "w-[var(--strip-w-m)] md:w-[var(--strip-w-d)]";
  const gapClass = cfg.spacingDensity === "compact" ? "gap-2 md:gap-3.5" : "gap-4 md:gap-7";
  const fitClass = cfg.imageFit === "contain" ? "object-contain" : "object-cover";
  const bgClass = cfg.backgroundMode === "soft" ? "store-surface" : "store-bg";
  // Theme border token (store-border), never a hard-coded colour; 1px hairlines.
  const { showTopSeparator, showBottomSeparator } = cfg;
  const dividerClass = `${showTopSeparator !== false ? "border-t store-border" : ""} ${showBottomSeparator !== false ? "border-b store-border" : ""}`;
  const padClass = cfg.spacingDensity === "compact" ? "py-2" : "py-4";

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollLeft + (direction === "left" ? -1 : 1) * el.clientWidth * 0.6, behavior: "smooth" });
  };

  const arrowCls =
    "hidden md:flex absolute top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full store-surface store-border border shadow-md text-charcoal opacity-0 group-hover/scroller:opacity-100 focus:opacity-100 transition-opacity cursor-pointer";

  return (
    <nav
      aria-label="Shop by category"
      data-testid="category-strip"
      data-shape={cfg.shape}
      data-top-divider={showTopSeparator !== false ? "true" : "false"}
      data-bottom-divider={showBottomSeparator !== false ? "true" : "false"}
      className={`${bgClass} ${dividerClass} ${padClass} ${visibility} relative group/scroller w-full max-w-full overflow-x-clip`}
    >
      <div className="mx-auto max-w-7xl relative px-4 sm:px-8 min-w-0">
        {cfg.showArrows !== false && forceViewport !== "mobile" && (
          <button type="button" onClick={() => scroll("left")} className={`${arrowCls} left-2`} aria-label="Scroll left">
            &larr;
          </button>
        )}

        <ul
          ref={scrollRef}
          role="list"
          className={`flex items-start ${gapClass} overflow-x-auto no-scrollbar scroll-smooth w-full max-w-full min-w-0 pb-1 pt-1 snap-x`}
        >
          {model.items.map((item) => {
            const imgFailed = failedImages[item.id];
            const desktopSrc = item.image && !imgFailed ? resolveMediaUrl(item.image) : null;
            const mobileSrc = item.mobileImage && !imgFailed ? resolveMediaUrl(item.mobileImage) : null;
            const src = forceViewport === "mobile" ? mobileSrc || desktopSrc : desktopSrc || mobileSrc;
            const showMobileSource = !forceViewport && mobileSrc && desktopSrc && mobileSrc !== desktopSrc;
            return (
              <li key={item.id} className={`shrink-0 snap-start ${itemWidthClass}`} style={itemStyle} data-testid="category-strip-item">
                <NavAnchor
                  to={item.to}
                  external={item.external}
                  className="group flex flex-col items-center text-center cursor-pointer"
                >
                  <div
                    data-testid="category-strip-media"
                    className={`relative w-full ${shape.aspect} ${shape.radius} overflow-hidden border border-charcoal/15 store-surface shadow-xs transition-shadow duration-300 group-hover:shadow-md group-hover:border-[var(--theme-primary)]`}
                  >
                    {src ? (
                      <picture>
                        {showMobileSource && <source media="(max-width: 767px)" srcSet={mobileSrc} />}
                        <img
                          src={src}
                          alt={cfg.showLabels !== false ? "" : item.name}
                          loading="lazy"
                          onError={() => setFailedImages((prev) => ({ ...prev, [item.id]: true }))}
                          className={`absolute inset-0 h-full w-full ${fitClass} transition-transform duration-500 group-hover:scale-105`}
                        />
                      </picture>
                    ) : (
                      <div
                        data-testid="category-strip-placeholder"
                        className="absolute inset-0 flex items-center justify-center store-primary font-serif-display font-semibold text-lg sm:text-xl"
                      >
                        {item.name?.charAt(0) || "A"}
                      </div>
                    )}
                    {item.badge && (
                      <span className="absolute top-1 right-1 store-bg-primary text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {cfg.showLabels !== false && (
                    <span className="mt-2 w-full text-[11px] md:text-xs font-medium store-text group-hover:store-primary transition-colors line-clamp-2 break-words leading-tight">
                      {item.name}
                    </span>
                  )}
                </NavAnchor>
              </li>
            );
          })}
        </ul>

        {cfg.showArrows !== false && forceViewport !== "mobile" && (
          <button type="button" onClick={() => scroll("right")} className={`${arrowCls} right-2`} aria-label="Scroll right">
            &rarr;
          </button>
        )}
      </div>
    </nav>
  );
}
