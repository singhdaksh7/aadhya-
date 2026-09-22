import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { prisma } from "../../lib/prisma.js";
import { verifyPaymentSchema } from "./payment.validators.js";
import {
  createRazorpayOrderForOrder,
  verifyRazorpaySignature,
  finalizePaidPayment,
} from "./payment.service.js";

export const createPaymentOrder = asyncHandler(async (req, res) => {
  const options = await createRazorpayOrderForOrder(req.params.orderId);
  ok(res, options);
});

export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = verifyPaymentSchema.parse(req.body);

  // Refuse to even attempt verification against an order id we never issued.
  const payment = await prisma.payment.findFirst({ where: { providerOrderId: razorpay_order_id } });
  if (!payment) throw ApiError.badRequest("This payment does not match any known order.");

  const valid = verifyRazorpaySignature({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
  });
  if (!valid) throw ApiError.badRequest("Payment signature could not be verified.");

  const { order } = await finalizePaidPayment({
    providerOrderId: razorpay_order_id,
    providerPaymentId: razorpay_payment_id,
    method: "razorpay",
  });

  ok(res, { orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus });
});
