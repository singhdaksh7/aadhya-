import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ProductCatalog from "../src/pages/shop/ProductCatalog";

// The mock stands in for the server: it honours newArrival=true by returning only the (pre-computed,
// server-side) effective New Arrival products. The page must never re-derive that from dates.
const state = { all: [], effective: [] };
const getProducts = vi.fn(async (params) => ({ data: params.newArrival ? state.effective : state.all }));
vi.mock("../src/services/api", () => ({
  getProducts: (p) => getProducts(p),
  getCategories: vi.fn(async () => ({ data: [] })),
  getCollections: vi.fn(async () => ({ data: [] })),
}));
vi.mock("../src/components/ProductCard", () => ({ default: ({ product }) => <div data-testid="product-card">{product.name}</div> }));
vi.mock("../src/hooks/useSiteSettings", () => ({ useSiteSettings: () => ({}) }));

const P = (id, name, price = 1000) => ({ id, name, slug: id, price, images: ["/x.jpg"], isNew: true });
const fresh = P("fresh", "Fresh Piece", 900);
const oldManual = P("old-manual", "Old Manual Piece", 1200);
const oldPlain = { ...P("old-plain", "Old Plain Piece"), isNew: false };

const open = () => render(
  <MemoryRouter initialEntries={["/new-arrivals"]}>
    <Routes><Route path="/new-arrivals" element={<ProductCatalog eyebrow="Fresh Drops" title="New Arrivals" lockedNewArrival />} /></Routes>
  </MemoryRouter>
);
const names = () => screen.queryAllByTestId("product-card").map((n) => n.textContent).sort();

describe("/new-arrivals page", () => {
  beforeEach(() => { getProducts.mockClear(); state.all = [fresh, oldManual, oldPlain]; state.effective = [fresh, oldManual]; });

  it("requests newArrival=true and renders fresh + old manually flagged products only", async () => {
    open();
    await waitFor(() => expect(names()).toEqual(["Fresh Piece", "Old Manual Piece"]));
    expect(getProducts).toHaveBeenCalledWith(expect.objectContaining({ newArrival: true }));
    expect(getProducts.mock.calls.every(([p]) => p.newArrival === true)).toBe(true);
    expect(screen.queryByText("Old Plain Piece")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("New Arrivals");
  });

  it("shows the empty state (not the full catalog) when nothing is a New Arrival", async () => {
    state.effective = [];
    open();
    expect(await screen.findByText("No items found")).toBeInTheDocument();
    expect(names()).toEqual([]);
  });

  it("keeps sorting and filtering working while staying scoped to New Arrivals", async () => {
    open();
    await waitFor(() => expect(names()).toHaveLength(2));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "price-low" } });
    await waitFor(() => expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ sortBy: "price-low", newArrival: true })));
    expect(names()).toEqual(["Fresh Piece", "Old Manual Piece"]);
  });

  it("is routed with the lock and does not canonicalize to /shop", () => {
    const app = readFileSync(resolve(process.cwd(), "src/App.jsx"), "utf8");
    expect(app).toMatch(/path="\/new-arrivals" element=\{<ProductCatalog [^>]*lockedNewArrival/);
    open();
    expect(document.querySelector('link[rel="canonical"][href*="/shop"]')).toBeNull();
  });
});
