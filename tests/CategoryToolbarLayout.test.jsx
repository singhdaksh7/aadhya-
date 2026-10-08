import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProductCatalog from "../src/pages/shop/ProductCatalog";

vi.mock("../src/components/ProductCard", () => ({ default: ({ product }) => <div data-testid="product-card">{product.name}</div> }));
vi.mock("../src/services/api", () => ({
  getProducts: vi.fn(async () => ({ data: [{ id: "p1", name: "Vase" }, { id: "p2", name: "Bowl" }] })),
  getCategories: vi.fn(async () => ({ data: [{ id: "c1", name: "Home Decor", slug: "home-decor", parentId: null, isActive: true }] })),
  getCollections: vi.fn(async () => ({ data: [] })),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/shop/category/home-decor"]}>
      <Routes><Route path="/shop/category/:slug" element={<ProductCatalog lockedCategory="home-decor" title="Home Decor" />} /></Routes>
    </MemoryRouter>,
  );

describe("category toolbar (320px overflow fix)", () => {
  it("keeps Showing / Filters / Sort and lets the Filters+Sort group wrap instead of forcing a wider row", async () => {
    renderPage();
    expect(await screen.findByText("Showing 2 Objects")).toBeInTheDocument();
    const filters = screen.getByRole("button", { name: /filters/i });
    const group = filters.parentElement;
    expect(group.className).toContain("flex-wrap");
    expect(group.className).toContain("max-w-full");
    expect(group.contains(screen.getByRole("combobox"))).toBe(true);
    // the outer row still wraps and spaces the count and the group
    expect(group.parentElement.className).toContain("flex-wrap");
    expect(group.parentElement.className).toContain("justify-between");
  });

  it("sort dropdown still changes value", async () => {
    renderPage();
    await screen.findByText("Showing 2 Objects");
    const select = screen.getByRole("combobox");
    await userEvent.selectOptions(select, "price-low");
    expect(select.value).toBe("price-low");
  });
});
