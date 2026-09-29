import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { getInternalHealth } from "./health.service.js";

export const adminHealthRouter = Router();

// Deep, admin-only health check. Distinct from the public GET /api/health,
// which stays trivial/unauthenticated. This one touches the DB and disk and
// must never leak secrets (passwords, API keys, absolute paths) — it only
// ever returns booleans/status strings.
adminHealthRouter.get(
  "/health",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const health = await getInternalHealth();
    return ok(res, health);
  })
);
