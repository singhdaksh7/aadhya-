import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { resolveMediaUrl } from "../lib/api";
import { LAYER_CLASSES, VISIBILITY_CLASSES, expandBothSides, frameStyle, imageStyle, normalizeDecorations, routeDecorations, wrapperStyle } from "../lib/decorations";

// One piece of artwork. Purely decorative: never receives clicks, never takes layout space, and is dropped
// (not shown as a broken image) if its file cannot be loaded.
function Art({ item, eager }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  const visibility = `${VISIBILITY_CLASSES.mobile[item.showMobile]} ${VISIBILITY_CLASSES.tablet[item.showTablet]} ${VISIBILITY_CLASSES.desktop[item.showDesktop]}`;
  return (
    <div
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
  const all = expandBothSides(items);
  const flow = all.filter((item) => !item.fixed);
  const fixed = all.filter((item) => item.fixed);
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
}

/** Site-wide layer: mount ONCE inside the storefront <main>. Shows entire-site and route-scoped artwork. */
export function SiteDecorations() {
  const settings = useSiteSettings();
  const { pathname } = useLocation();
  const items = useMemo(() => routeDecorations(normalizeDecorations(settings), pathname), [settings, pathname]);
  return <DecorationLayer items={items} />;
}

export default SiteDecorations;
