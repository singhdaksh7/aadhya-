import { api } from "./api";
import { getSessionId, getStoredUtmAttribution } from "./attribution";

// Fire-and-forget client-side event tracking. Never throws into the caller
// — a failed analytics beacon must never break the page it was tracking.
export function trackEvent(type, payload = {}) {
  try {
    const sessionId = getSessionId();
    const utm = getStoredUtmAttribution();
    api
      .post("/analytics/events", {
        events: [{ type, sessionId, ...utm, ...payload }],
      })
      .catch(() => {});
  } catch {
    // ignore
  }
}

export const trackPageView = (metadata) => trackEvent("page_view", { metadata });
export const trackProductView = (productId, metadata) => trackEvent("product_view", { productId, metadata });
export const trackCategoryView = (categoryId, metadata) => trackEvent("category_view", { categoryId, metadata });
export const trackCollectionView = (collectionId, metadata) => trackEvent("collection_view", { collectionId, metadata });
export const trackAddToCart = (productId, metadata) => trackEvent("add_to_cart", { productId, metadata });
export const trackRemoveFromCart = (productId, metadata) => trackEvent("remove_from_cart", { productId, metadata });
export const trackCheckoutStarted = (metadata) => trackEvent("checkout_started", { metadata });
export const trackWishlistAdd = (productId, metadata) => trackEvent("wishlist_add", { productId, metadata });
export const trackNewsletterSignup = (metadata) => trackEvent("newsletter_signup", { metadata });
export const trackCouponApplied = (metadata) => trackEvent("coupon_applied", { metadata });

// --- Recently viewed products (localStorage-backed; same treatment for
// guest and logged-in customers, per Phase I scope). ---
const RECENTLY_VIEWED_KEY = "aadya_recently_viewed";
const MAX_RECENTLY_VIEWED = 12;

export function recordRecentlyViewed(product) {
  if (!product?.slug) return;
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const entry = { slug: product.slug, name: product.name, image: product.image, price: product.price, salePrice: product.salePrice, viewedAt: Date.now() };
    const filtered = list.filter((p) => p.slug !== product.slug);
    filtered.unshift(entry);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(filtered.slice(0, MAX_RECENTLY_VIEWED)));
  } catch {
    // best-effort only
  }
}

export function getRecentlyViewed(excludeSlug) {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return excludeSlug ? list.filter((p) => p.slug !== excludeSlug) : list;
  } catch {
    return [];
  }
}
