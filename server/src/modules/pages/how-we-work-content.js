import { z } from "zod";

// "How we work" homepage section: repeatable process points beside a supporting image.
// Kept in its own module so the shared homepage-content.js only needs one-line hooks.
export const HOW_WE_WORK_ICONS = ["sparkles", "badge", "home", "shield", "leaf", "heart"];
export const HOW_WE_WORK_MAX_ITEMS = 8;

const safeUrl = z.string().trim().max(2048).refine((v) => v.startsWith("/") || /^https?:\/\//i.test(v), "Must be a relative or http(s) URL");
const optionalUrl = z.union([safeUrl, z.literal("")]).optional();
const text = (max) => z.string().trim().max(max);
const optionalText = (max) => z.union([text(max), z.literal("")]).optional();
const optionalHex = z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a #RRGGBB colour"), z.literal("")]).optional();

export const howWeWorkSchema = z.object({
  eyebrow: optionalText(120),
  title: optionalText(200),
  subtitle: optionalText(500),
  background: z.enum(["SURFACE", "PLAIN", "CUSTOM"]).optional(),
  backgroundColor: optionalHex,
  showBorder: z.boolean().optional(),
  borderColor: optionalHex,
  borderRadius: z.number().int().min(0).max(48).optional(),
  image: optionalUrl,
  imageAlt: optionalText(240),
  imagePosition: z.enum(["LEFT", "RIGHT"]).optional(),
  items: z.array(z.object({
    id: optionalText(100),
    enabled: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    title: text(120),
    description: optionalText(400),
    icon: z.enum(HOW_WE_WORK_ICONS).optional(),
    iconImage: optionalUrl,
  })).max(HOW_WE_WORK_MAX_ITEMS),
});

// Neutral, editable placeholder wording only. No business claims.
export const HOW_WE_WORK_DEFAULTS = {
  eyebrow: "Our Approach", title: "How We Work", subtitle: "A few principles that guide what we offer.",
  background: "SURFACE", backgroundColor: "", showBorder: true, borderColor: "", borderRadius: 24,
  image: "", imageAlt: "", imagePosition: "RIGHT",
  items: [
    { id: "hww-1", title: "Thoughtful sourcing", description: "We take time to choose pieces with care and purpose.", icon: "leaf", iconImage: "", enabled: true, sortOrder: 1 },
    { id: "hww-2", title: "Careful making", description: "Attention to detail guides every step of the process.", icon: "sparkles", iconImage: "", enabled: true, sortOrder: 2 },
    { id: "hww-3", title: "Considered packaging", description: "Each order is packed with thought before it is sent.", icon: "badge", iconImage: "", enabled: true, sortOrder: 3 },
  ],
};
