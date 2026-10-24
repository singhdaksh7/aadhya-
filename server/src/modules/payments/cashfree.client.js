import { getCredential, getActiveEnvironment } from "../integrations/credential.service.js";

// Cashfree Payments (PG) REST client. Server-side only: the Secret Key never leaves the backend.
// Docs: https://www.cashfree.com/docs/api-reference/payments/latest/orders/create-order
//
// API version is pinned (Cashfree keeps older versions available) so response/webhook shapes can't
// change underneath us; override with CASHFREE_API_VERSION when upgrading deliberately.
export const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2025-01-01";

const BASE_URL = { TEST: "https://sandbox.cashfree.com/pg", LIVE: "https://api.cashfree.com/pg" };
export const CHECKOUT_MODE = { TEST: "sandbox", LIVE: "production" };

const usable = (data) => Boolean(data?.appId && data?.secretKey);

// Which credentials the storefront uses. The mode is an explicit Admin choice and defaults to TEST
// (sandbox) until the owner switches to LIVE; TEST and LIVE credentials are never mixed.
export async function getCashfreeConfig() {
  const mode = (await getActiveEnvironment("CASHFREE").catch(() => null)) || "TEST";
  const environment = mode === "LIVE" ? "LIVE" : "TEST";
  const selected = await getCredential("CASHFREE", environment).catch(() => null);
  if (!selected || !usable(selected.data)) return null;
  return { appId: selected.data.appId, secretKey: selected.data.secretKey, environment, baseUrl: BASE_URL[environment] };
}

export async function isCashfreeConfigured() {
  return Boolean(await getCashfreeConfig());
}

export class CashfreeError extends Error {
  constructor(message, { status = 0, code = null } = {}) {
    super(message);
    this.name = "CashfreeError";
    this.status = status;
    this.code = code;
  }
}

// Low-level call. Errors carry Cashfree's status/code but never the credentials or request headers.
export async function cashfreeRequest(config, method, path, body, { idempotencyKey } = {}) {
  let res;
  try {
    res = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-version": CASHFREE_API_VERSION,
        "x-client-id": config.appId,
        "x-client-secret": config.secretKey,
        ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new CashfreeError("Could not reach Cashfree.", { status: 0, code: "unreachable" });
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) throw new CashfreeError(json?.message || `Cashfree request failed (${res.status}).`, { status: res.status, code: json?.code || json?.type || null });
  return json;
}

export async function createCashfreeOrder(config, payload, opts) {
  return cashfreeRequest(config, "POST", "/orders", payload, opts);
}
export async function fetchCashfreeOrder(config, orderId) {
  return cashfreeRequest(config, "GET", `/orders/${encodeURIComponent(orderId)}`);
}
export async function fetchCashfreePayments(config, orderId) {
  const list = await cashfreeRequest(config, "GET", `/orders/${encodeURIComponent(orderId)}/payments`);
  return Array.isArray(list) ? list : [];
}
export async function createCashfreeRefund(config, orderId, payload) {
  return cashfreeRequest(config, "POST", `/orders/${encodeURIComponent(orderId)}/refunds`, payload, { idempotencyKey: undefined });
}
export async function fetchCashfreeRefund(config, orderId, refundId) {
  return cashfreeRequest(config, "GET", `/orders/${encodeURIComponent(orderId)}/refunds/${encodeURIComponent(refundId)}`);
}
