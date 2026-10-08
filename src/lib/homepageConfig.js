// Presentation helpers shared by the homepage renderer and tests. Class names are written
// out in full so Tailwind can see them.

// Standard section spacing (settings.spacing). NORMAL keeps the renderer's default rhythm.
export const SPACING_CLASSES = { COMPACT: "-my-4 sm:-my-6", NORMAL: "", SPACIOUS: "py-4 sm:py-8" };
export const spacingClass = (value) => SPACING_CLASSES[value] ?? "";

export const TRUST_COLUMN_CLASSES = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" };
export const TRUST_MOBILE_CLASSES = {
  STACKED: "grid grid-cols-1",
  GRID: "grid grid-cols-2",
  SCROLL: "flex overflow-x-auto no-scrollbar snap-x [&>*]:min-w-[70%] [&>*]:snap-start",
};

export const BANNER_OVERLAY_CLASSES = {
  NONE: "from-transparent via-transparent to-transparent",
  LIGHT: "from-charcoal/30 via-charcoal/5 to-transparent",
  MEDIUM: "from-charcoal/55 via-charcoal/15 to-transparent",
  STRONG: "from-charcoal/70 via-charcoal/30 to-charcoal/5",
};
export const BANNER_ALIGN_CLASSES = {
  LEFT: "items-start text-left",
  CENTER: "items-center text-center",
  RIGHT: "items-end text-right",
};
