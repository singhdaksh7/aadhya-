import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok, created } from "../../utils/apiResponse.js";
import {
  checkoutPreviewSchema,
  createOrderSchema,
  trackOrderSchema,
  confirmationQuerySchema,
  updateOrderStatusSchema,
  listOrdersQuerySchema,
} from "./order.validators.js";
import { buildCheckoutPreview } from "./checkout.service.js";
import * as orderService from "./order.service.js";

export const checkoutPreview = asyncHandler(async (req, res) => {
  const { items, couponCode } = checkoutPreviewSchema.parse(req.body);
  const customerId = req.customer?.id || null;
  const customerEmail = req.customer?.email || req.body.customerEmail || null;
  const preview = await buildCheckoutPreview(items, { couponCode, customerId, customerEmail });
  ok(res, preview);
});

export const createOrder = asyncHandler(async (req, res) => {
  const input = createOrderSchema.parse(req.body);
  const { order, accessToken } = await orderService.createOrder({ ...input, customerId: req.customer?.id });
  created(res, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    currency: order.currency,
    accessToken,
  });
});

export const getOrderConfirmation = asyncHandler(async (req, res) => {
  const { token } = confirmationQuerySchema.parse(req.query);
  const order = await orderService.getOrderForConfirmation(req.params.orderNumber, token);
  ok(res, order);
});

export const trackOrder = asyncHandler(async (req, res) => {
  const input = trackOrderSchema.parse(req.body);
  const order = await orderService.trackOrder(input);
  ok(res, order);
});

export const listAdminOrders = asyncHandler(async (req, res) => {
  const query = listOrdersQuerySchema.parse(req.query);
  const { items, meta } = await orderService.listAdminOrders(query);
  ok(res, items, meta);
});

export const getAdminOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getAdminOrderById(req.params.id);
  ok(res, order);
});

export const updateAdminOrderStatus = asyncHandler(async (req, res) => {
  const { status } = updateOrderStatusSchema.parse(req.body);
  const order = await orderService.updateOrderStatus(req.params.id, status);
  ok(res, order);
});
