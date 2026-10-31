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

  it("renders the title and breadcrumbs first, then the desktop banner, then the products", async () => {
    state.categories = [cat({ desktopBanner: "/uploads/products/decor.jpg" })];
    renderCategory();
    const banner = await screen.findByTestId("category-banner");
    const img = banner.querySelector("img");
    expect(img.getAttribute("src")).toMatch(/\/uploads\/products\/decor\.jpg$/);
    expect(img.className).toContain("object-contain");
    expect(img.className).not.toContain("object-cover");
    expect(banner.querySelector("source")).toBeNull();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Home Decor");
    // Order: breadcrumbs + title + description, then the banner, then the products.
    expect(heading.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const card = await screen.findByTestId("product-card");
    expect(banner.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("orders the page: breadcrumb/title/description, banner, subcategories, then products", async () => {
    state.categories = [cat({ desktopBanner: "/uploads/products/decor.jpg", children: [{ id: "c2", name: "Vases", slug: "vases", parentId: "c1", isActive: true }] }), { id: "c2", name: "Vases", slug: "vases", parentId: "c1", isActive: true, children: [] }];
    renderCategory();
    const banner = await screen.findByTestId("category-banner");
    const heading = screen.getByRole("heading", { level: 1 });
    const description = screen.getByText("Objects for the home");
    const tiles = await screen.findByTestId("subcategory-tiles");
    const card = await screen.findByTestId("product-card");
    const before = (a, b) => expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    before(heading, description);
    before(description, banner);
    before(banner, tiles);
    before(tiles, card);
  });

  it("keeps the title block and the banner close together (tight gap, no extra top padding)", async () => {
    state.categories = [cat({ desktopBanner: "/uploads/products/decor.jpg" })];
    renderCategory();
    const banner = await screen.findByTestId("category-banner");
    const header = screen.getByRole("heading", { level: 1 }).closest("section");
    expect(banner.parentElement).toBe(header.parentElement);
    expect(banner.parentElement.className).toContain("space-y-4");
    expect(banner.className).not.toContain("pt-6");
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
