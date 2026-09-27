import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok, created } from "../../utils/apiResponse.js";
import { trackEventsSchema, dateRangeQuerySchema } from "./analytics.validators.js";
import * as analyticsService from "./analytics.service.js";
import * as abandonedCartService from "./abandonedCart.service.js";

export const trackEvents = asyncHandler(async (req, res) => {
  const { events } = trackEventsSchema.parse(req.body);
  const customerId = req.customer?.id || null;
  await Promise.all(events.map((event) => analyticsService.recordClientEvent({ ...event, customerId })));
  created(res, { recorded: events.length });
});

function parseRange(req) {
  const query = dateRangeQuerySchema.parse(req.query);
  return analyticsService.resolveDateRange(query);
}

export const getOverview = asyncHandler(async (req, res) => {
  const range = parseRange(req);
  const overview = await analyticsService.getAnalyticsOverview(range);
  ok(res, overview);
});

export const getRevenue = asyncHandler(async (req, res) => {
  const range = parseRange(req);
  ok(res, await analyticsService.getRevenueOverview(range));
});

export const getProducts = asyncHandler(async (req, res) => {
  const range = parseRange(req);
  ok(res, await analyticsService.getProductPerformance(range));
});

export const getCategories = asyncHandler(async (req, res) => {
  const range = parseRange(req);
  ok(res, await analyticsService.getCategoryPerformance(range));
});

export const getCollections = asyncHandler(async (req, res) => {
  const range = parseRange(req);
  ok(res, await analyticsService.getCollectionPerformance(range));
});

export const getCoupons = asyncHandler(async (req, res) => {
  const range = parseRange(req);
  ok(res, await analyticsService.getCouponAnalytics(range));
});

export const getInventory = asyncHandler(async (req, res) => {
  ok(res, await analyticsService.getInventoryInsights());
});

export const getSearches = asyncHandler(async (req, res) => {
  const range = parseRange(req);
  ok(res, await analyticsService.getSearchAnalytics(range));
});

export const getAbandonedCarts = asyncHandler(async (req, res) => {
  ok(res, await abandonedCartService.listAbandonedCarts());
});

export const sendAbandonedCartRecovery = asyncHandler(async (req, res) => {
  const result = await abandonedCartService.triggerRecoveryEmail(req.params.cartId);
  ok(res, result);
});
