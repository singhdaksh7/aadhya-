// ONE source of truth: the site setting `showGiftingOnHomepage` (stored via /admin/settings, served by /settings).
// Absent or anything other than an explicit `true` means OFF. The /gifting page, header/footer links, popup and
// bulk inquiry never read it.
export const showGiftingOnHomepage = (settings) => settings?.showGiftingOnHomepage === true;

// The home page has no dedicated gifting section type: its gifting presence is a card inside generic sections
// (Explore More "Gifting", the "Gift Edit" promo banner...). A card is gifting when it links to /gifting or is
// titled like a gift.
export const isGiftItem = (item) => {
  if (!item || typeof item !== "object") return false;
  const url = String(item.url || item.ctaUrl || "");
  return /^\/gifting(\/|\?|$)/i.test(url) || /\bgift/i.test(String(item.title || ""));
};

/**
 * Sections to render for the current setting. When OFF, gifting cards are removed from every section's `items`
 * (so their images are never requested) and a section left with no cards is dropped entirely: no empty wrapper,
 * no spacing, and no fallback to a component's built-in default cards. Content is never modified in the CMS.
 */
export function applyGiftingVisibility(sections, show) {
  if (show || !Array.isArray(sections)) return sections;
  return sections.flatMap((section) => {
    const items = section?.settings?.items;
    if (!Array.isArray(items) || !items.some(isGiftItem)) return [section];
    const rest = items.filter((i) => !isGiftItem(i));
    if (!rest.some((i) => i && i.enabled !== false)) return [];
    return [{ ...section, settings: { ...section.settings, items: rest } }];
  });
}
