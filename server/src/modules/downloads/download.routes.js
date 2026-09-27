import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { requireCustomer } from "../../middleware/customerAuth.js";
import {
  resolveDownload,
  listCustomerDownloads,
  listGuestOrderDownloads,
  reissueCustomerDownloadLink,
  reissueGuestDownloadLink,
} from "./download.service.js";

// Public, unauthenticated by design — the token itself IS the credential
// (192-bit random, hashed at rest, single-purpose, rotated on reissue).
export const publicDownloadRouter = Router();
publicDownloadRouter.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const { stream, size, filename } = await resolveDownload(req.params.token);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/["\\]/g, "")}"`);
    if (size) res.setHeader("Content-Length", String(size));
    stream.on("error", () => res.destroy());
    stream.pipe(res);
  })
);

export const customerDownloadRouter = Router();
customerDownloadRouter.use(requireCustomer);
customerDownloadRouter.get(
  "/",
  asyncHandler(async (req, res) => ok(res, await listCustomerDownloads(req.customer.id)))
);
customerDownloadRouter.post(
  "/:orderItemId/link",
  asyncHandler(async (req, res) => {
    const token = await reissueCustomerDownloadLink(req.customer.id, req.params.orderItemId);
    ok(res, { token, url: `/api/downloads/${token}` });
  })
);

export const guestDownloadRouter = Router();
const guestSchema = z.object({ orderNumber: z.string().trim().min(1), accessToken: z.string().trim().min(1) });
guestDownloadRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { orderNumber, accessToken } = guestSchema.parse(req.body);
    ok(res, await listGuestOrderDownloads(orderNumber, accessToken));
  })
);
guestDownloadRouter.post(
  "/:orderItemId/link",
  asyncHandler(async (req, res) => {
    const { orderNumber, accessToken } = guestSchema.parse(req.body);
    const token = await reissueGuestDownloadLink(orderNumber, accessToken, req.params.orderItemId);
    ok(res, { token, url: `/api/downloads/${token}` });
  })
);
