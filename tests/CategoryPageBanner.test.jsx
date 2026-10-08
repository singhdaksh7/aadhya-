import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProductCatalog from "../src/pages/shop/ProductCatalog";

const state = { categories: [] };
vi.mock("../src/components/ProductCard", () => ({ default: ({ product }) => <div data-testid="product-card">{product.name}</div> }));
vi.mock("../src/services/api", () => ({
  getProducts: vi.fn(async () => ({ data: [{ id: "p1", name: "Vase" }] })),
  getCategories: vi.fn(async () => ({ data: state.categories })),
  getCollections: vi.fn(async () => ({ data: [] })),
}));

const renderCategory = () =>
  render(
    <MemoryRouter initialEntries={["/shop/category/home-decor"]}>
      <Routes>
        <Route path="/shop/category/:slug" element={<ProductCatalog lockedCategory="home-decor" title="Home Decor" />} />
      </Routes>
    </MemoryRouter>,
  );

const cat = (extra = {}) => ({ id: "c1", name: "Home Decor", slug: "home-decor", description: "Objects for the home", children: [], ...extra });

describe("category page banner", () => {
  beforeEach(() => { state.categories = []; });

  it("renders the desktop banner above the breadcrumbs/title when set", async () => {
    state.categories = [cat({ desktopBanner: "/uploads/products/decor.jpg" })];
    renderCategory();
    const banner = await screen.findByTestId("category-banner");
    const img = banner.querySelector("img");
    expect(img.getAttribute("src")).toMatch(/\/uploads\/products\/decor\.jpg$/);
    expect(img.className).toContain("object-cover");
    expect(banner.querySelector("source")).toBeNull();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Home Decor");
    expect(banner.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await screen.findByTestId("product-card")).toBeInTheDocument();
  });

  it("uses mobileBanner for small screens when present, with desktopBanner as the default image", async () => {
    state.categories = [cat({ desktopBanner: "/uploads/products/d.jpg", mobileBanner: "/uploads/products/m.jpg" })];
    renderCategory();
    const banner = await screen.findByTestId("category-banner");
    expect(banner.querySelector("source").getAttribute("srcset")).toMatch(/m\.jpg$/);
    expect(banner.querySelector("img").getAttribute("src")).toMatch(/d\.jpg$/);
  });

  it("falls back to desktopBanner on mobile when there is no mobileBanner", async () => {
    state.categories = [cat({ desktopBanner: "https://cdn.example.com/d.jpg", mobileBanner: null })];
    renderCategory();
    const banner = await screen.findByTestId("category-banner");
    expect(banner.querySelector("source")).toBeNull();
    expect(banner.querySelector("img").getAttribute("src")).toBe("https://cdn.example.com/d.jpg");
  });

  it("shows no banner and keeps the text header when the category has no banner", async () => {
    state.categories = [cat({ desktopBanner: null, mobileBanner: null })];
    renderCategory();
    expect(await screen.findByTestId("product-card")).toBeInTheDocument();
    expect(screen.queryByTestId("category-banner")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Home Decor");
    expect(screen.getByText("Objects for the home")).toBeInTheDocument();
  });
});
