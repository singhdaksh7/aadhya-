import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProductDetail from "../src/pages/shop/ProductDetail";

const state = { product: null };
const addItem = vi.fn();

vi.mock("../src/services/api", () => ({
  getProductBySlug: vi.fn(async () => ({ data: state.product })),
  getProducts: vi.fn(async () => ({ data: [{ id: "r1", slug: "rel", name: "Related Thing" }] })),
}));
vi.mock("../src/lib/api", () => ({ listPublicActiveCoupons: vi.fn(async () => ({ data: [] })), fetchBookFormats: vi.fn(async () => ({ data: [] })) }));
vi.mock("../src/components/ProductCard", () => ({ default: ({ product }) => <div data-testid="product-card">{product.name}</div> }));
vi.mock("../src/components/ProductReviews", () => ({ default: () => <div data-testid="reviews" /> }));
vi.mock("../src/components/shop/RecentlyViewed", () => ({ default: () => null }));
vi.mock("../src/lib/analytics", () => ({ trackProductView: vi.fn(), recordRecentlyViewed: vi.fn() }));
vi.mock("../src/context/CartContext", () => ({ useCart: () => ({ addItem, items: [], setIsOpen: vi.fn() }) }));
vi.mock("../src/context/WishlistContext", () => ({ useWishlist: () => ({ isInWishlist: () => false, toggleWishlist: vi.fn() }) }));
vi.mock("../src/hooks/useSiteSettings", () => ({ useSiteSettings: () => ({ promoStrip: {}, payments: {}, general: {} }) }));

const base = (x = {}) => ({
  id: "p1", slug: "vase", name: "Clay Vase", category: "Decor", categorySlug: "decor", price: 1000, salePrice: null,
  inStock: true, stockQuantity: 20, images: ["/a.jpg", "/b.jpg"], shortDescription: "A vase.", ...x,
});

async function open(product) {
  state.product = product;
  render(
    <MemoryRouter initialEntries={["/shop/vase"]}>
      <Routes><Route path="/shop/:slug" element={<ProductDetail />} /></Routes>
    </MemoryRouter>
  );
  await screen.findByRole("heading", { level: 1 });
}

describe("ProductDetail page", () => {
  beforeEach(() => addItem.mockClear());

  it("uses the site-wide container width", async () => {
    await open(base());
    const c = screen.getByTestId("pdp-container");
    expect(c.className).toContain("max-w-7xl");
    expect(c.className).toContain("px-4");
    expect(c.className).toContain("sm:px-8");
    expect(screen.getByTestId("pdp-hero").className).toContain("lg:grid-cols-2");
  });

  it("renders the specifications table", async () => {
    await open(base({ specifications: [{ label: "Materials", value: "Clay" }, { label: "Finish", value: "Matte" }] }));
    expect(screen.getAllByTestId("spec-item")).toHaveLength(2);
  });

  it("falls back to legacy materials/dimensions", async () => {
    await open(base({ materials: "Brass", dimensions: "10 cm" }));
    expect(screen.getAllByTestId("spec-item").map((i) => i.querySelector("dt").textContent)).toEqual(["Materials", "Dimensions"]);
  });

  it("hides sections without content but keeps shipping & returns and related", async () => {
    await open(base());
    expect(screen.queryByTestId("product-specifications")).toBeNull();
    expect(screen.queryByTestId("pdp-description")).toBeNull();
    expect(screen.queryByTestId("pdp-care")).toBeNull();
    expect(screen.queryByTestId("pdp-rating")).toBeNull();
    expect(screen.getByTestId("pdp-shipping-returns")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("product-card")).toBeInTheDocument());
  });

  it("shows description, care and rating when present", async () => {
    await open(base({ story: "Hand thrown.", careInstructions: "Wipe dry.", reviewCount: 3, averageRating: 4.5 }));
    expect(screen.getByTestId("pdp-description")).toHaveTextContent("Hand thrown.");
    expect(screen.getByTestId("pdp-care")).toHaveTextContent("Wipe dry.");
    expect(screen.getByTestId("pdp-rating")).toHaveTextContent("4.5");
  });

  it("shows sale price with struck-through MRP", async () => {
    await open(base({ salePrice: 800 }));
    expect(screen.getByTestId("pdp-price")).toHaveTextContent("800");
    expect(screen.getAllByText(/1,000/).some((e) => e.className.includes("line-through"))).toBe(true);
  });

  it("variant selection and add to cart", async () => {
    const v = [{ id: "v1", name: "Red" }, { id: "v2", name: "Blue" }];
    await open(base({ variants: v }));
    fireEvent.click(screen.getByRole("button", { name: "Blue" }));
    fireEvent.click(screen.getAllByRole("button", { name: /add to cart/i })[0]);
    expect(addItem).toHaveBeenCalledWith(expect.objectContaining({ slug: "vase" }), 1, v[1], null);
  });

  it("out of stock hides quantity and shows sold out", async () => {
    await open(base({ inStock: false, stockQuantity: 0 }));
    expect(screen.getByText("Currently Sold Out")).toBeInTheDocument();
    expect(screen.queryByLabelText("Increase quantity")).toBeNull();
    expect(screen.getAllByRole("button", { name: /sold out/i }).length).toBeGreaterThan(0);
  });

  it("low stock message", async () => {
    await open(base({ stockQuantity: 3 }));
    expect(screen.getByText(/Only 3 remaining/)).toBeInTheDocument();
  });

  it("never renders internal shipping data", async () => {
    await open(base({
      shipWeightGrams: 4321, shipLengthCm: 7788, shipBreadthCm: 6655, shipHeightCm: 5544,
      shipping: { weightGrams: 4321, lengthCm: 7788 },
      specifications: [{ label: "Materials", value: "Clay" }],
    }));
    const html = document.body.innerHTML;
    for (const n of ["4321", "7788", "6655", "5544", "weightGrams", "shipWeight"]) expect(html).not.toContain(n);
  });
});
