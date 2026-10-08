import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, Link, useNavigate } from "react-router-dom";
import HomepageRenderer from "../src/components/HomepageRenderer";
import PromoBanners2Up from "../src/components/PromoBanners2Up";
import CategoryStorefront from "../src/pages/shop/CategoryStorefront";
import { ctaLabel } from "../src/lib/cta";
import { buildCategoryOptions, rootOfCategory } from "../src/lib/catalogFilters";
import { buildCategoryIndex } from "../src/lib/categoryInheritance";

const cat = (id, name, slug, parentId = null, extra = {}) => ({ id, name, slug, parentId, isActive: true, sortOrder: 0, image: null, desktopBanner: null, mobileBanner: null, ...extra });
const CATEGORIES = [
  cat("hd", "Home Decor", "home-decor", null, { desktopBanner: "/hd-banner.jpg" }),
  cat("vases", "Vases", "vases", "hd"),
  cat("wall", "Wall Decor", "wall-decor", "hd"),
  cat("li", "Lighting", "lighting", null, { desktopBanner: "/li-banner.jpg" }),
  cat("lamps", "Table Lamps", "table-lamps", "li"),
  cat("ht", "Home Textiles", "home-textiles", null),
  cat("throws", "Throws", "throws", "ht"),
  cat("td", "Table & Dining", "table-dining", null),
  cat("fw", "Fragrance & Wellness", "fragrance-wellness", null),
  cat("books", "Books", "books", null),
  cat("ghost", "Ghost Decor", "ghost-decor", "hd", { isActive: false }),
];
const P = (id, name, categoryId, price = 1000, extra = {}) => ({ id, name, slug: id, categoryId, price, images: ["/x.jpg"], ...extra });
const ALL = [
  P("p-vase", "Blue Vase", "vases", 1500), P("p-wall", "Wall Hanging", "wall", 2500), P("p-hd", "Decor Tray", "hd", 800),
  P("p-lamp", "Brass Lamp", "lamps", 3000), P("p-throw", "Wool Throw", "throws", 1800), P("p-book", "A Book", "books", 500),
];
const subtree = { "home-decor": ["vases", "wall", "hd"], vases: ["vases"], lighting: ["lamps"], "table-lamps": ["lamps"], "home-textiles": ["throws"], "table-dining": [], "fragrance-wellness": [] };

const apiState = { delays: {}, calls: [] };
vi.mock("../src/components/HeroBannerCarousel", () => ({ default: () => <div data-testid="hero-carousel" /> }));
vi.mock("../src/components/PromoStrip", () => ({ default: () => <div /> }));
vi.mock("../src/components/ProductCard", () => ({ default: ({ product }) => <div data-testid="product-card">{product.name}</div> }));
vi.mock("../src/services/api", () => ({
  getProducts: vi.fn(async (params) => {
    apiState.calls.push(params.categorySlug);
    const wait = apiState.delays[params.categorySlug] || 0;
    if (wait) await new Promise((r) => setTimeout(r, wait));
    // the server returns products of the requested slug's whole subtree (the real `category` behaviour)
    const slugToId = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c.id]));
    const rootId = slugToId[params.categorySlug];
    const ids = rootId ? new Set(subtreeOf(rootId)) : null;
    return { data: ALL.filter((p) => !ids || ids.has(p.categoryId)) };
  }),
  getCategories: vi.fn(async () => ({ data: CATEGORIES })),
  getCollections: vi.fn(async () => ({ data: [{ id: "c1", name: "Autumn Edit", slug: "autumn" }] })),
}));
function subtreeOf(id) {
  const out = [id];
  CATEGORIES.filter((c) => c.parentId === id).forEach((c) => out.push(...subtreeOf(c.id)));
  return out;
}

beforeEach(() => { apiState.delays = {}; apiState.calls = []; });

