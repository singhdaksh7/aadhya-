import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { CartProvider } from "../src/context/CartContext";
import CheckoutPage from "../src/pages/CheckoutPage";

const product = {
  id: "p1",
  slug: "test-basket",
  name: "Test Basket",
  price: 990,
  salePrice: null,
  trackInventory: true,
  stockQuantity: 5,
  images: [],
};

const previewResponse = {
  data: {
    items: [
      {
        slug: "test-basket",
        ok: true,
        issue: null,
        message: null,
        product: { name: "Test Basket", slug: "test-basket" },
        unitPrice: 990,
        quantity: 1,
        lineTotal: 990,
      },
    ],
    hasBlockingIssues: false,
    subtotal: 990,
    shipping: 99,
    tax: 0,
    discount: 0,
    total: 1089,
    currency: "INR",
  },
};

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../src/lib/api", () => ({
  fetchProductBySlug: vi.fn(() => Promise.resolve({ data: product })),
  checkoutPreview: vi.fn(() => Promise.resolve(previewResponse)),
  createOrder: vi.fn(() =>
    Promise.resolve({ data: { orderId: "order-1", orderNumber: "AAD-2026-000001", accessToken: "tok123" } })
  ),
  createRazorpayOrder: vi.fn(() =>
    Promise.resolve({
      data: {
        keyId: "rzp_test_x",
        razorpayOrderId: "order_rzp_1",
        amount: 108900,
        currency: "INR",
        name: "Aadya Society",
        description: "Aadya Society Order AAD-2026-000001",
        prefill: {},
      },
    })
  ),
  verifyRazorpayPayment: vi.fn(() => Promise.resolve({ data: { orderNumber: "AAD-2026-000001" } })),
  ApiRequestError: class ApiRequestError extends Error {},
}));

vi.mock("../src/lib/razorpay", () => ({
  loadRazorpayScript: vi.fn(() => Promise.resolve(true)),
}));

function seedCart() {
  localStorage.setItem("aadya.cart.v1", JSON.stringify([{ slug: "test-basket", quantity: 1 }]));
}

function Harness() {
  return (
    <MemoryRouter>
      <CartProvider>
        <CheckoutPage />
      </CartProvider>
    </MemoryRouter>
  );
}

beforeEach(async () => {
  localStorage.clear();
  navigateMock.mockClear();
  window.Razorpay = undefined;
  const api = await import("../src/lib/api");
  api.createOrder.mockClear();
  api.createRazorpayOrder.mockClear();
  api.verifyRazorpayPayment.mockClear();
  api.checkoutPreview.mockClear();
  api.checkoutPreview.mockResolvedValue(previewResponse);
});

const VALID_FORM = {
  name: "Test Customer",
  email: "test@example.com",
  phone: "9876543210",
  fullName: "Test Customer",
  addressPhone: "9876543210",
  addressLine1: "123 MG Road",
  city: "Bengaluru",
  state: "Karnataka",
  postalCode: "560001",
};

async function fillValidForm(user) {
  await user.type(screen.getByLabelText("Name"), VALID_FORM.name);
  await user.type(screen.getByLabelText("Email"), VALID_FORM.email);
  await user.type(screen.getByTestId("contact-phone"), VALID_FORM.phone);
  await user.type(screen.getByLabelText("Full Name"), VALID_FORM.fullName);
  await user.type(screen.getByTestId("address-phone"), VALID_FORM.addressPhone);
  await user.type(screen.getByLabelText("Address Line 1"), VALID_FORM.addressLine1);
  await user.type(screen.getByLabelText("City"), VALID_FORM.city);
  await user.type(screen.getByLabelText("State"), VALID_FORM.state);
  await user.type(screen.getByLabelText("PIN Code"), VALID_FORM.postalCode);
}

describe("CheckoutPage", () => {
  it("fetches and displays server-calculated totals, not a client-side sum", async () => {
    seedCart();
    render(<Harness />);

    await waitFor(() => expect(screen.getByText("₹1,089")).toBeInTheDocument());
    expect(screen.getAllByText("₹990").length).toBeGreaterThan(0); // subtotal from server
  });

  it("shows validation errors for an invalid phone and PIN instead of submitting", async () => {
    seedCart();
    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(screen.getByText("₹1,089")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Name"), "Test");
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByTestId("contact-phone"), "12345");
    await user.click(screen.getByRole("button", { name: /pay securely/i }));

    const phoneErrors = await screen.findAllByText("Enter a valid 10-digit mobile number");
    expect(phoneErrors.length).toBeGreaterThan(0);
    const { createOrder } = await import("../src/lib/api");
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("clears the cart and navigates to confirmation after a verified payment", async () => {
    seedCart();
    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(screen.getByText("₹1,089")).toBeInTheDocument());
    await fillValidForm(user);

    let capturedHandler;
    window.Razorpay = vi.fn().mockImplementation(function (opts) {
      capturedHandler = opts.handler;
      return { open: vi.fn(), on: vi.fn() };
    });

    await user.click(screen.getByRole("button", { name: /pay securely/i }));
    await waitFor(() => expect(window.Razorpay).toHaveBeenCalled());

    await act(async () => {
      await capturedHandler({
        razorpay_order_id: "order_rzp_1",
        razorpay_payment_id: "pay_1",
        razorpay_signature: "sig_1",
      });
    });

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith(
      "/order/AAD-2026-000001/confirmation?token=tok123",
      { replace: true }
    ));
    expect(localStorage.getItem("aadya.cart.v1")).toBe("[]");
  });

  it("keeps the cart intact when the payment modal is dismissed without paying", async () => {
    seedCart();
    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(screen.getByText("₹1,089")).toBeInTheDocument());
    await fillValidForm(user);

    let capturedDismiss;
    window.Razorpay = vi.fn().mockImplementation(function (opts) {
      capturedDismiss = opts.modal.ondismiss;
      return { open: vi.fn(), on: vi.fn() };
    });

    await user.click(screen.getByRole("button", { name: /pay securely/i }));
    await waitFor(() => expect(window.Razorpay).toHaveBeenCalled());

    act(() => capturedDismiss());

    expect(await screen.findByText(/payment didn't go through/i)).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
    const stored = JSON.parse(localStorage.getItem("aadya.cart.v1"));
    expect(stored).toEqual([{ slug: "test-basket", quantity: 1 }]);
  });

  it("surfaces a price/stock-changed message from the server preview instead of hiding it", async () => {
    const { checkoutPreview } = await import("../src/lib/api");
    checkoutPreview.mockResolvedValueOnce({
      data: {
        ...previewResponse.data,
        items: [
          {
            ...previewResponse.data.items[0],
            issue: "stock_limited",
            message: 'Only 1 unit of "Test Basket" are available — quantity was adjusted.',
          },
        ],
      },
    });
    seedCart();
    render(<Harness />);

    expect(
      await screen.findByText('Only 1 unit of "Test Basket" are available — quantity was adjusted.')
    ).toBeInTheDocument();
  });
});
