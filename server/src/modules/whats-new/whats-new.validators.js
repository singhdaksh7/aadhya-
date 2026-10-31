import { z } from "zod";

const optText = (max) =>
  z.preprocess((v) => (v === "" ? null : v), z.string().trim().max(max).optional().nullable());

// Relative storefront paths or http(s) URLs only (blocks javascript:/data: links).
const ctaUrl = z.preprocess(
  (v) => (v === "" ? null : v),
  z
    .string()
    .trim()
    .max(500)
    .refine((v) => /^\/(?!\/)/.test(v) || /^https?:\/\//i.test(v), "CTA link must start with / or http(s)://")
    .optional()
    .nullable()
);

const optDate = z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.date().nullable().optional());

const baseShape = {
  title: z.string().trim().min(1).max(150),
  subtitle: optText(500),
  imageUrl: optText(1000),
  badge: optText(40),
  ctaLabel: optText(60),
  ctaUrl,
  startDate: optDate,
  endDate: optDate,
};

const windowCheck = [
  (d) => !d.startDate || !d.endDate || d.endDate >= d.startDate,
  { message: "End date must be after start date", path: ["endDate"] },
];

export const createWhatsNewSchema = z
  .object({
    ...baseShape,
    isActive: z.boolean().optional().default(true),
    sortOrder: z.coerce.number().int().min(-100000).max(100000).optional().default(0),
  })
  .refine(...windowCheck);

export const updateWhatsNewSchema = z
  .object({
    ...baseShape,
    isActive: z.boolean(),
    sortOrder: z.coerce.number().int().min(-100000).max(100000),
  })
  .partial()
  .refine(...windowCheck);
