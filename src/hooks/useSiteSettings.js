import { useEffect, useState } from "react";
import { fetchSiteSettings } from "../lib/api";

export const DEFAULT_SITE_SETTINGS = {
  announcementBar: {
    active: true,
    text: "Free delivery above ₹2,499 • Pan-India Express Shipping • Crafted by Master Indian Artisans",
  },
  freeShippingThreshold: 2499,
  standardShippingAmount: 150,
  supportEmail: "concierge@aadyahome.com",
  supportPhone: "+91 (800) 242-3921",
  promoStrip: {
    active: true,
    title: "Get ₹500 off on your first order",
    couponCode: "AADYA500",
    description: "Valid on orders above ₹2,499. Applied at checkout.",
    ctaLabel: "Shop Offer",
    ctaUrl: "/shop",
  },
  heroBanners: [
    {
      id: "hero-1",
      desktopImage: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=2000&auto=format&fit=crop",
      mobileImage: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1000&auto=format&fit=crop",
      eyebrow: "Artisan Sanctuary 2026",
      headline: "Decor that Feels Like Home",
      highlightText: "Feels Like Home",
      description: "Discover handcrafted oil lamps, unglazed clay vessels, linen textiles, and slow design monographs.",
      primaryCtaLabel: "Shop Home Decor",
      primaryCtaUrl: "/shop",
      secondaryCtaLabel: "Explore Collections",
      secondaryCtaUrl: "/collections",
      textPosition: "LEFT",
      textTheme: "DARK",
      active: true,
    },
    {
      id: "hero-2",
      desktopImage: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=2000&auto=format&fit=crop",
      mobileImage: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=1000&auto=format&fit=crop",
      eyebrow: "Handcrafted Earth & Metal",
      headline: "Sacred Rituals & Quiet Grace",
      highlightText: "Quiet Grace",
      description: "Organic stoneware, hand-chased brassware and natural flax textiles created by master Indian artisans.",
      primaryCtaLabel: "Discover Earth Edit",
      primaryCtaUrl: "/collections/handcrafted-decor",
      secondaryCtaLabel: "View New Arrivals",
      secondaryCtaUrl: "/new-arrivals",
      textPosition: "LEFT",
      textTheme: "DARK",
      active: true,
    },
  ],
};

// Settings are optional site dressing — a missing/failed fetch falls back to
// sane defaults rather than showing an empty bar, broken pricing hints, or
// an error. These values are never authoritative for what a customer is
// actually charged; the checkout preview API remains the source of truth
// for the shipping amount and total at checkout.
export function useSiteSettings() {
  const [settings, setSettings] = useState(DEFAULT_SITE_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    fetchSiteSettings()
      .then((res) => {
        if (cancelled || !res?.data) return;
        setSettings((prev) => ({ ...prev, ...res.data }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}
