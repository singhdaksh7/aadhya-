import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { estimateLimiter } from "../../middleware/rateLimiters.js";
import { estimateDelivery } from "./estimate.service.js";

export const estimateSchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
  items: z.array(z.object({
    slug: z.string().min(1).max(200),
    quantity: z.number().int().min(1).max(99),
    variantId: z.string().uuid().optional(),
  })).max(50).optional(),
  cod: z.boolean().optional(),
});

export const publicShippingEstimateRouter = Router();
publicShippingEstimateRouter.post("/estimate", estimateLimiter, asyncHandler(async (req, res) => {
  const input = estimateSchema.parse(req.body ?? {});
  ok(res, await estimateDelivery(input));
}));
