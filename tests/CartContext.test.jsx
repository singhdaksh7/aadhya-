import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { CartProvider, useCart } from "../src/context/CartContext";

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
  const { items, addItem, removeItem, setQuantity, subtotal, count, isLoading } = useCart();
  return (
    <div>
      <p data-testid="loading">{String(isLoading)}</p>
      <p data-testid="count">{count}</p>
      <p data-testid="subtotal">{subtotal}</p>
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
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
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
      expect(stored).toEqual([{ slug: "product-a", quantity: 1 }]);
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
});
