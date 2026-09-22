import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { created } from "../../utils/apiResponse.js";
import { newsletterLimiter } from "../../middleware/rateLimiters.js";

export const newsletterRouter = Router();
newsletterRouter.post("/subscribe", newsletterLimiter, asyncHandler(async (req, res) => { const email = z.string().trim().email().max(254).parse(req.body.email).toLowerCase(); await prisma.newsletterSubscriber.upsert({ where: { email }, create: { email }, update: {} }); created(res, { subscribed: true }); }));
