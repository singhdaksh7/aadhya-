// Pages whose storefront route is fixed in the app but whose content lives in Admin → Pages.
// Keep in sync with SYSTEM_PAGE_SLUGS in server/src/modules/pages/page.service.js (the server enforces it:
// these pages cannot be deleted or moved to a different slug).
export const SYSTEM_PAGES = {
  about: "/about",
  shipping: "/shipping",
  returns: "/returns",
  privacy: "/privacy",
  terms: "/terms",
  contact: "/contact",
  training: "/training",
  consultation: "/consultation",
  research: "/research",
  events: "/events",
  thinkpod: "/thinkpod",
};

export const isSystemPageSlug = (slug) => Object.prototype.hasOwnProperty.call(SYSTEM_PAGES, String(slug || ""));

// Public URL for a page: its fixed route for system pages, /pages/:slug for everything else.
export const publicPagePath = (slug) => SYSTEM_PAGES[slug] || `/pages/${slug}`;
