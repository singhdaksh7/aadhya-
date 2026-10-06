import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { CartProvider } from "../src/context/CartContext";
import CheckoutPage from "../src/pages/CheckoutPage";
import { createRazorpayOrder, createOrder, checkoutPreview } from "../src/lib/api";

const product = {
  id: "p1",
  slug: "test-lamp",
  name: "Brass Lamp",
  price: 1500,
  salePrice: null,
  trackInventory: true,
  stockQuantity: 5,
  images: [],
};

const previewResponse = {
  data: {
    items: [
      {
        slug: "test-lamp",
        ok: true,
        issue: null,
        message: null,
        product: { name: "Brass Lamp", slug: "test-lamp" },
        unitPrice: 1500,
        quantity: 1,
        lineTotal: 1500,
      },
    ],
    hasBlockingIssues: false,
    subtotal: 1500,
    shipping: 0,
    tax: 0,
    discount: 0,
    total: 1500,
    currency: "INR",
  },
};

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../src/context/CustomerAuthContext", () => ({
  useCustomerAuth: () => ({ user: null }),
}));

vi.mock("../src/hooks/useSiteSettings", () => ({
  useSiteSettings: () => ({
    general: { storeName: "Aadya" },
    payments: { razorpayEnabled: true, codEnabled: true },
    shipping: { freeShippingThreshold: 1000 },
  }),
}));

