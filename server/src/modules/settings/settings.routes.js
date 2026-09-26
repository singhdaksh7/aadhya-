import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";

// This allow-list is the contract. It deliberately prevents a generic
// key/value endpoint from becoming a configuration or secret-write primitive.
const values = z.object({
  announcementBar: z.object({ text: z.string().max(240), active: z.boolean() }).optional(),
  supportPhone: z.string().max(40).optional(),
  supportEmail: z.string().email().optional(),
  standardShippingAmount: z.number().nonnegative().max(100000).optional(),
  freeShippingThreshold: z.number().nonnegative().max(1000000).optional(),
  socialLinks: z.record(z.string().max(40), z.string().url()).optional(),
  homepageHero: z.object({ title: z.string().max(200), image: z.string().url(), href: z.string().max(500).optional() }).optional(),
  seoDefaults: z.object({ title: z.string().max(200), description: z.string().max(500) }).optional(),
  promoStrip: z.object({
    active: z.boolean().optional(),
    title: z.string().max(200).optional(),
    couponCode: z.string().max(50).optional(),
    description: z.string().max(300).optional(),
    ctaLabel: z.string().max(100).optional(),
    ctaUrl: z.string().max(500).optional()
  }).optional(),
  heroBanners: z.array(z.object({
    id: z.string(),
    desktopImage: z.string().url(),
    mobileImage: z.string().url().optional(),
    eyebrow: z.string().max(100).optional(),
    headline: z.string().max(200),
    highlightText: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
    primaryCtaLabel: z.string().max(100).optional(),
    primaryCtaUrl: z.string().max(500).optional(),
    secondaryCtaLabel: z.string().max(100).optional(),
    secondaryCtaUrl: z.string().max(500).optional(),
    textPosition: z.string().optional(),
    textTheme: z.string().optional(),
    active: z.boolean().optional()
  })).optional()
}).strict();
export const publicSettingsRouter = Router();
publicSettingsRouter.get("/", asyncHandler(async (_req, res) => { const rows = await prisma.siteSetting.findMany(); ok(res, Object.fromEntries(rows.map((r) => [r.key, r.value]))); }));
export const adminSettingsRouter = Router();
adminSettingsRouter.use(requireAdmin);
adminSettingsRouter.get("/", asyncHandler(async (_req, res) => { const rows = await prisma.siteSetting.findMany(); ok(res, Object.fromEntries(rows.map((r) => [r.key, r.value]))); }));
adminSettingsRouter.put("/", asyncHandler(async (req, res) => { const input = values.parse(req.body); await prisma.$transaction(Object.entries(input).map(([key, value]) => prisma.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } }))); const rows = await prisma.siteSetting.findMany(); ok(res, Object.fromEntries(rows.map((r) => [r.key, r.value]))); }));

