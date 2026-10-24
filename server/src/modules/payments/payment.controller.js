import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { verifyPaymentSchema } from "./payment.validators.js";
import { createCashfreeOrderForOrder, syncCashfreePayment, retryFailedPayment } from "./payment.service.js";

export const createPaymentOrder = asyncHandler(async (req, res) => {
  ok(res, await createCashfreeOrderForOrder(req.params.orderId, req.customer?.id));
});

export const retryPayment = asyncHandler(async (req, res) => {
  ok(res, await retryFailedPayment(req.params.orderId, req.customer?.id));
});

// The browser only says WHICH Cashfree order to look at. The result comes from Cashfree's API, never
// from anything the browser sends (redirect params and popup callbacks are not trusted).
export const verifyPayment = asyncHandler(async (req, res) => {
  const { cashfreeOrderId } = verifyPaymentSchema.parse(req.body);
  const { status, orderNumber } = await syncCashfreePayment(cashfreeOrderId);
  ok(res, { status, orderNumber });
});
