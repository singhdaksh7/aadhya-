import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { optionalCustomer } from "../../middleware/customerAuth.js";
import * as searchService from "./search.service.js";

const querySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  sessionId: z.string().trim().max(200).optional(),
});

export const publicSearchRouter = Router();

publicSearchRouter.get(
  "/",
  optionalCustomer,
  asyncHandler(async (req, res) => {
    const { q, sessionId } = querySchema.parse(req.query);
    const result = await searchService.search({ query: q, sessionId, customerId: req.customer?.id });
    ok(res, result);
  })
);
