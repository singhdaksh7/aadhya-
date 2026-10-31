import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";

// The promotional popup lives in the generic SiteSetting key/value table under this key.
export const POPUP_SETTING_KEY = "promoPopup";

export const DEFAULT_PROMO_POPUP = {
  enabled: false,
  title: "",
  description: "",
  desktopImage: "",
  mobileImage: "",
  ctaLabel: "",
  ctaUrl: "",
  dismissLabel: "Maybe later",
  delaySeconds: 5,
  frequency: "SESSION",
  days: 7,
  startDate: "",
  endDate: "",
  targeting: "HOME",
  routes: [],
};

// Only relative paths or http(s) URLs; blocks javascript:/data: and protocol-relative URLs.
const urlValue = (max = 2048) =>
  z.string().trim().max(max).refine(
    (v) => v === "" || (v.startsWith("/") && !v.startsWith("//") && !/\s/.test(v)) || /^https?:\/\/[^\s]+$/i.test(v),
    "Must be a relative path (starting with /) or an http(s) URL"
  );
const routeValue = z.string().trim().min(1).max(200).refine((v) => v.startsWith("/") && !v.startsWith("//") && !/\s/.test(v), "Routes must start with /");
const dateValue = z.union([z.literal(""), z.null(), z.string().trim().max(40).refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")]);

export const promoPopupSchema = z
  .object({
    enabled: z.boolean(),
    title: z.string().trim().max(120),
    description: z.string().trim().max(500).optional().default(""),
    desktopImage: urlValue().optional().default(""),
    mobileImage: urlValue().optional().default(""),
    ctaLabel: z.string().trim().max(60).optional().default(""),
    ctaUrl: urlValue().optional().default(""),
    dismissLabel: z.string().trim().max(60).optional().default("Maybe later"),
    delaySeconds: z.number().int().min(0).max(300).optional().default(5),
    frequency: z.enum(["SESSION", "DAILY", "EVERY_X_DAYS"]).optional().default("SESSION"),
    days: z.number().int().min(1).max(365).optional().default(7),
    startDate: dateValue.optional().default(""),
    endDate: dateValue.optional().default(""),
    targeting: z.enum(["HOME", "ALL", "SELECTED"]).optional().default("HOME"),
    routes: z.array(routeValue).max(30).optional().default([]),
  })
  .superRefine((v, ctx) => {
    if (v.enabled && !v.title) ctx.addIssue({ code: "custom", path: ["title"], message: "Title is required when the popup is enabled" });
    if (v.ctaLabel && !v.ctaUrl) ctx.addIssue({ code: "custom", path: ["ctaUrl"], message: "CTA URL is required when a CTA label is set" });
    if (v.targeting === "SELECTED" && v.routes.length === 0) ctx.addIssue({ code: "custom", path: ["routes"], message: "Add at least one route for selected-page targeting" });
    if (v.startDate && v.endDate && Date.parse(v.endDate) <= Date.parse(v.startDate)) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be after the start date" });
    }
  });

async function readStoredPopup() {
  const row = await prisma.siteSetting.findUnique({ where: { key: POPUP_SETTING_KEY } });
  const value = row && typeof row.value === "object" && row.value ? row.value : {};
  return { ...DEFAULT_PROMO_POPUP, ...value, updatedAt: row?.updatedAt ?? null };
}

// Pure helper so the schedule logic is testable: live = enabled and inside [startDate, endDate].
export function isPopupLive(popup, now = new Date()) {
  if (!popup || popup.enabled !== true) return false;
  const t = now.getTime();
  if (popup.startDate) {
    const start = Date.parse(popup.startDate);
    if (!Number.isNaN(start) && t < start) return false;
  }
  if (popup.endDate) {
    const end = Date.parse(popup.endDate);
    if (!Number.isNaN(end) && t > end) return false;
  }
  return true;
}

export const publicPopupRouter = Router();
publicPopupRouter.get("/", asyncHandler(async (_req, res) => {
  const popup = await readStoredPopup();
  if (!isPopupLive(popup)) return ok(res, null);
  const { updatedAt, ...rest } = popup;
  // `version` lets the storefront show a changed campaign again to visitors who dismissed the old one.
  ok(res, { ...rest, version: updatedAt ? new Date(updatedAt).getTime() : 0 });
}));

export const adminPopupRouter = Router();
adminPopupRouter.use(requireAdmin);
adminPopupRouter.get("/", asyncHandler(async (_req, res) => {
  const stored = await readStoredPopup();
  ok(res, stored);
}));
adminPopupRouter.put("/", asyncHandler(async (req, res) => {
  const parsed = promoPopupSchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    const msg = first ? `${first.path.join(".")}: ${first.message}` : "Validation failed";
    return res.status(400).json({ error: msg, details: parsed.error.errors });
  }
  await prisma.siteSetting.upsert({
    where: { key: POPUP_SETTING_KEY },
    create: { key: POPUP_SETTING_KEY, value: parsed.data },
    update: { value: parsed.data },
  });
  ok(res, await readStoredPopup());
}));