vi.mock("../src/lib/razorpay", () => ({
  loadRazorpayScript: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("../src/lib/api", async () => {
  const actual = await vi.importActual("../src/lib/api");
  return {
    ...actual,
    fetchProductBySlug: vi.fn(() => Promise.resolve({ data: product })),
    checkoutPreview: vi.fn(() => Promise.resolve(previewResponse)),
    createOrder: vi.fn(() =>
      Promise.resolve({
        data: { orderId: "order-99", orderNumber: "AAD-2026-999", accessToken: "tok999" },
      })
    ),
    createRazorpayOrder: vi.fn(),
    verifyRazorpayPayment: vi.fn(() => Promise.resolve({ data: { success: true } })),
  };
});

function seedCart() {
  window.localStorage.setItem("aadya.cart.v1", JSON.stringify([{ slug: "test-lamp", quantity: 1 }]));
}

async function fillValidForm(user) {
  await user.type(screen.getByLabelText(/full name/i), "Aarav Sharma");
  await user.type(screen.getByLabelText(/billing email/i), "aarav@example.com");
  await user.type(screen.getByTestId("address-phone"), "9876543210");
  await user.type(screen.getByLabelText(/address line 1/i), "123 Heritage Lane");
  await user.type(screen.getByLabelText(/city/i), "Jaipur");
  await user.type(screen.getByLabelText(/state/i), "Rajasthan");
  await user.type(screen.getByLabelText(/pin code/i), "302001");
}

describe("Razorpay Response Unwrapping & Defensive Validation", () => {
  let mockRazorpayInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    mockRazorpayInstance = {
      open: vi.fn(),
      on: vi.fn(),
    };
    window.Razorpay = vi.fn(function () {
      return mockRazorpayInstance;
    });
  });

  it("unwraps backend response object and passes keyId/amount/currency/order_id to window.Razorpay", async () => {
    seedCart();
    const user = userEvent.setup();

    vi.mocked(createRazorpayOrder).mockResolvedValueOnce({
      keyId: "rzp_live_abc123",
      razorpayOrderId: "order_rzp_999",
      amount: 150000,
      currency: "INR",
      name: "Aadya Storefront",
      description: "Order #AAD-2026-999",
    });

    render(
      <MemoryRouter initialEntries={["/checkout"]}>
        <CartProvider>
          <CheckoutPage />
        </CartProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pay securely via razorpay/i })).toBeInTheDocument();
    });

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /pay securely via razorpay/i }));

    await waitFor(() => {
      expect(window.Razorpay).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "rzp_live_abc123",
          order_id: "order_rzp_999",
          amount: 150000,
          currency: "INR",
        })
      );
      expect(mockRazorpayInstance.open).toHaveBeenCalledTimes(1);
    });
  });

  it("unwraps nested { success: true, data: checkoutOptions } shape if returned by backend", async () => {
    seedCart();
    const user = userEvent.setup();

    vi.mocked(createRazorpayOrder).mockResolvedValueOnce({
      data: {
        keyId: "rzp_test_nested",
        razorpayOrderId: "order_rzp_nested",
        amount: 150000,
        currency: "INR",
      },
    });

    render(
      <MemoryRouter initialEntries={["/checkout"]}>
        <CartProvider>
          <CheckoutPage />
        </CartProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pay securely via razorpay/i })).toBeInTheDocument();
    });

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /pay securely via razorpay/i }));

    await waitFor(() => {
      expect(window.Razorpay).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "rzp_test_nested",
          order_id: "order_rzp_nested",
          amount: 150000,
          currency: "INR",
        })
      );
      expect(mockRazorpayInstance.open).toHaveBeenCalledTimes(1);
    });
  });

  it("shows 'Payment setup returned an invalid response. Please retry.' when response is missing required fields", async () => {
    seedCart();
    const user = userEvent.setup();

    // Malformed response: missing razorpayOrderId and amount
    vi.mocked(createRazorpayOrder).mockResolvedValueOnce({
      keyId: "rzp_test_malformed",
      // missing razorpayOrderId & amount
    });

    render(
      <MemoryRouter initialEntries={["/checkout"]}>
        <CartProvider>
          <CheckoutPage />
        </CartProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pay securely via razorpay/i })).toBeInTheDocument();
    });

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /pay securely via razorpay/i }));

    await waitFor(() => {
      expect(screen.getByText("Payment setup returned an invalid response. Please retry.")).toBeInTheDocument();
      expect(window.Razorpay).not.toHaveBeenCalled();
    });
  });

  it("allows retrying payment after an initial malformed response", async () => {
    seedCart();
    const user = userEvent.setup();

    // First call returns malformed
    vi.mocked(createRazorpayOrder).mockResolvedValueOnce({
      keyId: "rzp_test_malformed",
    });

    render(
      <MemoryRouter initialEntries={["/checkout"]}>
        <CartProvider>
          <CheckoutPage />
        </CartProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pay securely via razorpay/i })).toBeInTheDocument();
    });

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /pay securely via razorpay/i }));

    await waitFor(() => {
      expect(screen.getByText("Payment setup returned an invalid response. Please retry.")).toBeInTheDocument();
    });

    // Second call returns valid options
    vi.mocked(createRazorpayOrder).mockResolvedValueOnce({
      keyId: "rzp_test_valid",
      razorpayOrderId: "order_rzp_valid",
      amount: 150000,
      currency: "INR",
    });

    const retryBtn = screen.getByRole("button", { name: /retry payment/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(window.Razorpay).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "rzp_test_valid",
          order_id: "order_rzp_valid",
        })
      );
      expect(mockRazorpayInstance.open).toHaveBeenCalledTimes(1);
    });
  });

  it("leaves COD checkout completely unaffected", async () => {
    seedCart();
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/checkout"]}>
        <CartProvider>
          <CheckoutPage />
        </CartProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/cash on delivery/i)).toBeInTheDocument();
    });

    // Switch payment method to COD
    const codRadio = screen.getByLabelText(/cash on delivery/i);
    await user.click(codRadio);

    await fillValidForm(user);
    const submitBtn = screen.getByRole("button", { name: /cash on delivery/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(createOrder).toHaveBeenCalledTimes(1);
      expect(createRazorpayOrder).not.toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith(
        "/order/AAD-2026-999/confirmation?token=tok999",
        { replace: true }
      );
    });
  });
});
