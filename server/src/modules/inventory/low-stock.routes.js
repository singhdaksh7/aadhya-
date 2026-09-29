import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import * as lowStockService from "./low-stock.service.js";

export const adminLowStockRouter = Router();
adminLowStockRouter.use(requireAdmin);

adminLowStockRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await lowStockService.getLowStockOverview();
    ok(res, rows);
  })
);

adminLowStockRouter.get(
  "/threshold",
  asyncHandler(async (_req, res) => {
    const threshold = await lowStockService.getGlobalLowStockThreshold();
    ok(res, { threshold });
  })
);

const thresholdSchema = z.object({ threshold: z.number().int().min(0).max(100000) });

adminLowStockRouter.put(
  "/threshold",
  asyncHandler(async (req, res) => {
    const { threshold } = thresholdSchema.parse(req.body);
    const updated = await lowStockService.setGlobalLowStockThreshold(threshold);
    ok(res, { threshold: updated });
  })
);

adminLowStockRouter.post(
  "/sweep",
  asyncHandler(async (_req, res) => {
    const result = await lowStockService.runLowStockSweep();
    ok(res, result);
  })
);

const restockSchema = z.object({
  productId: z.string().optional(),
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
});

adminLowStockRouter.post(
  "/restock",
  asyncHandler(async (req, res) => {
    const input = restockSchema.parse(req.body);
    const updated = await lowStockService.restock(input);
    ok(res, updated);
  })
);

export default adminLowStockRouter;
