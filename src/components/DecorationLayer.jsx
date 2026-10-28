import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { resolveMediaUrl } from "../lib/api";
import { LAYER_CLASSES, VISIBILITY_CLASSES, expandBothSides, frameStyle, imageStyle, normalizeDecorations, routeDecorations, wrapperStyle } from "../lib/decorations";

// One piece of artwork. Purely decorative: never receives clicks, never takes layout space, and is dropped
// (not shown as a broken image) if its file cannot be loaded.
function Art({ item, eager }) {
  const [broken, setBroken] = useState(false);
  const ref = useRef(null);
  const drifts = item.vertical === "CENTER" && !item.fixed;

  // Vertical travel: as its layer (the page or the section) scrolls through the screen, centred artwork glides from the
  // top of the screen to the bottom, so it visibly moves while you scroll instead of just riding along with the page.
  // Written straight to the element (the CSS `translate` property, independent of rotate/flip) so scrolling never re-renders.
  useEffect(() => {
    const el = ref.current;
    const layer = el?.parentElement;
    if (!drifts || !el || !layer || typeof window === "undefined") return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = layer.getBoundingClientRect();
      const h = el.offsetHeight;
      const vh = window.innerHeight;
      if (!box.height || !h || !vh) return;
      const progress = Math.min(1, Math.max(0, (vh - box.top) / (vh + box.height))); // 0: layer just entering, 1: just left
      const top = -h + progress * (vh + h) - box.top; // wanted top edge, in layer coordinates
      el.style.translate = `0 ${Math.round(top - (box.height / 2 - h / 2))}px`; // relative to the CSS-centred position
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const img = el.querySelector("img");
    update();
    img?.addEventListener("load", schedule); // the art's height is only known once its image has loaded
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { img?.removeEventListener("load", schedule); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); if (frame) cancelAnimationFrame(frame); };
  }, [drifts]);

  if (broken) return null;
  const visibility = `${VISIBILITY_CLASSES.mobile[item.showMobile]} ${VISIBILITY_CLASSES.tablet[item.showTablet]} ${VISIBILITY_CLASSES.desktop[item.showDesktop]}`;
  return (
    <div
      ref={ref}
      data-testid="decoration"
      data-decoration-id={item.id}
      data-side={item.side}
      data-scope={item.scope}
      aria-hidden="true"
      className={`pointer-events-none absolute ${LAYER_CLASSES[item.layer]} ${visibility} w-[var(--deco-w-m)] sm:w-[var(--deco-w-t)] lg:w-[var(--deco-w-d)]`}
      style={wrapperStyle(item)}
    >
      <div className="overflow-hidden" style={frameStyle(item)}>
        <img
          src={resolveMediaUrl(item.image)}
          alt={item.alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable="false"
          onError={() => setBroken(true)}
          className={`block w-full select-none ${item.frameAspect > 0 ? "h-full object-cover" : "h-auto"}`}
          style={imageStyle(item)}
        />
      </div>
    </div>
  );
}

/**
 * Renders decorations inside the nearest positioned ancestor. The layer is clipped to that ancestor, so artwork
 * placed partly off the edge (negative offsets) can never create horizontal page scroll, and it is
 * pointer-events:none so it can never block a link, button, carousel or menu.
 */
export function DecorationLayer({ items }) {
  if (!items || items.length === 0) return null;
  // Artwork pinned to a homepage section always scrolls with that section: a viewport-fixed layer would sit still on
  // screen while the page moves, which reads as a stuck overlay. (Site/route artwork keeps the admin's choice.)
  const all = expandBothSides(items).map((item) => (item.scope === "HOME_SECTION" && item.fixed ? { ...item, fixed: false } : item));
  const render = (list) => {
    const flow = list.filter((item) => !item.fixed);
    const fixed = list.filter((item) => item.fixed);
    return (
      <>
        {flow.length > 0 && (
          <div data-testid="decoration-layer" aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            {flow.map((item) => <Art key={item.id} item={item} eager={item.vertical === "TOP"} />)}
          </div>
        )}
        {fixed.length > 0 && (
          // Fixed mode is opt-in per item and sits below the sticky header.
          <div data-testid="decoration-layer-fixed" aria-hidden="true" className="pointer-events-none fixed inset-0 z-[5] overflow-hidden">
            {fixed.map((item) => <Art key={item.id} item={item} eager />)}
          </div>
        )}
      </>
    );
  };
  // Section-scoped artwork is clipped to its own section (clip-path also clips fixed descendants), so "stays fixed"
  // only keeps it in place while that section is on screen: the hero and unrelated sections never see it.
  // clip-path makes a stacking context, so each layer (behind / middle / above) gets its own clip box to keep its stacking.
  if (all.every((item) => item.scope === "HOME_SECTION")) {
    return Object.keys(LAYER_CLASSES).map((layer) => {
      const list = all.filter((item) => item.layer === layer);
      return list.length === 0 ? null : (
        <div key={layer} data-testid="decoration-section-clip" aria-hidden="true" className={`pointer-events-none absolute inset-0 [clip-path:inset(0)] ${LAYER_CLASSES[layer]}`}>{render(list)}</div>
      );
    });
  }
  return render(all);
}

/** Site-wide layer: mount ONCE inside the storefront <main>. Shows entire-site and route-scoped artwork. */
export function SiteDecorations() {
  const settings = useSiteSettings();
  const { pathname } = useLocation();
  const items = useMemo(() => routeDecorations(normalizeDecorations(settings), pathname), [settings, pathname]);
  return <DecorationLayer items={items} />;
}

export default SiteDecorations;
