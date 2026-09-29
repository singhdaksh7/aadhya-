import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok, created } from "../../utils/apiResponse.js";
import {
  checkoutPreviewSchema,
  createOrderSchema,
  trackOrderSchema,
  confirmationQuerySchema,
  updateOrderStatusSchema,
  listOrdersQuerySchema,
  shipmentSchema,
} from "./order.validators.js";
import { buildCheckoutPreview } from "./checkout.service.js";
import * as orderService from "./order.service.js";

export const checkoutPreview = asyncHandler(async (req, res) => {
  const { items, couponCode, address } = checkoutPreviewSchema.parse(req.body);
  const customerId = req.customer?.id || null;
  const customerEmail = req.customer?.email || req.body.customerEmail || null;
  const preview = await buildCheckoutPreview(items, { couponCode, customerId, customerEmail, address });
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
  const { status, note } = updateOrderStatusSchema.parse(req.body);
  const order = await orderService.updateOrderStatus(req.params.id, status, note);
  ok(res, order);
});

export const upsertOrderShipment = asyncHandler(async (req, res) => {
  const input = shipmentSchema.parse(req.body);
  const shipment = await orderService.upsertShipment(req.params.id, input);
  ok(res, shipment);
});

export const createOrderShipment = asyncHandler(async (req, res) => {
  const input = shipmentSchema.parse(req.body);
  ok(res, await orderService.createOrderShipment(req.params.id, input));
});

export const generateOrderShipmentAwb = asyncHandler(async (req, res) => {
  ok(res, await orderService.generateOrderShipmentAwb(req.params.id));
});

export const scheduleOrderShipmentPickup = asyncHandler(async (req, res) => {
  ok(res, await orderService.scheduleOrderShipmentPickup(req.params.id));
});

export const getOrderShipmentLabel = asyncHandler(async (req, res) => {
  ok(res, await orderService.getOrderShipmentLabel(req.params.id));
});

export const refreshOrderShipmentTracking = asyncHandler(async (req, res) => {
  ok(res, await orderService.refreshOrderShipmentTracking(req.params.id));
});
