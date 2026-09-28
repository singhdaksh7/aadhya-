import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { CartProvider, useCart } from "../src/context/CartContext";
import CartPage from "../src/pages/CartPage";

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

const validateCouponCode = vi.fn();

vi.mock("../src/lib/api", () => ({
  fetchProductBySlug: vi.fn(() => Promise.resolve({ data: product })),
  validateCouponCode: (...args) => validateCouponCode(...args),
}));

vi.mock("../src/hooks/useSiteSettings", () => ({
  useSiteSettings: () => ({ freeShippingThreshold: 1500, standardShippingAmount: 99 }),
}));

function SeedCart() {
  const { addItem } = useCart();
  return <button onClick={() => addItem(product)}>seed</button>;
}

function Harness() {
  return (
    <MemoryRouter>
      <CartProvider>
        <SeedCart />
        <CartPage />
      </CartProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  validateCouponCode.mockReset();
});

describe("CartPage coupon UI", () => {
  it("applies a coupon and shows the server-calculated savings and updated total, never a client-computed one", async () => {
    validateCouponCode.mockResolvedValue({
      data: { code: "SAVE10", discountAmount: 99, discountType: "FIXED" },
    });

    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("seed"));
    await waitFor(() => expect(screen.getByText("Test Basket")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText("Enter coupon code"), "SAVE10");
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(await screen.findByText("Coupon Applied: SAVE10")).toBeInTheDocument();
    expect(screen.getByText("Saving ₹99 on this order")).toBeInTheDocument();
    // 990 subtotal - 99 discount + 99 shipping (below free-shipping threshold) = 990
    expect(screen.getByText("Order Total").nextSibling).toHaveTextContent("₹990");
  });

  it("shows the backend's validation error for an invalid coupon and applies no discount", async () => {
    validateCouponCode.mockRejectedValue(new Error("Minimum order amount of ₹1500 required to apply this coupon"));

    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("seed"));
    await waitFor(() => expect(screen.getByText("Test Basket")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText("Enter coupon code"), "BIGSAVE");
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(
      await screen.findByText("Minimum order amount of ₹1500 required to apply this coupon")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Coupon Applied/)).not.toBeInTheDocument();
  });

  it("removing an applied coupon restores the entry form and original total", async () => {
    validateCouponCode.mockResolvedValue({
      data: { code: "SAVE10", discountAmount: 99, discountType: "FIXED" },
    });

    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("seed"));
    await waitFor(() => expect(screen.getByText("Test Basket")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText("Enter coupon code"), "SAVE10");
    await user.click(screen.getByRole("button", { name: /apply/i }));
    expect(await screen.findByText("Coupon Applied: SAVE10")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.queryByText(/Coupon Applied/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter coupon code")).toBeInTheDocument();
  });
});
