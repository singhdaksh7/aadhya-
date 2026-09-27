import { Router } from "express";
import { checkoutLimiter } from "../../middleware/rateLimiters.js";
import { optionalCustomer } from "../../middleware/customerAuth.js";
import { createPaymentOrder, verifyPayment, retryPayment } from "./payment.controller.js";

// Mounted at /api/orders — POST /api/orders/:orderId/payment
// optionalCustomer populates req.customer when a valid customer access
// token is present so the service layer can enforce that an order tied to
// an account can only have its payment initiated/retried by that account.
export const orderPaymentRouter = Router();
orderPaymentRouter.post("/:orderId/payment", checkoutLimiter, optionalCustomer, createPaymentOrder);
orderPaymentRouter.post("/:orderId/payment/retry", checkoutLimiter, optionalCustomer, retryPayment);

// Mounted at /api/payments/razorpay — POST /api/payments/razorpay/verify
export const razorpayVerifyRouter = Router();
razorpayVerifyRouter.post("/verify", checkoutLimiter, verifyPayment);
