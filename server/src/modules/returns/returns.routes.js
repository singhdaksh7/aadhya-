import { Router } from "express";
import { requireCustomer } from "../../middleware/customerAuth.js";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok, created } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  createReturnRequestSchema,
  rejectReturnSchema,
  schedulePickupSchema,
  issueRefundSchema,
} from "./returns.validators.js";
import * as returnsService from "./returns.service.js";

export const customerReturnRouter = Router();
customerReturnRouter.use(requireCustomer);

customerReturnRouter.get(
  "/eligibility/:orderNumber",
  asyncHandler(async (req, res) => {
    const result = await returnsService.checkReturnEligibility(req.params.orderNumber, req.customer.id);
    ok(res, {
      eligible: result.eligible,
      reason: result.reason || null,
      returnableItemIds: result.returnableItems?.map((i) => i.id) || [],
    });
  })
);

customerReturnRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createReturnRequestSchema.parse(req.body);
    const returnRequest = await returnsService.createReturnRequest({ ...body, customerId: req.customer.id });
    created(res, returnRequest);
  })
);

customerReturnRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await returnsService.listCustomerReturns(req.customer.id);
    ok(res, items);
  })
);

customerReturnRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const returnRequest = await returnsService.getCustomerReturn(req.params.id, req.customer.id);
    ok(res, returnRequest);
  })
);

export const adminReturnRouter = Router();
adminReturnRouter.use(requireAdmin);

adminReturnRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const { items, meta } = await returnsService.listAdminReturns({ page, limit, status: req.query.status || undefined });
    ok(res, items, meta);
  })
);

adminReturnRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const returnRequest = await returnsService.getAdminReturn(req.params.id);
    ok(res, returnRequest);
  })
);

adminReturnRouter.post(
  "/:id/approve",
  asyncHandler(async (req, res) => {
    const resolution = req.body?.resolution || "REFUND";
    const returnRequest = await returnsService.approveReturn(req.params.id, req.admin.id, resolution);
    ok(res, returnRequest);
  })
);

adminReturnRouter.post(
  "/:id/reject",
  asyncHandler(async (req, res) => {
    const body = rejectReturnSchema.parse(req.body || {});
    const returnRequest = await returnsService.rejectReturn(req.params.id, req.admin.id, body.note);
    ok(res, returnRequest);
  })
);

adminReturnRouter.post(
  "/:id/schedule-pickup",
  asyncHandler(async (req, res) => {
    schedulePickupSchema.parse(req.body || {});
    const returnRequest = await returnsService.schedulePickup(req.params.id, req.admin.id);
    ok(res, returnRequest);
  })
);

adminReturnRouter.post(
  "/:id/in-transit",
  asyncHandler(async (req, res) => {
    const returnRequest = await returnsService.markInTransit(req.params.id, req.admin.id);
    ok(res, returnRequest);
  })
);

adminReturnRouter.post(
  "/:id/received",
  asyncHandler(async (req, res) => {
    const returnRequest = await returnsService.markReceived(req.params.id, req.admin.id);
    ok(res, returnRequest);
  })
);

adminReturnRouter.post(
  "/:id/refund",
  asyncHandler(async (req, res) => {
    const body = issueRefundSchema.parse(req.body);
    if (body.method === "manual" && !body.reference) {
      throw ApiError.badRequest("A reference is required for a manually recorded refund.");
    }
    const result = await returnsService.issueRefund(req.params.id, req.admin.id, body);
    ok(res, result);
  })
);

adminReturnRouter.post(
  "/:id/close",
  asyncHandler(async (req, res) => {
    const returnRequest = await returnsService.closeReturn(req.params.id, req.admin.id);
    ok(res, returnRequest);
  })
);
