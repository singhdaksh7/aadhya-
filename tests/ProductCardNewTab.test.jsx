import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ProductCard from "../src/components/ProductCard";
import { CartProvider } from "../src/context/CartContext";
import { WishlistProvider } from "../src/context/WishlistContext";

const product = { id: "p1", name: "Artisan Vase", slug: "vase", price: 1590, images: ["/v.jpg", "/v2.jpg"] };

function setViewport(width) {
  window.matchMedia = vi.fn((q) => {
    const max = /max-width:\s*([\d.]+)px/.exec(q);
    return { matches: max ? width <= Number(max[1]) : false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  });
}
const wrap = () => render(
  <MemoryRouter initialEntries={["/"]}>
    <CartProvider><WishlistProvider>
      <Routes>
        <Route path="/" element={<ProductCard product={product} />} />
        <Route path="/shop/:slug" element={<div>PDP PAGE</div>} />
      </Routes>
    </WishlistProvider></CartProvider>
  </MemoryRouter>
);
const links = () => screen.getAllByRole("link").filter((a) => a.getAttribute("href") === "/shop/vase");

afterEach(() => { delete window.matchMedia; });

describe("ProductCard new-tab on phones", () => {
  it("390px: image link and title link open in a new tab with noopener noreferrer", () => {
    setViewport(390); wrap();
    expect(links()).toHaveLength(2);
    links().forEach((a) => {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  it.each([768, 1024, 1280])("%ipx: stays same-tab", (w) => {
    setViewport(w); wrap();
    links().forEach((a) => { expect(a).not.toHaveAttribute("target"); expect(a).not.toHaveAttribute("rel"); });
  });

  it("no matchMedia (jsdom) defaults to same-tab", () => {
    wrap();
    links().forEach((a) => expect(a).not.toHaveAttribute("target"));
  });

  it("wishlist and add-to-cart buttons never navigate to the product", () => {
    setViewport(390); wrap();
    fireEvent.click(screen.getByRole("button", { name: /Add to Wishlist/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(screen.queryByText("PDP PAGE")).not.toBeInTheDocument();
  });

  it("desktop same-tab click still navigates in-app", () => {
    setViewport(1280); wrap();
    fireEvent.click(links()[0]);
    expect(screen.getByText("PDP PAGE")).toBeInTheDocument();
  });
});
