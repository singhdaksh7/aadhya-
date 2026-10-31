import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProductDetail from "../src/pages/shop/ProductDetail";

const state = { product: null };
vi.mock("../src/services/api", () => ({
  getProductBySlug: vi.fn(async () => ({ data: state.product })),
  getProducts: vi.fn(async () => ({ data: [] })),
}));
vi.mock("../src/lib/api", () => ({
  listPublicActiveCoupons: vi.fn(async () => ({ data: [] })),
  fetchBookFormats: vi.fn(async () => ({ data: [] })),
  estimateDelivery: vi.fn(),
}));
vi.mock("../src/components/ProductCard", () => ({ default: () => null }));
vi.mock("../src/components/ProductReviews", () => ({ default: () => null }));
vi.mock("../src/components/shop/RecentlyViewed", () => ({ default: () => null }));
vi.mock("../src/lib/analytics", () => ({ trackProductView: vi.fn(), recordRecentlyViewed: vi.fn() }));
vi.mock("../src/context/CartContext", () => ({ useCart: () => ({ addItem: vi.fn(), items: [], setIsOpen: vi.fn() }) }));
vi.mock("../src/context/WishlistContext", () => ({ useWishlist: () => ({ isInWishlist: () => false, toggleWishlist: vi.fn() }) }));
vi.mock("../src/hooks/useSiteSettings", () => ({ useSiteSettings: () => ({ promoStrip: {}, payments: {}, general: {} }) }));

const ETA = { earliest: "2026-11-04T00:00:00.000Z", latest: "2026-11-06T00:00:00.000Z" };
let api;
beforeEach(async () => {
  localStorage.clear();
  api = await import("../src/lib/api");
  api.estimateDelivery.mockReset();
  state.product = { id: "p1", slug: "vase", name: "Clay Vase", category: "Decor", categorySlug: "decor", price: 1000, inStock: true, stockQuantity: 20, images: ["/a.jpg"], shortDescription: "A vase." };
});

const open = async () => {
  render(<MemoryRouter initialEntries={["/shop/vase"]}><Routes><Route path="/shop/:slug" element={<ProductDetail />} /></Routes></MemoryRouter>);
  await screen.findByRole("heading", { level: 1 });
};

describe("Product page Check delivery box", () => {
  it("validates, queries for one unit of this product, shows the ETA and remembers the pincode", async () => {
    api.estimateDelivery.mockResolvedValue({ data: { serviceable: true, estimatedDelivery: ETA, days: { min: 4, max: 6 }, codAvailable: true } });
    await open();
    const user = userEvent.setup();
    const input = screen.getByLabelText("Check delivery");
    await user.type(input, "12345");
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText("Enter a valid 6-digit PIN code")).toBeInTheDocument();
    expect(api.estimateDelivery).not.toHaveBeenCalled();
    await user.type(input, "6");
    await user.click(screen.getByRole("button", { name: "Check" }));
    expect(await screen.findByText(/Estimated delivery: 4 Nov . 6 Nov/)).toBeInTheDocument();
    expect(api.estimateDelivery.mock.calls[0][0]).toEqual({ pincode: "123456", items: [{ slug: "vase", quantity: 1 }] });
    expect(localStorage.getItem("aadhya:lastPincode")).toBe("123456");
  });

  it("prefills the last pincode and shows not-serviceable copy", async () => {
    localStorage.setItem("aadhya:lastPincode", "560001");
    api.estimateDelivery.mockResolvedValue({ data: { serviceable: false, estimatedDelivery: null, days: null, codAvailable: null } });
    await open();
    expect(screen.getByLabelText("Check delivery")).toHaveValue("560001");
    expect(await screen.findByText("We could not confirm delivery to this pincode")).toBeInTheDocument();
  });

  it("shows nothing on an API error", async () => {
    api.estimateDelivery.mockRejectedValue(new Error("down"));
    await open();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Check delivery"), "560001");
    await user.click(screen.getByRole("button", { name: "Check" }));
    await vi.waitFor(() => expect(api.estimateDelivery).toHaveBeenCalled());
    expect(screen.queryByText(/Estimated delivery/)).not.toBeInTheDocument();
    expect(screen.queryByText(/could not confirm/)).not.toBeInTheDocument();
  });
});
