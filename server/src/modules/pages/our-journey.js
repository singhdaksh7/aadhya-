import { z } from "zod";

// "Our Journey" homepage timeline. Kept in its own module so the shared homepage-content.js only
// needs a one-line schema entry and a one-line default entry.
const JOURNEY_ICONS = ["sparkles", "badge", "home", "shield", "leaf", "heart"];
const safeUrl = z.string().trim().max(2048).refine((v) => v.startsWith("/") || /^https?:\/\//i.test(v), "Must be a relative or http(s) URL");
const optionalUrl = z.union([safeUrl, z.literal("")]).optional();
const text = (max) => z.string().trim().max(max);
const optionalText = (max) => z.union([text(max), z.literal("")]).optional();

export const OUR_JOURNEY_MAX_MILESTONES = 12;

export const ourJourneySchema = z.object({
  eyebrow: optionalText(120),
  title: optionalText(160),
  subtitle: optionalText(400),
  image: optionalUrl,
  imageAlt: optionalText(240),
  imagePosition: z.enum(["LEFT", "RIGHT"]).optional(),
  background: z.enum(["PLAIN", "SURFACE"]).optional(),
  milestones: z.array(z.object({
    id: optionalText(100),
    enabled: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    date: optionalText(60),
    title: text(120),
    description: optionalText(600),
    icon: z.union([z.enum(JOURNEY_ICONS), z.literal("")]).optional(),
    image: optionalUrl,
    imageAlt: optionalText(240),
  })).max(OUR_JOURNEY_MAX_MILESTONES),
});

// Neutral placeholders ONLY. No real dates, counts, awards or claims: the admin must edit these.
// The section is created disabled until content is configured.
export const OUR_JOURNEY_DEFAULTS = {
  eyebrow: "Our Journey",
  title: "Our story so far",
  subtitle: "",
  image: "",
  imageAlt: "",
  imagePosition: "RIGHT",
  background: "PLAIN",
  spacing: "NORMAL",
  milestones: [
    { id: "journey-1", date: "Year", title: "Chapter one", description: "Draft placeholder: replace with your own milestone.", icon: "", image: "", enabled: true, sortOrder: 1 },
    { id: "journey-2", date: "Year", title: "Chapter two", description: "Draft placeholder: replace with your own milestone.", icon: "", image: "", enabled: true, sortOrder: 2 },
    { id: "journey-3", date: "Year", title: "Chapter three", description: "Draft placeholder: replace with your own milestone.", icon: "", image: "", enabled: true, sortOrder: 3 },
  ],
};
