import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProductCard from "../src/components/ProductCard";
import { CartProvider } from "../src/context/CartContext";
import { WishlistProvider } from "../src/context/WishlistContext";

const product = { id: "p1", name: "Artisan Vase", slug: "vase", price: 1590, salePrice: 1290, isNew: true, isBestSeller: true, shortDescription: "Hand-thrown", images: ["/v.jpg", "/v2.jpg"], category: { name: "Home Decor" } };
const wrap = (p = product) => render(<MemoryRouter><CartProvider><WishlistProvider><ProductCard product={p} /></WishlistProvider></CartProvider></MemoryRouter>);

describe("editorial product card", () => {
  it("has no enclosing bordered/shadowed box around image + text", () => {
    wrap();
    const root = screen.getByTestId("product-card-root");
    expect(root.className).not.toMatch(/\bborder\b|border-\[|shadow|store-surface|bg-/);
    expect(root.className).not.toContain("rounded");
  });

  it("keeps badges, wishlist heart and the image inside the rounded media area", () => {
    wrap();
    const media = within(screen.getByTestId("product-card-media"));
    expect(screen.getByTestId("product-card-media").className).toContain("rounded-xl");
    expect(media.getByText("New")).toBeInTheDocument();
    expect(media.getByText("Best Seller")).toBeInTheDocument();
    expect(media.getByText(/% OFF/)).toBeInTheDocument();
    expect(media.getByRole("button", { name: /Add to Wishlist/ })).toBeInTheDocument();
    expect(media.getAllByRole("img").length).toBeGreaterThan(0);
  });

  it("shows only the name and one price beneath the image: no description, category, tax note or MRP", () => {
    wrap();
    expect(screen.getByText("Artisan Vase")).toBeInTheDocument();
    expect(screen.getByTestId("card-price").textContent).toMatch(/1,290/);
    expect(screen.queryByText(/1,590/)).toBeNull();
    expect(screen.queryByText(/Hand-thrown/)).toBeNull();
    expect(screen.queryByText("Home Decor")).toBeNull();
    expect(screen.queryByText(/Incl\. taxes/i)).toBeNull();
    const media = screen.getByTestId("product-card-media");
    expect(media.contains(screen.getByText("Artisan Vase"))).toBe(false);
    expect(media.contains(screen.getByTestId("card-price"))).toBe(false);
  });
});
