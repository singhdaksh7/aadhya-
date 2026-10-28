import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCashfreeSession, setAccessToken } from "../src/lib/api";

// The server only lets an order's owner start its payment. A logged-in customer's order is linked to their account, so
// the payment call must carry their token or the server answers "Order not found" (404).
describe("createCashfreeSession auth", () => {
  beforeEach(() => { global.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: { paymentSessionId: "s" } }) })); });
  afterEach(() => { setAccessToken(null, "customer"); vi.restoreAllMocks(); });

  it("sends the customer's Bearer token when logged in", async () => {
    setAccessToken("cust-token", "customer");
    await createCashfreeSession("order-1");
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer cust-token");
  });

  it("sends no Authorization header for a guest", async () => {
    await createCashfreeSession("order-1");
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});
