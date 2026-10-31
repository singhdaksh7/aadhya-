import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { CartProvider } from "../src/context/CartContext";
import CheckoutPage from "../src/pages/CheckoutPage";

const product = { id: "p1", slug: "test-basket", name: "Test Basket", price: 990, salePrice: null, trackInventory: true, stockQuantity: 5, images: [] };
const previewResponse = {
  data: { items: [{ slug: "test-basket", ok: true, product: { name: "Test Basket", slug: "test-basket" }, unitPrice: 990, quantity: 1, lineTotal: 990 }], hasBlockingIssues: false, subtotal: 990, shipping: 99, tax: 0, discount: 0, total: 1089, currency: "INR" },
};

vi.mock("react-router-dom", async () => ({ ...(await vi.importActual("react-router-dom")), useNavigate: () => vi.fn() }));
vi.mock("../src/lib/api", () => ({
  fetchProductBySlug: vi.fn(() => Promise.resolve({ data: product })),
  checkoutPreview: vi.fn(() => Promise.resolve(previewResponse)),
  estimateDelivery: vi.fn(),
  createOrder: vi.fn(),
  createCashfreeSession: vi.fn(),
  verifyCashfreePayment: vi.fn(),
  validateCouponCode: vi.fn(),
  ApiRequestError: class ApiRequestError extends Error {},
}));
vi.mock("../src/lib/cashfree", () => ({ loadCashfreeScript: vi.fn(() => Promise.resolve(true)) }));

const ETA = { earliest: "2026-11-04T00:00:00.000Z", latest: "2026-11-06T00:00:00.000Z" };
let api;
beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem("aadya.cart.v1", JSON.stringify([{ slug: "test-basket", quantity: 1 }]));
  api = await import("../src/lib/api");
  api.estimateDelivery.mockReset();
});

const open = () => render(<MemoryRouter><CartProvider><CheckoutPage /></CartProvider></MemoryRouter>);
const typePin = async (pin) => userEvent.setup().type(await screen.findByLabelText("PIN Code"), pin);

describe("Checkout delivery estimate", () => {
  it("shows the estimated window for a serviceable pincode and sends the cart items", async () => {
    api.estimateDelivery.mockResolvedValue({ success: true, data: { serviceable: true, estimatedDelivery: ETA, days: { min: 4, max: 6 }, codAvailable: true } });
    open();
    await typePin("560001");
    expect(await screen.findByText(/Estimated delivery: 4 Nov . 6 Nov/)).toBeInTheDocument();
    expect(api.estimateDelivery).toHaveBeenCalledTimes(1);
    expect(api.estimateDelivery.mock.calls[0][0]).toMatchObject({ pincode: "560001", items: [{ slug: "test-basket", quantity: 1 }] });
  });

  it("is informational when not serviceable", async () => {
    api.estimateDelivery.mockResolvedValue({ data: { serviceable: false, estimatedDelivery: null, days: null, codAvailable: null } });
    open();
    await typePin("560001");
    expect(await screen.findByText("We could not confirm delivery to this pincode")).toBeInTheDocument();
  });

  it("stays silent on network / 429 errors", async () => {
    api.estimateDelivery.mockRejectedValue(Object.assign(new Error("Too many"), { status: 429 }));
    open();
    await typePin("560001");
    await waitFor(() => expect(api.estimateDelivery).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("checkout-delivery-estimate")).not.toBeInTheDocument();
    expect(screen.queryByText(/could not confirm/)).not.toBeInTheDocument();
  });

  it("does not call the API for an incomplete pincode", async () => {
    open();
    await typePin("5600");
    await new Promise((r) => setTimeout(r, 600));
    expect(api.estimateDelivery).not.toHaveBeenCalled();
  });

  it("shows a gentle note when COD is selected and unavailable", async () => {
    api.estimateDelivery.mockResolvedValue({ data: { serviceable: true, estimatedDelivery: ETA, days: { min: 4, max: 6 }, codAvailable: false } });
    open();
    await userEvent.setup().click(await screen.findByLabelText(/Cash on Delivery/i));
    await typePin("560001");
    expect(await screen.findByText(/Cash on delivery may not be available/i)).toBeInTheDocument();
  });
});
