// Decorative Edge Artwork helpers: normalising admin config and deciding where each item shows.
// Everything here is defensive: a malformed item is skipped, never thrown, so bad config cannot break a page.

export const SCOPES = [
  ["SITE", "Entire website"],
  ["HOME", "Homepage only"],
  ["HOME_SECTION", "A specific homepage section"],
  ["CATEGORIES", "All category pages"],
  ["CATEGORY", "One specific category"],
  ["PRODUCTS", "Product pages"],
  ["BOOKS", "Books page"],
  ["BLOG", "Blog pages"],
  ["PAGE", "One specific CMS page"],
];
const SCOPE_SET = new Set(SCOPES.map(([value]) => value));
const NEEDS_TARGET = new Set(["HOME_SECTION", "CATEGORY", "PAGE"]);
const LAYERS = new Set(["BEHIND", "MIDDLE", "ABOVE"]);

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const safeSrc = (value) => typeof value === "string" && (value.startsWith("/") || /^https?:\/\//i.test(value)) ? value.trim() : "";

/** Returns a render-ready item, or null when the config is unusable. */
export function normalizeDecoration(raw) {
  if (!raw || typeof raw !== "object" || raw.enabled === false) return null;
  const image = safeSrc(raw.image);
  if (!image || !SCOPE_SET.has(raw.scope)) return null;
  const targetId = typeof raw.targetId === "string" ? raw.targetId.trim() : "";
  if (NEEDS_TARGET.has(raw.scope) && !targetId) return null;
  const width = clamp(raw.width, 20, 1200, 260);
  return {
    id: String(raw.id || `${raw.scope}-${image}`),
    image,
    alt: typeof raw.alt === "string" ? raw.alt : "",
    scope: raw.scope,
    targetId,
    side: raw.side === "RIGHT" ? "RIGHT" : raw.side === "BOTH" ? "BOTH" : "LEFT",
    mirrorBoth: raw.mirrorBoth !== false,
    vertical: raw.vertical === "TOP" || raw.vertical === "BOTTOM" ? raw.vertical : "CENTER",
    width,
    maxWidth: clamp(raw.maxWidth, 0, 1600, 0),
    // Tablet / mobile widths derive from the desktop width unless overridden, so one desktop size never breaks a phone.
    widthTablet: clamp(raw.widthTablet, 0, 1200, 0) || Math.round(width * 0.7),
    widthMobile: clamp(raw.widthMobile, 0, 800, 0) || Math.min(Math.round(width * 0.4), 140),
    offsetX: clamp(raw.offsetX, -800, 800, 0),
    offsetY: clamp(raw.offsetY, -1500, 1500, 0),
    opacity: clamp(raw.opacity, 0.1, 1, 1),
    rotation: clamp(raw.rotation, -180, 180, 0),
    flipH: raw.flipH === true,
    flipV: raw.flipV === true,
    layer: LAYERS.has(raw.layer) ? raw.layer : "MIDDLE",
    fixed: raw.positionMode === "FIXED",
    focalX: clamp(raw.focalX, 0, 100, 50),
    focalY: clamp(raw.focalY, 0, 100, 50),
    zoom: clamp(raw.zoom, 0.5, 3, 1),
    frameAspect: clamp(raw.frameAspect, 0, 5, 0),
    showDesktop: raw.showDesktop !== false,
    showTablet: raw.showTablet !== false,
    showMobile: raw.showMobile === true, // phones are opt-in
    sortOrder: clamp(raw.sortOrder, 0, 1000, 0),
  };
}

export function normalizeDecorations(settings) {
  const list = Array.isArray(settings?.decorations?.items) ? settings.decorations.items : [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const item = normalizeDecoration(raw);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out.sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * A decoration set to "Both edges" becomes two independent copies, one per side. The right-hand copy is mirrored
 * (flipped, rotation negated) unless the admin turned mirroring off, so the motif faces inward symmetrically.
 */
export function expandBothSides(items) {
  return items.flatMap((item) => {
    if (item.side !== "BOTH") return [item];
    const left = { ...item, id: `${item.id}:left`, side: "LEFT" };
    const right = { ...item, id: `${item.id}:right`, side: "RIGHT", flipH: item.mirrorBoth ? !item.flipH : item.flipH, rotation: item.mirrorBoth ? -item.rotation : item.rotation };
    return [left, right];
  });
}

const clean = (pathname) => (pathname || "/").replace(/\/+$/, "") || "/";

/** Does a route-scoped item apply to this URL path? HOME_SECTION items are placed by the homepage renderer instead. */
export function matchesRoute(item, pathname) {
  const path = clean(pathname);
  const parts = path.split("/").filter(Boolean);
  switch (item.scope) {
    case "SITE": return true;
    case "HOME": return path === "/";
    case "CATEGORIES": return parts[0] === "shop" && parts[1] === "category" && parts.length === 3;
    case "CATEGORY": return parts[0] === "shop" && parts[1] === "category" && parts[2] === item.targetId;
    case "PRODUCTS": return (parts[0] === "products" && parts.length === 2) || (parts[0] === "shop" && parts.length === 2 && parts[1] !== "books" && parts[1] !== "category");
    case "BOOKS": return path === "/books" || path === "/shop/books";
    case "BLOG": return parts[0] === "blog";
    case "PAGE": return path === `/${item.targetId}` || path === `/pages/${item.targetId}`;
    default: return false; // HOME_SECTION is rendered inside its section
  }
}

export const routeDecorations = (items, pathname) => items.filter((item) => item.scope !== "HOME_SECTION" && matchesRoute(item, pathname));
export const sectionDecorations = (items, sectionId) => items.filter((item) => item.scope === "HOME_SECTION" && item.targetId === sectionId);

// Class names are written out in full so Tailwind can see them.
export const LAYER_CLASSES = { BEHIND: "-z-10", MIDDLE: "z-0", ABOVE: "z-10" };
export const VISIBILITY_CLASSES = {
  mobile: { true: "block", false: "hidden" },
  tablet: { true: "sm:block", false: "sm:hidden" },
  desktop: { true: "lg:block", false: "lg:hidden" },
};

// Section artwork frames the content, it never covers it. The homepage content column is max-w-7xl (80rem) with 2rem
// side padding, so its text edge sits at 76rem. Percentages resolve against the layer (the section's own width), so the
// gutter on each side is (100% - 76rem) / 2. Artwork is anchored to its outer edge (left or right, never the centre),
// the admin offset moves it from that anchor, and its width is capped so its inner edge stops one gap short of the
// content. On narrow screens the gutter is zero, the cap collapses and the artwork tucks away instead of covering content.
export const SAFE_CONTENT_WIDTH = "76rem";
export const SAFE_GAP_PX = 12;
export const safeZoneWidth = (item) =>
  `max(0px, calc((100% - ${SAFE_CONTENT_WIDTH}) / 2 - ${SAFE_GAP_PX}px ${item.offsetX >= 0 ? "-" : "+"} ${Math.abs(item.offsetX)}px))`;

/** Inline style for the positioned wrapper. Offsets may be negative so artwork can sit partly off the edge. */
export function wrapperStyle(item) {
  const style = {
    [item.side === "RIGHT" ? "right" : "left"]: `${item.offsetX}px`,
    opacity: item.opacity,
    "--deco-w-d": `${item.width}px`,
    "--deco-w-t": `${item.widthTablet}px`,
    "--deco-w-m": `${item.widthMobile}px`,
  };
  const cap = item.scope === "HOME_SECTION" ? safeZoneWidth(item) : null;
  if (cap) style.maxWidth = item.maxWidth > 0 ? `min(${item.maxWidth}px, ${cap})` : cap;
  else if (item.maxWidth > 0) style.maxWidth = `${item.maxWidth}px`;
  const transforms = [];
  if (item.vertical === "TOP") style.top = `${item.offsetY}px`;
  else if (item.vertical === "BOTTOM") style.bottom = `${item.offsetY}px`;
  else { style.top = `calc(50% + ${item.offsetY}px)`; transforms.push("translateY(-50%)"); }
  if (item.rotation) transforms.push(`rotate(${item.rotation}deg)`);
  if (item.flipH || item.flipV) transforms.push(`scale(${item.flipH ? -1 : 1}, ${item.flipV ? -1 : 1})`);
  if (transforms.length) style.transform = transforms.join(" ");
  return style;
}

/** Inline style for the clipping frame (non-destructive crop: focal point, zoom and optional aspect). */
export function frameStyle(item) {
  return item.frameAspect > 0 ? { aspectRatio: String(item.frameAspect) } : undefined;
}
export function imageStyle(item) {
  const focal = `${item.focalX}% ${item.focalY}%`;
  return { objectPosition: focal, transformOrigin: focal, transform: item.zoom !== 1 ? `scale(${item.zoom})` : undefined };
}
