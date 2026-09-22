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
  supportPhone: "",
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
