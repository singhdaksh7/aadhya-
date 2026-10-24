import crypto from "node:crypto";

// In-memory stand-in for Cashfree's REST API, used by the server tests so the whole payment pipeline
// (order creation, server-side verification, webhooks, idempotency, stock, refunds) runs for real
// against the test database with ONLY the network boundary replaced. No real Cashfree call is made.
//
// Usage in a test file:
//   vi.mock("../src/modules/payments/cashfree.client.js", async () => (await import("./fakes/cashfree.js")).cashfreeClientMock());
//   import { cf, cfPay, ... } from "./fakes/cashfree.js";

export const cf = {
  configured: true,
  secret: "cf_test_secret_for_tests",
  environment: "TEST",
  orders: new Map(), // order_id -> { order_id, order_amount, order_currency, order_status, payment_session_id, customer_details, order_meta }
  payments: new Map(), // order_id -> [{ cf_payment_id, payment_status, payment_group, payment_amount }]
  refunds: new Map(), // `${order_id}:${refund_id}` -> { refund_status, ... }
  nextRefundStatus: "SUCCESS",
  failCreate: null, // { status, message } to simulate a Cashfree rejection
  unreachable: false,
  calls: { createOrder: 0, createRefund: 0 },
  seq: 0,
};

export function resetCashfree() {
  cf.configured = true;
  cf.secret = "cf_test_secret_for_tests";
  cf.orders.clear();
  cf.payments.clear();
  cf.refunds.clear();
  cf.nextRefundStatus = "SUCCESS";
  cf.failCreate = null;
  cf.unreachable = false;
  cf.calls = { createOrder: 0, createRefund: 0 };
  cf.seq = 0;
}

// --- helpers that simulate what the customer does on Cashfree's page -------------------------------
export function cfPay(orderId, { amount, group = "upi" } = {}) {
  const order = cf.orders.get(orderId);
  const id = String(1000 + ++cf.seq);
  const list = cf.payments.get(orderId) || [];
  list.push({ cf_payment_id: id, payment_status: "SUCCESS", payment_group: group, payment_amount: amount ?? order.order_amount });
  cf.payments.set(orderId, list);
  order.order_status = "PAID";
  return id;
}
export function cfAttempt(orderId, payment_status) {
  const id = String(1000 + ++cf.seq);
  const list = cf.payments.get(orderId) || [];
  list.push({ cf_payment_id: id, payment_status, payment_group: "upi", payment_amount: cf.orders.get(orderId).order_amount });
  cf.payments.set(orderId, list);
  return id;
}
export function cfExpire(orderId) {
  cf.orders.get(orderId).order_status = "EXPIRED";
}

// Exactly how Cashfree signs: Base64( HMAC-SHA256(secret, timestamp + rawBody) ).
export function signWebhook(rawBody, timestamp = String(Date.now()), secret = cf.secret) {
  return { timestamp, signature: crypto.createHmac("sha256", secret).update(timestamp + rawBody).digest("base64") };
}
export function webhookBody(type, { orderId, paymentId = "1001", status = "SUCCESS", amount = 1 } = {}) {
  return JSON.stringify({
    data: {
      order: { order_id: orderId, order_amount: amount, order_currency: "INR" },
      payment: { cf_payment_id: paymentId, payment_status: status, payment_amount: amount, payment_currency: "INR", payment_group: "upi" },
      customer_details: { customer_id: "x", customer_email: "t@example.com", customer_phone: "9876543210" },
    },
    event_time: new Date().toISOString(),
    type,
  });
}

// --- the module mock ---------------------------------------------------------------------------------
export function cashfreeClientMock() {
  class CashfreeError extends Error {
    constructor(message, { status = 0, code = null } = {}) {
      super(message);
      this.name = "CashfreeError";
      this.status = status;
      this.code = code;
    }
  }
  const guard = () => {
    if (cf.unreachable) throw new CashfreeError("Could not reach Cashfree.", { status: 0, code: "unreachable" });
  };
  const config = () => (cf.configured ? { appId: "TESTAPPID", secretKey: cf.secret, environment: cf.environment, baseUrl: "https://sandbox.cashfree.com/pg" } : null);
  return {
    CASHFREE_API_VERSION: "2025-01-01",
    CHECKOUT_MODE: { TEST: "sandbox", LIVE: "production" },
    CashfreeError,
    getCashfreeConfig: async () => config(),
    isCashfreeConfigured: async () => cf.configured,
    cashfreeRequest: async () => ({}),
    createCashfreeOrder: async (_c, payload) => {
      guard();
      cf.calls.createOrder += 1;
      if (cf.failCreate) throw new CashfreeError(cf.failCreate.message, { status: cf.failCreate.status });
      if (cf.orders.has(payload.order_id)) throw new CashfreeError("order already exists", { status: 409, code: "order_already_exists" });
      const order = {
        cf_order_id: `cf_${++cf.seq}`,
        order_id: payload.order_id,
        order_amount: payload.order_amount,
        order_currency: payload.order_currency,
        order_status: "ACTIVE",
        payment_session_id: `session_${payload.order_id}`,
        customer_details: payload.customer_details,
        order_meta: payload.order_meta,
      };
      cf.orders.set(payload.order_id, order);
      return order;
    },
    fetchCashfreeOrder: async (_c, orderId) => {
      guard();
      const order = cf.orders.get(orderId);
      if (!order) throw new CashfreeError("order not found", { status: 404, code: "order_not_found" });
      return { ...order };
    },
    fetchCashfreePayments: async (_c, orderId) => {
      guard();
      return [...(cf.payments.get(orderId) || [])];
    },
    createCashfreeRefund: async (_c, orderId, payload) => {
      guard();
      cf.calls.createRefund += 1;
      const refund = { cf_refund_id: `rf_${++cf.seq}`, refund_id: payload.refund_id, refund_amount: payload.refund_amount, refund_status: cf.nextRefundStatus };
      cf.refunds.set(`${orderId}:${payload.refund_id}`, refund);
      return refund;
    },
    fetchCashfreeRefund: async (_c, orderId, refundId) => {
      guard();
      const refund = cf.refunds.get(`${orderId}:${refundId}`);
      if (!refund) throw new CashfreeError("refund not found", { status: 404 });
      return { ...refund };
    },
  };
}
