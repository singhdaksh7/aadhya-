import { Router } from "express";
import { checkoutLimiter } from "../../middleware/rateLimiters.js";
import { createPaymentOrder, verifyPayment } from "./payment.controller.js";

// Mounted at /api/orders — POST /api/orders/:orderId/payment
export const orderPaymentRouter = Router();
orderPaymentRouter.post("/:orderId/payment", checkoutLimiter, createPaymentOrder);

// Mounted at /api/payments/razorpay — POST /api/payments/razorpay/verify
export const razorpayVerifyRouter = Router();
razorpayVerifyRouter.post("/verify", checkoutLimiter, verifyPayment);
