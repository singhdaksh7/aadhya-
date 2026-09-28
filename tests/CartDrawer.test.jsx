import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { CartProvider, useCart } from "../src/context/CartContext";
import CartDrawer from "../src/components/CartDrawer";

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

function OpenDrawerOnMount() {
  const { setIsOpen, addItem } = useCart();
  return (
    <button
      onClick={async () => {
        await addItem(product);
        setIsOpen(true);
      }}
    >
      seed-and-open
    </button>
  );
}

function Harness() {
  return (
    <MemoryRouter>
      <CartProvider>
        <OpenDrawerOnMount />
        <CartDrawer />
      </CartProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  validateCouponCode.mockReset();
});

describe("CartDrawer coupon UI", () => {
  it("shows a promo code field and applies a valid coupon using the backend total", async () => {
    validateCouponCode.mockResolvedValue({
      data: { code: "SAVE10", discountAmount: 10, discountType: "FIXED" },
    });

    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("seed-and-open"));
    await waitFor(() => expect(screen.getByText("Test Basket")).toBeInTheDocument());

    expect(screen.getByText("Have a promo code?")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Coupon code"), "SAVE10");
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(await screen.findByText("SAVE10 applied")).toBeInTheDocument();
    expect(screen.getByText("You saved ₹10")).toBeInTheDocument();
  });

  it("shows the backend's error message for an invalid coupon", async () => {
    validateCouponCode.mockRejectedValue(new Error("Invalid coupon code"));

    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("seed-and-open"));
    await waitFor(() => expect(screen.getByText("Test Basket")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Coupon code"), "BADCODE");
    await user.click(screen.getByRole("button", { name: /apply/i }));

    expect(await screen.findByText("Invalid coupon code")).toBeInTheDocument();
    expect(screen.queryByText(/applied/i)).not.toBeInTheDocument();
  });

  it("removing a coupon restores the promo code entry form", async () => {
    validateCouponCode.mockResolvedValue({
      data: { code: "SAVE10", discountAmount: 10, discountType: "FIXED" },
    });

    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("seed-and-open"));
    await waitFor(() => expect(screen.getByText("Test Basket")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Coupon code"), "SAVE10");
    await user.click(screen.getByRole("button", { name: /apply/i }));
    expect(await screen.findByText("SAVE10 applied")).toBeInTheDocument();

    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    await user.click(removeButtons[removeButtons.length - 1]);

    expect(screen.queryByText("SAVE10 applied")).not.toBeInTheDocument();
    expect(screen.getByText("Have a promo code?")).toBeInTheDocument();
  });
});
