import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { listPublicOffers } from "./offers.service.js";

export const publicOfferRouter = Router();
publicOfferRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    ok(res, await listPublicOffers());
  })
);
