import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok, created } from "../../utils/apiResponse.js";
import { requireCustomer } from "../../middleware/customerAuth.js";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { reviewLimiter } from "../../middleware/rateLimiters.js";
import * as reviewService from "./review.service.js";

export const publicReviewRouter = Router({ mergeParams: true });
export const customerReviewRouter = Router();
export const adminReviewRouter = Router();

// Public: GET /api/products/:productId/reviews
publicReviewRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const result = await reviewService.listPublicProductReviews(productId, req.query);
    ok(res, result.items, { ...result.meta, summary: result.summary });
  })
);

// Customer: POST /api/account/reviews
customerReviewRouter.post(
  "/",
  requireCustomer,
  reviewLimiter,
  asyncHandler(async (req, res) => {
    const review = await reviewService.createCustomerReview(req.customer.id, req.body);
    created(res, review, "Submitted for review. Your review will be visible once approved.");
  })
);

// Customer: GET /api/account/reviews
customerReviewRouter.get(
  "/",
  requireCustomer,
  asyncHandler(async (req, res) => {
    const reviews = await reviewService.listCustomerReviews(req.customer.id);
    ok(res, reviews);
  })
);

// Customer: PUT /api/account/reviews/:id
customerReviewRouter.put(
  "/:id",
  requireCustomer,
  reviewLimiter,
  asyncHandler(async (req, res) => {
    const updated = await reviewService.updateCustomerReview(req.customer.id, req.params.id, req.body);
    ok(res, updated, "Review updated and resubmitted for review.");
  })
);

// Customer: DELETE /api/account/reviews/:id
customerReviewRouter.delete(
  "/:id",
  requireCustomer,
  asyncHandler(async (req, res) => {
    const result = await reviewService.deleteCustomerReview(req.customer.id, req.params.id);
    ok(res, result, "Review deleted.");
  })
);

// Admin: GET /api/admin/reviews
adminReviewRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await reviewService.listAdminReviews(req.query);
    ok(res, result.items, result.meta);
  })
);

// Admin: PATCH /api/admin/reviews/:id/status
adminReviewRouter.patch(
  "/:id/status",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const updated = await reviewService.moderateAdminReview(req.admin.id, req.params.id, status);
    ok(res, updated, `Review status set to ${updated.status}.`);
  })
);

// Admin: DELETE /api/admin/reviews/:id
adminReviewRouter.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await reviewService.deleteAdminReview(req.params.id);
    ok(res, result, "Review deleted.");
  })
);
