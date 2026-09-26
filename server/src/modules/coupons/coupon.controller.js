import { asyncHandler } from "../../utils/asyncHandler.js";
import { created, noContent, ok } from "../../utils/apiResponse.js";
import * as couponService from "./coupon.service.js";
import {
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
} from "./coupon.validators.js";

export const listPublicActiveCoupons = asyncHandler(async (req, res) => {
  const result = await couponService.listPublicActiveCoupons();
  ok(res, result);
});

export const validateCoupon = asyncHandler(async (req, res) => {
  const { code, items } = validateCouponSchema.parse(req.body);
  const customerId = req.customer?.id || null;
  const customerEmail = req.customer?.email || req.body.customerEmail || null;
  const result = await couponService.validateCoupon({
    code,
    customerId,
    customerEmail,
    items,
  });
  ok(res, result);
});

export const listAdminCoupons = asyncHandler(async (req, res) => {
  const result = await couponService.listAdminCoupons();
  ok(res, result);
});

export const getAdminCouponById = asyncHandler(async (req, res) => {
  const result = await couponService.getAdminCouponById(req.params.id);
  ok(res, result);
});

export const createCoupon = asyncHandler(async (req, res) => {
  const input = createCouponSchema.parse(req.body);
  const result = await couponService.createCoupon(input);
  created(res, result);
});

export const updateCoupon = asyncHandler(async (req, res) => {
  const input = updateCouponSchema.parse(req.body);
  const result = await couponService.updateCoupon(req.params.id, input);
  ok(res, result);
});

export const deleteCoupon = asyncHandler(async (req, res) => {
  await couponService.deleteCoupon(req.params.id);
  noContent(res);
});
