import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProductCatalog from "../src/pages/shop/ProductCatalog";
import { buildCategoryIndex, resolveCategoryBanner, resolveCategoryImage, resolveCategoryThumb } from "../src/lib/categoryInheritance";
import { buildCategoryTree } from "../src/lib/navModel";

const state = { categories: [] };
vi.mock("../src/components/ProductCard", () => ({ default: ({ product }) => <div data-testid="product-card">{product.name}</div> }));
vi.mock("../src/services/api", () => ({
  getProducts: vi.fn(async () => ({ data: [{ id: "p1", name: "Vase" }] })),
  getCategories: vi.fn(async () => ({ data: state.categories })),
  getCollections: vi.fn(async () => ({ data: [] })),
}));

const root = (x = {}) => ({ id: "root", name: "Home Decor", slug: "home-decor", parentId: null, isActive: true, image: null, desktopBanner: null, mobileBanner: null, ...x });
const child = (x = {}) => ({ id: "child", name: "Vases", slug: "vases", parentId: "root", isActive: true, image: null, desktopBanner: null, mobileBanner: null, ...x });
const grand = (x = {}) => ({ id: "grand", name: "Tall Vases", slug: "tall-vases", parentId: "child", isActive: true, image: null, desktopBanner: null, mobileBanner: null, ...x });
const banner = (cats, slug) => resolveCategoryBanner(cats.find((c) => c.slug === slug), buildCategoryIndex(cats));

describe("category banner inheritance (resolver)", () => {
  it("root category uses its own banner", () => {
    expect(banner([root({ desktopBanner: "/r.jpg" })], "home-decor")).toEqual({ desktop: "/r.jpg", mobile: "/r.jpg" });
  });
  it("child uses its own banner when present", () => {
    expect(banner([root({ desktopBanner: "/r.jpg" }), child({ desktopBanner: "/c.jpg" })], "vases").desktop).toBe("/c.jpg");
  });
  it("child inherits the parent banner when missing; walks up to the grandparent", () => {
    const cats = [root({ desktopBanner: "/r.jpg" }), child(), grand()];
    expect(banner(cats, "vases").desktop).toBe("/r.jpg");
    expect(banner(cats, "tall-vases").desktop).toBe("/r.jpg");
  });
  it("mobile prefers the child mobile banner", () => {
    const cats = [root({ desktopBanner: "/r.jpg", mobileBanner: "/rm.jpg" }), child({ desktopBanner: "/c.jpg", mobileBanner: "/cm.jpg" })];
    expect(banner(cats, "vases")).toEqual({ desktop: "/c.jpg", mobile: "/cm.jpg" });
  });
  it("mobile falls back to the child desktop banner before the parent banners", () => {
    const cats = [root({ desktopBanner: "/r.jpg", mobileBanner: "/rm.jpg" }), child({ desktopBanner: "/c.jpg" })];
    expect(banner(cats, "vases")).toEqual({ desktop: "/c.jpg", mobile: "/c.jpg" });
  });
  it("child with nothing inherits the parent mobile, else the parent desktop", () => {
    expect(banner([root({ desktopBanner: "/r.jpg", mobileBanner: "/rm.jpg" }), child()], "vases")).toEqual({ desktop: "/r.jpg", mobile: "/rm.jpg" });
    expect(banner([root({ desktopBanner: "/r.jpg" }), child()], "vases")).toEqual({ desktop: "/r.jpg", mobile: "/r.jpg" });
  });
  it("child with only a mobile banner uses it on mobile and the parent desktop banner on desktop", () => {
    expect(banner([root({ desktopBanner: "/r.jpg" }), child({ mobileBanner: "/cm.jpg" })], "vases")).toEqual({ desktop: "/r.jpg", mobile: "/cm.jpg" });
  });
  it("no banner anywhere resolves to null, and a parent cycle cannot loop", () => {
    expect(banner([root(), child()], "vases")).toEqual({ desktop: null, mobile: null });
    expect(banner([root({ parentId: "child" }), child()], "vases")).toEqual({ desktop: null, mobile: null });
  });
});

