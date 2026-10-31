import { z } from "zod";

// "Explore More" homepage discovery section: a heading plus admin-managed link cards
// (Offers, Gifting, What's New by default). Own module so homepage-content.js needs only hooks.
export const EXPLORE_MORE_ICONS = ["sparkles", "gift", "tag", "star", "heart", "leaf", "badge", "home"];
export const EXPLORE_MORE_MAX_ITEMS = 8;

const safeUrl = z.string().trim().max(2048).refine((v) => v.startsWith("/") || /^https?:\/\//i.test(v), "Must be a relative or http(s) URL");
const optionalUrl = z.union([safeUrl, z.literal("")]).optional();
const text = (max) => z.string().trim().max(max);
const optionalText = (max) => z.union([text(max), z.literal("")]).optional();

export const exploreMoreSchema = z.object({
  eyebrow: optionalText(120),
  title: optionalText(200),
  subtitle: optionalText(500),
  items: z.array(z.object({
    id: optionalText(100),
    enabled: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    title: text(120),
    subtitle: optionalText(300),
    image: optionalUrl,
    imageAlt: optionalText(240),
    icon: z.enum(EXPLORE_MORE_ICONS).optional(),
    ctaLabel: optionalText(60),
    url: safeUrl,
  })).max(EXPLORE_MORE_MAX_ITEMS),
});

export const EXPLORE_MORE_DEFAULTS = {
  eyebrow: "Discover", title: "Explore More", subtitle: "Offers, gifting ideas and the latest from our artisans.",
  items: [
    { id: "explore-1", title: "Offers", subtitle: "Current coupon codes and festive savings", image: "", imageAlt: "", icon: "tag", ctaLabel: "View Offers", url: "/offers", enabled: true, sortOrder: 1 },
    { id: "explore-2", title: "Gifting", subtitle: "Thoughtful gifts by occasion, craft and budget", image: "", imageAlt: "", icon: "gift", ctaLabel: "Explore Gifting", url: "/gifting", enabled: true, sortOrder: 2 },
    { id: "explore-3", title: "What's New", subtitle: "Fresh updates and arrivals from our studio", image: "", imageAlt: "", icon: "sparkles", ctaLabel: "See What's New", url: "/offers?tab=whats-new", enabled: true, sortOrder: 3 },
  ],
};
