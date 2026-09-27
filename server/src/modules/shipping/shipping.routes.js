import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok, created } from "../../utils/apiResponse.js";
import { zoneSchema, zoneUpdateSchema, rateSchema, rateUpdateSchema } from "./shipping.validators.js";
import * as shippingService from "./shipping.service.js";

export const adminShippingRouter = Router();
adminShippingRouter.use(requireAdmin);

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
