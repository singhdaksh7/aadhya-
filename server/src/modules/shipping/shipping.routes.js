import { Router } from "express";
import { requireAdmin, requireRole } from "../../middleware/adminAuth.js";
import { prisma } from "../../lib/prisma.js";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok, created } from "../../utils/apiResponse.js";
import { zoneSchema, zoneUpdateSchema, rateSchema, rateUpdateSchema } from "./shipping.validators.js";
import * as shippingService from "./shipping.service.js";

export const adminShippingRouter = Router();
adminShippingRouter.use(requireAdmin);

const businessSettings = z.object({
  provider: z.enum(["MANUAL", "SHIPROCKET", "DELHIVERY"]).default("MANUAL"), environment: z.enum(["TEST", "LIVE"]).default("TEST"),
  autoCreateShipment: z.boolean().default(false), autoGenerateAwb: z.boolean().default(false), autoSchedulePickup: z.boolean().default(false), codAllowed: z.boolean().default(true),
  pickup: z.object({ location: z.string().max(120).optional(), name: z.string().max(120).optional(), contact: z.string().max(120).optional(), email: z.string().email().optional().or(z.literal("")), phone: z.string().max(30).optional(), address: z.string().max(300).optional(), city: z.string().max(100).optional(), state: z.string().max(100).optional(), postalCode: z.string().max(20).optional(), country: z.string().max(100).optional() }).default({}),
  packageDefaults: z.object({ length: z.coerce.number().positive().default(20), width: z.coerce.number().positive().default(15), height: z.coerce.number().positive().default(10), weight: z.coerce.number().positive().default(.5) }).default({}),
}).superRefine((value, ctx) => { if (value.provider === "DELHIVERY") ctx.addIssue({ code: z.ZodIssueCode.custom, message: "DELHIVERY is not available yet." }); });

adminShippingRouter.get("/business", requireRole("SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  const row = await prisma.siteSetting.findUnique({ where: { key: "shippingBusiness" } }); ok(res, row?.value || { provider: "MANUAL", environment: "TEST", autoCreateShipment: false, autoGenerateAwb: false, autoSchedulePickup: false, codAllowed: true, pickup: {}, packageDefaults: { length: 20, width: 15, height: 10, weight: .5 } });
}));
adminShippingRouter.put("/business", requireRole("SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const value = businessSettings.parse(req.body); await prisma.siteSetting.upsert({ where: { key: "shippingBusiness" }, create: { key: "shippingBusiness", value }, update: { value } }); ok(res, value);
}));

adminShippingRouter.get(
  "/zones",
  asyncHandler(async (_req, res) => {
    const zones = await shippingService.listZones();
    ok(res, zones);
  })
);

adminShippingRouter.post(
  "/zones",
  asyncHandler(async (req, res) => {
    const input = zoneSchema.parse(req.body);
    const zone = await shippingService.createZone(input);
    created(res, zone);
  })
);

adminShippingRouter.patch(
  "/zones/:id",
  asyncHandler(async (req, res) => {
    const input = zoneUpdateSchema.parse(req.body);
    const zone = await shippingService.updateZone(req.params.id, input);
    ok(res, zone);
  })
);

adminShippingRouter.delete(
  "/zones/:id",
  asyncHandler(async (req, res) => {
    const result = await shippingService.deleteZone(req.params.id);
    ok(res, result);
  })
);

adminShippingRouter.post(
  "/zones/:zoneId/rates",
  asyncHandler(async (req, res) => {
    const input = rateSchema.parse(req.body);
    const rate = await shippingService.createRate(req.params.zoneId, input);
    created(res, rate);
  })
);

adminShippingRouter.patch(
  "/rates/:id",
  asyncHandler(async (req, res) => {
    const input = rateUpdateSchema.parse(req.body);
    const rate = await shippingService.updateRate(req.params.id, input);
    ok(res, rate);
  })
);

adminShippingRouter.delete(
  "/rates/:id",
  asyncHandler(async (req, res) => {
    const result = await shippingService.deleteRate(req.params.id);
    ok(res, result);
  })
);
