// CTAs that render their own arrow must never double it when an admin has typed one into the label
// ("Shop Now →" + built-in arrow, or "Shop Now → →"). Strips any trailing arrow glyphs / "->" from a label.
const TRAILING_ARROWS = /(?:[\s\u00a0]*(?:[\u2190-\u21ff\u27f5-\u27ff\u2900-\u297f\u2b00-\u2bff>\u203a\u00bb]|-+>|=+>))+[\s\u00a0]*$/u;

export function ctaLabel(label, fallback = "") {
  if (typeof label !== "string") return fallback;
  const clean = label.replace(TRAILING_ARROWS, "").trim();
  return clean || fallback;
}