function Shell() {
  const nav = useNavigate();
  return (
    <>
      <nav>
        {["home-decor", "lighting", "home-textiles", "table-dining", "fragrance-wellness"].map((s) => <Link key={s} to={`/shop/category/${s}`}>go-{s}</Link>)}
        <button onClick={() => nav(-1)}>back</button>
        <button onClick={() => nav(1)}>forward</button>
      </nav>
      <Routes><Route path="/shop/category/:slug" element={<CategoryStorefront />} /></Routes>
    </>
  );
}
const renderCatalog = (start) => render(<MemoryRouter initialEntries={[start || "/shop/category/home-decor"]}><Shell /></MemoryRouter>);
const names = () => screen.getAllByTestId("product-card").map((n) => n.textContent).sort();
const heading = () => screen.getByRole("heading", { level: 1 }).textContent;
const sidebar = () => within(screen.getByTestId("filter-sidebar"));
const categoryButtons = () => sidebar().getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed")).map((b) => b.textContent.replace(/\d+$/, "").trim());

describe("category-to-category navigation (route changes)", () => {
  it("updates heading, products and filter context on every hop without a reload", async () => {
    renderCatalog();
    await waitFor(() => expect(names()).toEqual(["Blue Vase", "Decor Tray", "Wall Hanging"]));
    expect(heading()).toBe("Home Decor");

    fireEvent.click(screen.getByText("go-lighting"));
    await waitFor(() => expect(names()).toEqual(["Brass Lamp"]));
    expect(heading()).toBe("Lighting");

    fireEvent.click(screen.getByText("go-home-textiles"));
    await waitFor(() => expect(names()).toEqual(["Wool Throw"]));
    expect(heading()).toBe("Home Textiles");

    fireEvent.click(screen.getByText("go-table-dining"));
    await waitFor(() => expect(heading()).toBe("Table & Dining"));
    expect(screen.queryAllByTestId("product-card")).toHaveLength(0);

    fireEvent.click(screen.getByText("go-fragrance-wellness"));
    await waitFor(() => expect(heading()).toBe("Fragrance & Wellness"));

    fireEvent.click(screen.getByText("go-home-decor"));
    await waitFor(() => expect(names()).toEqual(["Blue Vase", "Decor Tray", "Wall Hanging"]));
    expect(heading()).toBe("Home Decor");
  });

  it("swaps the category banner and subcategory tiles with the route", async () => {
    renderCatalog();
    await waitFor(() => expect(screen.getByTestId("category-banner").querySelector("img").getAttribute("src")).toContain("hd-banner"));
    expect(screen.getAllByTestId("subcategory-tile").map((t) => t.textContent)).toEqual(["Vases", "Wall Decor"]);
    fireEvent.click(screen.getByText("go-lighting"));
    await waitFor(() => expect(screen.getByTestId("category-banner").querySelector("img").getAttribute("src")).toContain("li-banner"));
    expect(screen.getAllByTestId("subcategory-tile").map((t) => t.textContent)).toEqual(["Table Lamps"]);
  });

  it("ignores a slow response for the previous category (no stale overwrite)", async () => {
    apiState.delays["home-decor"] = 150; // Home Decor answers AFTER Lighting does
    renderCatalog();
    await waitFor(() => expect(heading()).toBe("Home Decor"));
    fireEvent.click(screen.getByText("go-lighting"));
    await waitFor(() => expect(names()).toEqual(["Brass Lamp"]));
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    expect(names()).toEqual(["Brass Lamp"]);
    expect(heading()).toBe("Lighting");
  });

  it("browser back and forward restore the right category", async () => {
    renderCatalog();
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(screen.getByText("go-lighting"));
    await waitFor(() => expect(names()).toEqual(["Brass Lamp"]));
    fireEvent.click(screen.getByText("go-home-textiles"));
    await waitFor(() => expect(names()).toEqual(["Wool Throw"]));
    fireEvent.click(screen.getByText("back"));
    await waitFor(() => expect(names()).toEqual(["Brass Lamp"]));
    expect(heading()).toBe("Lighting");
    fireEvent.click(screen.getByText("back"));
    await waitFor(() => expect(heading()).toBe("Home Decor"));
    expect(names()).toHaveLength(3);
    fireEvent.click(screen.getByText("forward"));
    await waitFor(() => expect(heading()).toBe("Lighting"));
  });

  it("drops filters that do not apply when the root category changes", async () => {
    renderCatalog();
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(sidebar().getByRole("button", { name: /^Vases/ }));
    await waitFor(() => expect(names()).toEqual(["Blue Vase"]));
    fireEvent.click(screen.getByText("go-lighting"));
    await waitFor(() => expect(names()).toEqual(["Brass Lamp"]));
    expect(sidebar().getByRole("button", { name: /^Lighting/ })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("context-aware category filters", () => {
  it("Home Decor lists only the Home Decor subtree (no unrelated roots, no inactive nodes)", async () => {
    renderCatalog();
    await waitFor(() => expect(names()).toHaveLength(3));
    expect(categoryButtons()).toEqual(["Home Decor", "Vases", "Wall Decor"]);
    ["Lighting", "Home Textiles", "Books", "Ghost Decor"].forEach((n) => expect(categoryButtons()).not.toContain(n));
  });

  it("Lighting lists only the Lighting subtree", async () => {
    renderCatalog("/shop/category/lighting");
    await waitFor(() => expect(names()).toEqual(["Brass Lamp"]));
    expect(categoryButtons()).toEqual(["Lighting", "Table Lamps"]);
  });

  it("a child page (Vases) shows its root's tree with the child selected and only its own products", async () => {
    renderCatalog("/shop/category/vases");
    await waitFor(() => expect(names()).toEqual(["Blue Vase"]));
    expect(heading()).toBe("Vases");
    expect(sidebar().getByRole("button", { name: /^Vases/ })).toHaveAttribute("aria-pressed", "true");
    expect(categoryButtons()).not.toContain("Lighting");
  });

  it("counts are computed from the real products of each subtree", async () => {
    renderCatalog();
    await waitFor(() => expect(names()).toHaveLength(3));
    const count = (label) => sidebar().getByRole("button", { name: new RegExp(`^${label}`) }).textContent.match(/(\d+)$/)[1];
    expect(count("Home Decor")).toBe("3");
    expect(count("Vases")).toBe("1");
  });

  it("buildCategoryOptions never leaks other roots and hides empty nodes once loaded", () => {
    const opts = buildCategoryOptions({ categories: CATEGORIES, contextSlug: "table-lamps", products: [P("a", "Lamp", "lamps")], productsLoaded: true, selectedSlug: "table-lamps" });
    expect(opts.map((o) => o.slug)).toEqual(["lighting", "table-lamps"]);
    expect(rootOfCategory(CATEGORIES[4], buildCategoryIndex(CATEGORIES)).slug).toBe("lighting");
  });
});

describe("accordion filters", () => {
  it("sections expand and collapse with correct aria-expanded, and expose price / availability controls", async () => {
    renderCatalog();
    await waitFor(() => expect(names()).toHaveLength(3));
    const category = sidebar().getByRole("button", { name: /^Category/ });
    expect(category).toHaveAttribute("aria-expanded", "true");
    const price = sidebar().getByRole("button", { name: /^Price/ });
    expect(price).toHaveAttribute("aria-expanded", "false");
    expect(sidebar().queryByLabelText("Maximum price")).toBeNull();
    fireEvent.click(price);
    expect(price).toHaveAttribute("aria-expanded", "true");
    expect(sidebar().getByLabelText("Maximum price")).toBeInTheDocument();
    fireEvent.click(category);
    expect(category).toHaveAttribute("aria-expanded", "false");
    expect(sidebar().queryByRole("button", { name: /^Vases/ })).toBeNull();
    fireEvent.click(sidebar().getByRole("button", { name: /^Availability/ }));
    expect(sidebar().getByLabelText("In Stock Only")).toBeInTheDocument();
    expect(sidebar().getByRole("button", { name: /^Collection/ })).toBeInTheDocument();
  });

  it("price cap and stock filter narrow the grid and Reset All restores the page category", async () => {
    renderCatalog();
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(sidebar().getByRole("button", { name: /^Vases/ }));
    await waitFor(() => expect(names()).toEqual(["Blue Vase"]));
    fireEvent.click(sidebar().getByRole("button", { name: /^Price/ }));
    fireEvent.change(sidebar().getByLabelText("Maximum price"), { target: { value: "1000" } });
    await waitFor(() => expect(screen.queryAllByTestId("product-card")).toHaveLength(0));
    fireEvent.click(sidebar().getByRole("button", { name: "Reset All" }));
    await waitFor(() => expect(names()).toEqual(["Blue Vase", "Decor Tray", "Wall Hanging"]));
    expect(sidebar().getByRole("button", { name: /^Home Decor/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("the mobile drawer uses the same accordion filters", async () => {
    renderCatalog();
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(screen.getByRole("button", { name: /^Filters$/ }));
    const drawer = screen.getByText("Filter Catalog").closest("div").parentElement;
    const inDrawer = within(drawer);
    expect(inDrawer.getAllByTestId("catalog-filters")).toHaveLength(1);
    const price = inDrawer.getByRole("button", { name: /^Price/ });
    fireEvent.click(price);
    expect(price).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(inDrawer.getByRole("button", { name: /^Wall Decor/ }));
    await waitFor(() => expect(names()).toEqual(["Wall Hanging"]));
    fireEvent.click(inDrawer.getByRole("button", { name: "Reset All" }));
    await waitFor(() => expect(names()).toHaveLength(3));
  });
});

describe("single-arrow CTAs", () => {
  it("ctaLabel strips trailing arrows an admin typed", () => {
    expect(ctaLabel("SHOP NOW →")).toBe("SHOP NOW");
    expect(ctaLabel("Shop Now → →")).toBe("Shop Now");
    expect(ctaLabel("Explore ->")).toBe("Explore");
    expect(ctaLabel("Explore ›")).toBe("Explore");
    expect(ctaLabel("", "Fallback")).toBe("Fallback");
    expect(ctaLabel("Plain label")).toBe("Plain label");
  });

  it("a lower banner whose saved label already ends in an arrow still shows exactly one arrow", () => {
    render(<MemoryRouter><PromoBanners2Up promoCards={[{ id: "1", title: "Home Decor", image: "/a.jpg", ctaLabel: "SHOP NOW →", ctaUrl: "/x" }]} /></MemoryRouter>);
    const cta = screen.getByTestId("promo-banner-cta");
    expect((cta.textContent.match(/→/g) || []).length).toBe(1);
    expect(cta.textContent).toContain("SHOP NOW");
  });

  it("homepage rail CTAs show exactly one arrow even if the saved label contains one", () => {
    const sections = [{ id: "n", type: "NEW_ARRIVALS", isEnabled: true, settings: { ctaLabel: "SEE ALL →", ctaUrl: "/new-arrivals" }, products: [{ id: "p", name: "Vase" }] }];
    render(<MemoryRouter><HomepageRenderer sections={sections} /></MemoryRouter>);
    expect((screen.getByTestId("section-cta").textContent.match(/→/g) || []).length).toBe(1);
  });
});

describe("homepage structure", () => {
  const trust = { id: "t", type: "TRUST_STRIP", isEnabled: true, sortOrder: 9, settings: { items: [{ id: "a", title: "Curated", description: "x", icon: "heart" }] } };
  const hero = { id: "h", type: "HERO_CAROUSEL", isEnabled: true, sortOrder: 3, settings: {} };
  const rail = { id: "n", type: "NEW_ARRIVALS", isEnabled: true, sortOrder: 1, settings: {}, products: [{ id: "p", name: "Vase" }] };

  it("renders the Trust Strip directly after the Hero even if it was saved after other sections", () => {
    const { container } = render(<MemoryRouter><HomepageRenderer sections={[rail, trust, hero]} /></MemoryRouter>);
    const order = [...container.querySelectorAll("[data-testid='hero-carousel'], [data-testid='trust-strip'], [data-testid='section-title']")].map((n) => n.getAttribute("data-testid"));
    expect(order.slice(0, 2)).toEqual(["hero-carousel", "trust-strip"]);
    expect(order.indexOf("section-title")).toBeGreaterThan(order.indexOf("trust-strip"));
  });

  it("lower banners sit inside the normal site container (max-w + side margins), not edge to edge", () => {
    render(<MemoryRouter><PromoBanners2Up promoCards={[{ id: "1", title: "A", image: "/a.jpg" }, { id: "2", title: "B", image: "/b.jpg" }]} /></MemoryRouter>);
    const section = screen.getByTestId("promo-banners");
    expect(section.className).toContain("max-w-7xl");
    expect(section.className).toContain("px-4");
    expect(section.className).toContain("mx-auto");
    screen.getAllByTestId("promo-banner").forEach((b) => expect(b.className).toContain("rounded-2xl"));
  });
});