describe("category image inheritance (resolver)", () => {
  it("child inherits the parent image", () => {
    const cats = [root({ image: "/r.jpg" }), child()];
    expect(resolveCategoryImage(cats[1], buildCategoryIndex(cats))).toBe("/r.jpg");
  });
  it("own image overrides the inherited one", () => {
    const cats = [root({ image: "/r.jpg" }), child({ image: "/c.jpg" })];
    expect(resolveCategoryImage(cats[1], buildCategoryIndex(cats))).toBe("/c.jpg");
  });
  it("thumbnail falls back to the resolved banner, then null (no broken URL)", () => {
    const withBanner = [root({ desktopBanner: "/rb.jpg" }), child()];
    expect(resolveCategoryThumb(withBanner[1], buildCategoryIndex(withBanner))).toBe("/rb.jpg");
    const none = [root(), child()];
    expect(resolveCategoryThumb(none[1], buildCategoryIndex(none))).toBeNull();
  });
  it("nav tree nodes inherit the parent image (mega menu and strip)", () => {
    const { byId } = buildCategoryTree([root({ image: "/r.jpg" }), child(), grand({ image: "/g.jpg" })]);
    expect(byId.get("child").image).toBe("/r.jpg");
    expect(byId.get("grand").image).toBe("/g.jpg");
  });
});

const renderAt = (slug) =>
  render(
    <MemoryRouter initialEntries={[`/shop/category/${slug}`]}>
      <Routes><Route path="/shop/category/:slug" element={<ProductCatalog lockedCategory={slug} title="x" />} /></Routes>
    </MemoryRouter>,
  );

describe("category page (subcategory)", () => {
  beforeEach(() => { state.categories = []; });

  it("shows the inherited parent banner, its own title and parent breadcrumbs", async () => {
    state.categories = [root({ desktopBanner: "/uploads/products/home.jpg" }), child()];
    renderAt("vases");
    const b = await screen.findByTestId("category-banner");
    expect(b.querySelector("img").getAttribute("src")).toMatch(/home\.jpg$/);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Vases");
    expect(screen.getByRole("link", { name: "Home Decor" }).getAttribute("href")).toBe("/shop/category/home-decor");
  });

  it("a child's own banner overrides the parent's", async () => {
    state.categories = [root({ desktopBanner: "/uploads/products/home.jpg" }), child({ desktopBanner: "/uploads/products/vases.jpg" })];
    renderAt("vases");
    const b = await screen.findByTestId("category-banner");
    expect(b.querySelector("img").getAttribute("src")).toMatch(/vases\.jpg$/);
  });

  it("keeps the text header when no banner exists anywhere in the chain", async () => {
    state.categories = [root(), child()];
    renderAt("vases");
    expect(await screen.findByTestId("product-card")).toBeInTheDocument();
    expect(screen.queryByTestId("category-banner")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Vases");
  });

  it("parent page lists subcategory tiles with image + name; inherited image, own image wins", async () => {
    state.categories = [
      root({ image: "/uploads/products/parent.jpg" }),
      child({ id: "c1", name: "Vases", slug: "vases" }),
      child({ id: "c2", name: "Bowls", slug: "bowls", image: "/uploads/products/bowls.jpg" }),
      child({ id: "c3", name: "Elsewhere", slug: "elsewhere", parentId: "other" }),
    ];
    renderAt("home-decor");
    const tiles = await screen.findAllByTestId("subcategory-tile");
    expect(tiles).toHaveLength(2);
    expect(within(tiles[0]).getByText("Vases")).toBeInTheDocument();
    expect(tiles[0].querySelector("img").getAttribute("src")).toMatch(/parent\.jpg$/);
    expect(tiles[1].querySelector("img").getAttribute("src")).toMatch(/bowls\.jpg$/);
    expect(tiles[0].getAttribute("href")).toBe("/shop/category/vases");
  });

  it("a subcategory with no image anywhere shows a neutral initial, not a broken image", async () => {
    state.categories = [root(), child()];
    renderAt("home-decor");
    const tile = await screen.findByTestId("subcategory-tile");
    expect(tile.querySelector("img")).toBeNull();
    expect(within(tile).getByText("V")).toBeInTheDocument();
  });
});
