import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { CartProvider, useCart } from "../src/context/CartContext";

const validateCouponCode = vi.fn();

vi.mock("../src/lib/api", () => ({
  fetchProductBySlug: vi.fn((slug) =>
    Promise.resolve({
      data: {
        id: slug,
        slug,
        name: "Product A",
        price: 100,
        salePrice: null,
        trackInventory: true,
        stockQuantity: 5,
        images: [],
      },
    })
  ),
  validateCouponCode: (...args) => validateCouponCode(...args),
}));

const productA = {
  id: "a",
  slug: "product-a",
  name: "Product A",
  price: 100,
  salePrice: null,
  trackInventory: true,
  stockQuantity: 5,
  images: [],
};

function TestHarness() {
  const {
    items,
    addItem,
    removeItem,
    setQuantity,
    subtotal,
    count,
    isLoading,
    appliedCoupon,
    couponError,
    applyCoupon,
    removeCoupon,
  } = useCart();
  return (
    <div>
      <p data-testid="loading">{String(isLoading)}</p>
      <p data-testid="count">{count}</p>
      <p data-testid="subtotal">{subtotal}</p>
      <p data-testid="coupon-code">{appliedCoupon?.code || ""}</p>
      <p data-testid="coupon-discount">{appliedCoupon?.discountAmount ?? ""}</p>
      <p data-testid="coupon-error">{couponError || ""}</p>
      <ul>
        {items.map((i) => (
          <li key={i.product.slug} data-testid="line">
            {i.product.name} x{i.quantity}
          </li>
        ))}
      </ul>
      <button onClick={() => addItem(productA)}>add</button>
      <button onClick={() => setQuantity("product-a", 3)}>set-3</button>
      <button onClick={() => removeItem("product-a")}>remove</button>
      <button onClick={() => applyCoupon("SAVE10")}>apply-coupon</button>
      <button onClick={() => applyCoupon("")}>apply-empty-coupon</button>
      <button onClick={removeCoupon}>remove-coupon</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  validateCouponCode.mockReset();
});

describe("CartContext", () => {
  it("adds an item and computes subtotal/count", async () => {
    render(
      <CartProvider>
        <TestHarness />
      </CartProvider>
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    act(() => screen.getByText("add").click());

    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("subtotal")).toHaveTextContent("100");
    expect(screen.getByText("Product A x1")).toBeInTheDocument();
  });

  it("updates quantity and clamps to available stock", async () => {
    render(
      <CartProvider>
        <TestHarness />
      </CartProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    act(() => screen.getByText("add").click());
    act(() => screen.getByText("set-3").click());

    expect(screen.getByText("Product A x3")).toBeInTheDocument();
    expect(screen.getByTestId("subtotal")).toHaveTextContent("300");
  });

  it("removes an item", async () => {
    render(
      <CartProvider>
        <TestHarness />
      </CartProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    act(() => screen.getByText("add").click());
    act(() => screen.getByText("remove").click());

    expect(screen.queryByTestId("line")).not.toBeInTheDocument();
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("persists the cart to localStorage and re-resolves it from the server on remount", async () => {
    const { unmount } = render(
      <CartProvider>
        <TestHarness />
      </CartProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    act(() => screen.getByText("add").click());

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem("aadya.cart.v1"));
      expect(stored).toEqual([{ slug: "product-a", quantity: 1, bookFormat: null }]);
    });

    unmount();

    render(
      <CartProvider>
        <TestHarness />
      </CartProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByText("Product A x1")).toBeInTheDocument();
  });

  it("applies a valid coupon and exposes the server-calculated discount", async () => {
    validateCouponCode.mockResolvedValue({
      data: { code: "SAVE10", discountAmount: 10, discountType: "FIXED" },
    });

    render(
      <CartProvider>
        <TestHarness />
      </CartProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    act(() => screen.getByText("add").click());

    await act(async () => {
      screen.getByText("apply-coupon").click();
    });

    expect(validateCouponCode).toHaveBeenCalledWith("SAVE10", [
      { slug: "product-a", variantId: null, quantity: 1 },
    ]);
    expect(screen.getByTestId("coupon-code")).toHaveTextContent("SAVE10");
    expect(screen.getByTestId("coupon-discount")).toHaveTextContent("10");
    expect(screen.getByTestId("coupon-error")).toHaveTextContent("");
  });

  it("surfaces the backend's error message for an invalid/expired/below-minimum coupon", async () => {
    validateCouponCode.mockRejectedValue(new Error("Coupon has expired"));

    render(
      <CartProvider>
        <TestHarness />
      </CartProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    await act(async () => {
      screen.getByText("apply-coupon").click();
    });

    expect(screen.getByTestId("coupon-error")).toHaveTextContent("Coupon has expired");
    expect(screen.getByTestId("coupon-code")).toHaveTextContent("");
  });

  it("rejects an empty coupon code without calling the backend", async () => {
    render(
      <CartProvider>
        <TestHarness />
      </CartProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    await act(async () => {
      screen.getByText("apply-empty-coupon").click();
    });

    expect(validateCouponCode).not.toHaveBeenCalled();
    expect(screen.getByTestId("coupon-error")).toHaveTextContent("Please enter a valid coupon code");
  });

  it("removing a coupon clears the applied discount and restores totals", async () => {
    validateCouponCode.mockResolvedValue({
      data: { code: "SAVE10", discountAmount: 10, discountType: "FIXED" },
    });

    render(
      <CartProvider>
        <TestHarness />
      </CartProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    await act(async () => {
      screen.getByText("apply-coupon").click();
    });
    expect(screen.getByTestId("coupon-code")).toHaveTextContent("SAVE10");

    act(() => screen.getByText("remove-coupon").click());

    expect(screen.getByTestId("coupon-code")).toHaveTextContent("");
    expect(screen.getByTestId("coupon-discount")).toHaveTextContent("");
  });

  it("persists the applied coupon in sessionStorage across remounts", async () => {
    validateCouponCode.mockResolvedValue({
      data: { code: "SAVE10", discountAmount: 10, discountType: "FIXED" },
    });

    const { unmount } = render(
      <CartProvider>
        <TestHarness />
      </CartProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    await act(async () => {
      screen.getByText("apply-coupon").click();
    });
    expect(screen.getByTestId("coupon-code")).toHaveTextContent("SAVE10");

    unmount();

    render(
      <CartProvider>
        <TestHarness />
      </CartProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("coupon-code")).toHaveTextContent("SAVE10");
  });
});
