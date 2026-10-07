import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import PromoBanners2Up from "../src/components/PromoBanners2Up";
import ProductCard from "../src/components/ProductCard";
import { CartProvider } from "../src/context/CartContext";
import { WishlistProvider } from "../src/context/WishlistContext";

vi.mock("../src/lib/api", async (importOriginal) => ({ ...(await importOriginal()), resolveMediaUrl: (u) => u, resolveProductImageUrl: (u) => u }));

const wrap = (ui) => render(<BrowserRouter><CartProvider><WishlistProvider>{ui}</WishlistProvider></CartProvider></BrowserRouter>);

describe("image-first editorial banners", () => {
  const cards = [{ id: "1", title: "Home Decor", subtitle: "A long supporting description", eyebrow: "CURATED EDIT", image: "/a.jpg", ctaLabel: "Shop Now", ctaUrl: "/shop/category/home-decor" }];

  it("shows only the image, an optional title and a CTA overlaid on the image, with no subtitle/description anywhere", () => {
    wrap(<PromoBanners2Up promoCards={cards} />);
    expect(screen.queryByText("A long supporting description")).toBeNull();
    // optional eyebrow is allowed, but only on the image
    expect(screen.getByText("CURATED EDIT").closest("[data-testid='promo-banner-overlay']")).not.toBeNull();
    const link = screen.getByRole("link");
    const overlay = screen.getByTestId("promo-banner-overlay");
    expect(link.contains(overlay)).toBe(true);
    expect(overlay.className).toContain("absolute inset-0");
    expect(overlay.querySelector("img")).toBeNull();
    expect(link.querySelector("img")).not.toBeNull();
    // nothing renders after the image block (no content under the card)
    expect(link.lastElementChild).toBe(overlay);
    expect(screen.getByTestId("promo-banner-cta").textContent).toContain("Shop Now");
    expect(link).toHaveAttribute("href", "/shop/category/home-decor");
  });

  it("falls back to 'Shop Now' when no CTA label is configured and still honours alignment/overlay settings", () => {
    wrap(<PromoBanners2Up promoCards={[{ ...cards[0], ctaLabel: "", textAlign: "CENTER", overlayStrength: "STRONG" }]} />);
    expect(screen.getByTestId("promo-banner-cta").textContent).toContain("Shop Now");
    expect(screen.getByTestId("promo-banner-overlay").className).toContain("text-center");
    expect(screen.getByTestId("promo-banner-overlay").className).toContain("from-charcoal/95");
  });
});

describe("minimal product cards", () => {
  const product = { id: "p1", name: "Artisan Vase", slug: "vase", price: 1590, salePrice: 1290, shortDescription: "Hand-thrown vase with a matte glaze", images: ["/v.jpg"], category: { name: "Home Decor", slug: "home-decor" }, averageRating: 4.5, reviewCount: 3, author: "Someone" };

  it("shows only image, name and one price: no category, description, tax note, MRP, rating or author", () => {
    wrap(<ProductCard product={product} />);
    expect(screen.getByText("Artisan Vase")).toBeInTheDocument();
    expect(screen.getByTestId("card-price").textContent).toMatch(/1,290/);
    expect(screen.queryByText(/1,590/)).toBeNull(); // no strike-through MRP
    expect(screen.queryByText("Home Decor")).toBeNull();
    expect(screen.queryByText(/Hand-thrown vase/)).toBeNull();
    expect(screen.queryByText(/Incl\. taxes/i)).toBeNull();
    expect(screen.queryByText(/By Someone/)).toBeNull();
    expect(screen.queryByText("(3)")).toBeNull();
  });

  it("uses the plain price when there is no sale price", () => {
    wrap(<ProductCard product={{ ...product, salePrice: null }} />);
    expect(screen.getByTestId("card-price").textContent).toMatch(/1,590/);
  });
});
