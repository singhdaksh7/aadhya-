import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import HomepageRenderer from "../src/components/HomepageRenderer";
import { CartProvider } from "../src/context/CartContext";
import { WishlistProvider } from "../src/context/WishlistContext";

function withProviders(children) {
  return (
    <BrowserRouter>
      <CartProvider>
        <WishlistProvider>{children}</WishlistProvider>
      </CartProvider>
    </BrowserRouter>
  );
}

describe("Phase F.1 dynamic homepage content", () => {
  it("renders CMS supplied trust, shop, books, editorial, newsletter, and CTA copy", () => {
    const sampleProduct = { id: "cp1", name: "Sample Product", slug: "sample-product", price: 500, images: ["/p.jpg"] };
    render(withProviders(<HomepageRenderer sections={[
      { id: "trust", type: "TRUST_STRIP", settings: { items: [{ id: "t", title: "Custom trust", description: "Custom assurance", icon: "heart" }] } },
      { id: "look", type: "SHOP_THE_LOOK", settings: { eyebrow: "Custom eyebrow", title: "Custom look", ctaLabel: "Open edit", items: [{ id: "l", title: "Custom card", tagline: "Custom tagline", image: "/image.jpg", url: "/collections/custom" }] } },
      { id: "books", type: "BOOKS_SHELF", settings: { eyebrow: "Book eyebrow", title: "Custom shelf", ctaLabel: "Read all" } },
      { id: "editorial", type: "EDITORIAL_BRAND", settings: { eyebrow: "Editorial eyebrow", title: "Custom story", body: "Custom editorial body", image: "/image.jpg", features: [] } },
      { id: "newsletter", type: "NEWSLETTER", settings: { eyebrow: "Circle", title: "Custom newsletter", description: "Custom newsletter text", buttonLabel: "Join now", placeholder: "Your address" } },
      { id: "new", type: "NEW_ARRIVALS", settings: { title: "Custom arrivals", ctaLabel: "See fresh" }, products: [sampleProduct] },
      { id: "best", type: "BEST_SELLERS", settings: { title: "Custom best", ctaLabel: "See favourites" }, products: [sampleProduct] },
      { id: "featured", type: "FEATURED_COLLECTION", settings: { title: "Custom feature", ctaLabel: "Open feature", ctaUrl: "/collections/selected" } },
    ]} featuredCollection={{ name: "Fallback collection", slug: "fallback", description: "Fallback description" }} booksList={[{ id: "b1", name: "Custom shelf book", author: "Author", price: 400, shortDescription: "desc", images: ["/b.jpg"] }]} />));
    ["Custom trust", "Custom assurance", "Custom look", "Custom card", "Open edit", "Custom shelf", "Read all", "Custom story", "Custom editorial body", "Custom newsletter", "Join now", "Custom arrivals", "See fresh", "Custom best", "See favourites"].forEach((copy) => expect(screen.getByText(copy)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /open feature/i })).toHaveAttribute("href", "/collections/selected");
  });

  it("hides New Arrivals / Best Sellers / Books sections instead of showing an empty heading when no items are supplied", () => {
    render(withProviders(<HomepageRenderer sections={[
      { id: "new", type: "NEW_ARRIVALS", settings: { title: "Custom arrivals" } },
      { id: "best", type: "BEST_SELLERS", settings: { title: "Custom best" } },
      { id: "books", type: "BOOKS_SHELF", settings: { title: "Custom shelf" } },
    ]} />));
    expect(screen.queryByText("Custom arrivals")).not.toBeInTheDocument();
    expect(screen.queryByText("Custom best")).not.toBeInTheDocument();
    expect(screen.queryByText("Custom shelf")).not.toBeInTheDocument();
  });
});
