import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, Link } from "react-router-dom";
import fs from "node:fs";
import path from "node:path";
import BooksShowcase, { buildBookModules } from "../src/components/shop/BooksShowcase";
import BookCard from "../src/components/shop/BookCard";
import { MegaPromoCard } from "../src/components/MegaMenu";
import ReviewsSection from "../src/components/ReviewsSection";
import HomepageRenderer from "../src/components/HomepageRenderer";
import CategoryStorefront from "../src/pages/shop/CategoryStorefront";
import BooksStorefront from "../src/pages/shop/BooksStorefront";
import { applyFacetSelections, buildFacetOptions, facetValues, resolveFilterGroups, toggleFacetValue } from "../src/lib/catalogFilterEngine";

const cat = (id, name, slug, parentId = null, extra = {}) => ({ id, name, slug, parentId, isActive: true, sortOrder: 0, ...extra });
const CATEGORIES = [
  cat("books", "Books", "books"), cat("b-int", "Home & Interiors", "books-home-and-interiors", "books"), cat("b-slow", "Slow Living", "books-slow-living", "books"),
  cat("li", "Lighting", "lighting"), cat("lamps", "Table Lamps", "table-lamps", "li"),
  cat("hd", "Home Decor", "home-decor"), cat("vases", "Vases", "vases", "hd"),
];
const book = (id, name, categoryId, extra = {}) => ({ id, name, slug: id, categoryId, productType: "BOOK", price: 600, images: [{ url: "/c.jpg" }], createdAt: "2026-10-01T00:00:00Z", bookDetail: { author: "Aadya Editorial (Demo Sample)", language: "English", publisher: "Aadya Sample Press" }, bookFormats: [{ format: "PHYSICAL" }], isActive: true, ...extra });
const BOOKS = [
  book("bk1", "Quiet Spaces", "b-int", { isFeatured: true, createdAt: "2026-10-05T00:00:00Z", shortDescription: "A calm look at rooms." }),
  book("bk2", "The Warm Home", "b-int", { isNewArrival: true, createdAt: "2026-10-04T00:00:00Z", bookDetail: { author: "Meera Sample", language: "Hindi" }, bookFormats: [{ format: "PDF" }] }),
  book("bk3", "Notes on Slow Living", "b-slow", { isFeatured: true, isBestSeller: true, bookDetail: { author: "Meera Sample", language: "English" }, bookFormats: [{ format: "PHYSICAL" }, { format: "PDF" }] }),
  book("bk4", "Everyday Styling", "b-slow", { isBestSeller: true }),
];
const LAMPS = [
  { id: "l1", name: "Brass Lamp", slug: "l1", categoryId: "lamps", price: 3000, images: ["/l.jpg"], attributes: { Material: "Brass", Finish: "Matte" } },
  { id: "l2", name: "Cane Lamp", slug: "l2", categoryId: "lamps", price: 2000, images: ["/l.jpg"], attributes: { Material: "Cane", Finish: "Natural" } },
  { id: "l3", name: "Iron Lamp", slug: "l3", categoryId: "lamps", price: 2500, images: ["/l.jpg"], attributes: { material: "Iron" }, stockQuantity: 0, inStock: false },
];
const VASES = [{ id: "v1", name: "Blue Vase", slug: "v1", categoryId: "vases", price: 1500, images: ["/v.jpg"], attributes: { Color: "Blue", Material: "Ceramic" } }];

const mockSettings = { value: {} };
vi.mock("../src/hooks/useSiteSettings", () => ({ useSiteSettings: () => mockSettings.value }));
vi.mock("../src/components/ProductCard", () => ({ default: ({ product }) => <div data-testid="product-card">{product.name}</div> }));
vi.mock("../src/components/HeroBannerCarousel", () => ({ default: () => <div /> }));
vi.mock("../src/components/PromoStrip", () => ({ default: () => <div /> }));
vi.mock("../src/services/api", () => ({
  getProducts: vi.fn(async (params) => {
    const slug = params.categorySlug;
    if (params.category === "BOOK" || slug === "books") return { data: BOOKS };
    if (slug === "lighting") return { data: LAMPS };
    if (slug === "home-decor") return { data: VASES };
    return { data: [...BOOKS, ...LAMPS, ...VASES] };
  }),
  getCategories: vi.fn(async () => ({ data: CATEGORIES })),
  getCollections: vi.fn(async () => ({ data: [] })),
}));

const CONFIG = { categories: [
  { categoryId: "books", applyToSubcategories: true, groups: [
    { id: "b-cat", type: "CATEGORY", label: "Theme", order: 0, defaultOpen: true },
    { id: "b-author", type: "BOOK_AUTHOR", label: "Author", order: 1, defaultOpen: true, selection: "MULTI" },
    { id: "b-format", type: "BOOK_FORMAT", label: "Format", order: 2, defaultOpen: true, selection: "SINGLE" },
    { id: "b-lang", type: "BOOK_LANGUAGE", label: "Language", order: 3, showMobile: false },
    { id: "b-price", type: "PRICE", order: 4 },
  ] },
  { categoryId: "li", groups: [
    { id: "l-mat", type: "ATTRIBUTE", attributeKey: "Material", label: "Material", order: 1, defaultOpen: true },
    { id: "l-fin", type: "ATTRIBUTE", attributeKey: "Finish", label: "Finish", order: 0, defaultOpen: true },
    { id: "l-price", type: "PRICE", order: 2 },
    { id: "l-av", type: "AVAILABILITY", order: 3 },
  ] },
] };
beforeEach(() => { mockSettings.value = { catalogFilters: CONFIG }; });

const wrap = (ui, start = "/") => render(<MemoryRouter initialEntries={[start]}>{ui}</MemoryRouter>);

describe("books showcase (demo-ready bookstore modules)", () => {
  it("builds featured / new / editor / popular modules without repeating a book", () => {
    const m = buildBookModules(BOOKS);
    expect(m.featured.id).toBe("bk1");
    const ids = [m.featured, ...m.newReleases, ...m.editorsPicks, ...m.popular].map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(m.editorsPicks.map((b) => b.id)).toEqual(["bk3"]);
    expect(m.popular.map((b) => b.id)).toEqual(["bk4"]);
  });

  it("renders the sections that have books and the browse-by-theme chips; nothing at all without books", () => {
    const themes = CATEGORIES.filter((c) => c.parentId === "books");
    wrap(<BooksShowcase books={BOOKS} themes={themes} />);
    expect(screen.getByTestId("books-featured")).toBeInTheDocument();
    expect(screen.getByTestId("books-new")).toBeInTheDocument();
    expect(screen.getByTestId("books-editors")).toBeInTheDocument();
    expect(screen.getByTestId("books-popular")).toBeInTheDocument();
    expect(screen.getAllByTestId("books-theme-chip").map((c) => c.textContent)).toEqual(["Home & Interiors", "Slow Living"]);
  });

  it("hides modules that have no books, and everything when there are zero books", () => {
    const { unmount } = wrap(<BooksShowcase books={[book("only", "Only Book", "b-int")]} themes={[]} />);
    expect(screen.getByTestId("books-featured")).toBeInTheDocument();
    expect(screen.queryByTestId("books-editors")).toBeNull();
    expect(screen.queryByTestId("books-popular")).toBeNull();
    unmount();
    const { container } = wrap(<BooksShowcase books={[]} themes={[]} />);
    expect(container.querySelector("[data-testid='books-showcase']")).toBeNull();
  });

  it("book cards show cover, title, author (without the demo suffix) and one price", () => {
    wrap(<BookCard product={BOOKS[0]} />);
    expect(screen.getByAltText("Quiet Spaces cover")).toBeInTheDocument();
    expect(screen.getByTestId("book-author").textContent).toBe("Aadya Editorial");
    expect(screen.getByTestId("card-price").textContent).toMatch(/600/);
  });

  it("the Books page renders the showcase above the catalog with book-specific filters", async () => {
    wrap(<BooksStorefront />);
    await waitFor(() => expect(screen.getByTestId("books-featured")).toBeInTheDocument());
    const sidebar = within(await screen.findByTestId("filter-sidebar"));
    expect(sidebar.getByRole("button", { name: /^Theme/ })).toBeInTheDocument();
    expect(sidebar.getByRole("button", { name: /^Author/ })).toBeInTheDocument();
    expect(sidebar.getByRole("button", { name: /^Format/ })).toBeInTheDocument();
    expect(screen.getAllByTestId("book-card").length).toBeGreaterThanOrEqual(4);
  });

  it("homepage Books shelf: visible with books, hidden with none", () => {
    const sec = (books) => [{ id: "bk", type: "BOOKS_SHELF", isEnabled: true, settings: {}, books }];
    const { unmount } = wrap(<HomepageRenderer sections={sec([{ id: "b", name: "Quiet Spaces", images: ["/c.jpg"], price: 600, author: "x" }])} />);
    expect(screen.getByText("From Our Bookshelf")).toBeInTheDocument();
    unmount();
    wrap(<HomepageRenderer sections={sec([])} />);
    expect(screen.queryByText("From Our Bookshelf")).toBeNull();
  });
});

describe("mega-menu promo card (editorial overlay)", () => {
  const promo = { image: "/uploads/books.jpg", altText: "Books promo", eyebrow: "Staff Picks", title: "Reading Edit", description: "Quiet reads", ctaLabel: "SHOP NOW →", ctaUrl: "/shop/books" };

  it("puts eyebrow, title and CTA on top of the image with no separate text block or panel", () => {
    wrap(<MegaPromoCard promo={promo} />);
    const link = screen.getByTestId("mega-promo").querySelector("a");
    const overlay = screen.getByTestId("mega-promo-overlay");
    expect(overlay.className).toContain("absolute inset-0");
    expect(overlay.contains(screen.getByText("Reading Edit"))).toBe(true);
    expect(overlay.contains(screen.getByTestId("mega-promo-cta"))).toBe(true);
    expect(Array.from(link.children).map((c) => c.tagName)).toEqual(["PICTURE", "DIV"]); // image + overlay only
    expect(link.className).not.toMatch(/\bborder\b|store-surface|\bp-\d/);
    expect(screen.getByTestId("mega-promo").className).not.toMatch(/border-l|pl-6/);
  });

  it("shows exactly one arrow even when the saved label already contains one", () => {
    wrap(<MegaPromoCard promo={promo} />);
    const cta = screen.getByTestId("mega-promo-cta");
    expect((cta.textContent.match(/→/g) || []).length).toBe(1);
    expect(cta.textContent.replace("→", "").trim()).toBe("SHOP NOW");
  });

  it("omits the CTA when none is configured", () => {
    wrap(<MegaPromoCard promo={{ ...promo, ctaLabel: "" }} />);
    expect(screen.queryByTestId("mega-promo-cta")).toBeNull();
  });
});

describe("admin-driven filter configuration (engine)", () => {
  it("uses the category's own config; Books and Lighting differ", () => {
    const books = resolveFilterGroups({ settings: { catalogFilters: CONFIG }, categories: CATEGORIES, categorySlug: "books" });
    const lighting = resolveFilterGroups({ settings: { catalogFilters: CONFIG }, categories: CATEGORIES, categorySlug: "lighting" });
    expect(books.map((g) => g.label)).toEqual(["Theme", "Author", "Format", "Language", "Price"]);
    expect(lighting.map((g) => g.label)).toEqual(["Finish", "Material", "Price", "Availability"]); // order respected (Finish order 0)
  });

  it("subcategories inherit the parent's config; applyToSubcategories=false stops that", () => {
    const inherited = resolveFilterGroups({ settings: { catalogFilters: CONFIG }, categories: CATEGORIES, categorySlug: "books-slow-living" });
    expect(inherited.map((g) => g.id)).toContain("b-author");
    const off = { categories: [{ ...CONFIG.categories[0], applyToSubcategories: false }] };
    expect(resolveFilterGroups({ settings: { catalogFilters: off }, categories: CATEGORIES, categorySlug: "books-slow-living" }).map((g) => g.type)).toEqual(["CATEGORY", "COLLECTION", "PRICE", "AVAILABILITY"]);
  });

  it("falls back to the default set when a category (or all of settings) has no config", () => {
    const fallback = resolveFilterGroups({ settings: { catalogFilters: CONFIG }, categories: CATEGORIES, categorySlug: "home-decor" });
    expect(fallback.map((g) => g.type)).toEqual(["CATEGORY", "COLLECTION", "PRICE", "AVAILABILITY"]);
    expect(resolveFilterGroups({ settings: {}, categories: CATEGORIES, categorySlug: "books" })).toHaveLength(4);
    expect(resolveFilterGroups({ settings: undefined, categories: [], categorySlug: null })).toHaveLength(4);
  });

  it("drops disabled groups and keeps custom labels", () => {
    const cfg = { categories: [{ categoryId: "li", groups: [{ id: "a", type: "PRICE", label: "Budget" }, { id: "b", type: "AVAILABILITY", enabled: false }] }] };
    const groups = resolveFilterGroups({ settings: { catalogFilters: cfg }, categories: CATEGORIES, categorySlug: "lighting" });
    expect(groups.map((g) => g.label)).toEqual(["Budget"]);
  });

  it("reads attributes case-insensitively, falls back to materials, and reads book fields", () => {
    const mat = { type: "ATTRIBUTE", attributeKey: "Material" };
    expect(facetValues({ attributes: { material: "Iron" } }, mat)).toEqual(["Iron"]);
    expect(facetValues({ materials: "Cotton, wood" }, mat)).toEqual(["Cotton", "wood"]);
    expect(facetValues(BOOKS[2], { type: "BOOK_FORMAT" })).toEqual(["Physical", "Digital (PDF)"]);
    expect(facetValues(BOOKS[1], { type: "BOOK_LANGUAGE" })).toEqual(["Hindi"]);
  });

  it("counts are accurate, zero-count options are hidden, and other groups' selections narrow the counts", () => {
    const groups = [{ id: "mat", type: "ATTRIBUTE", attributeKey: "Material" }, { id: "fin", type: "ATTRIBUTE", attributeKey: "Finish" }];
    const none = buildFacetOptions(LAMPS, groups, {});
    expect(none.mat.map((o) => [o.value, o.count])).toEqual([["Brass", 1], ["Cane", 1], ["Iron", 1]]);
    const narrowed = buildFacetOptions(LAMPS, groups, { fin: ["Matte"] });
    expect(narrowed.mat.map((o) => o.value)).toEqual(["Brass"]); // Cane/Iron would be 0 -> excluded
    expect(narrowed.fin.map((o) => o.value).sort()).toEqual(["Matte", "Natural"]); // own group keeps alternatives
  });

  it("multi-select unions values; single-select replaces and can be cleared", () => {
    const multi = { id: "m", type: "ATTRIBUTE", attributeKey: "Material", selection: "MULTI" };
    let sel = toggleFacetValue({}, multi, "Brass");
    sel = toggleFacetValue(sel, multi, "Cane");
    expect(sel.m).toEqual(["Brass", "Cane"]);
    expect(applyFacetSelections(LAMPS, [multi], sel).map((p) => p.id)).toEqual(["l1", "l2"]);
    sel = toggleFacetValue(sel, multi, "Brass");
    expect(sel.m).toEqual(["Cane"]);
    const single = { ...multi, selection: "SINGLE" };
    let s2 = toggleFacetValue({}, single, "Brass");
    s2 = toggleFacetValue(s2, single, "Cane");
    expect(s2.m).toEqual(["Cane"]);
    expect(toggleFacetValue(s2, single, "Cane").m).toEqual([]);
  });
});

describe("dynamic filters on category pages", () => {
  const Shell = () => (
    <>
      <nav><Link to="/shop/category/lighting">go-lighting</Link><Link to="/shop/category/home-decor">go-decor</Link></nav>
      <Routes><Route path="/shop/category/:slug" element={<CategoryStorefront />} /></Routes>
    </>
  );
  const sidebar = () => within(screen.getByTestId("filter-sidebar"));
  const names = () => screen.getAllByTestId("product-card").map((n) => n.textContent).sort();

  it("Lighting shows its configured Material/Finish facets in configured order with real counts", async () => {
    wrap(<Shell />, "/shop/category/lighting");
    await waitFor(() => expect(names()).toHaveLength(3));
    const triggers = sidebar().getAllByRole("button", { expanded: true }).map((b) => b.textContent.replace(/[+−]/g, "").trim());
    expect(triggers.indexOf("Finish")).toBeLessThan(triggers.indexOf("Material"));
    expect(sidebar().getByRole("checkbox", { name: /Brass/ }).closest("label").textContent).toContain("1");
    expect(sidebar().queryByRole("button", { name: /^Author/ })).toBeNull();
  });

  it("multi-select facet filters the grid; Reset All clears it", async () => {
    wrap(<Shell />, "/shop/category/lighting");
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(sidebar().getByRole("checkbox", { name: /Brass/ }));
    await waitFor(() => expect(names()).toEqual(["Brass Lamp"]));
    fireEvent.click(sidebar().getByRole("checkbox", { name: /Cane/ }));
    await waitFor(() => expect(names()).toEqual(["Brass Lamp", "Cane Lamp"]));
    fireEvent.click(sidebar().getByRole("button", { name: "Reset All" }));
    await waitFor(() => expect(names()).toHaveLength(3));
  });

  it("a category without custom config falls back to the default accordion set", async () => {
    wrap(<Shell />, "/shop/category/home-decor");
    await waitFor(() => expect(names()).toEqual(["Blue Vase"]));
    ["Category", "Price", "Availability"].forEach((t) => expect(sidebar().getByRole("button", { name: new RegExp(`^${t}`) })).toBeInTheDocument());
    expect(sidebar().queryByRole("button", { name: /^Material/ })).toBeNull();
  });

  it("switching category resets an invalid facet selection and swaps the filter set", async () => {
    wrap(<Shell />, "/shop/category/lighting");
    await waitFor(() => expect(names()).toHaveLength(3));
    fireEvent.click(sidebar().getByRole("checkbox", { name: /Brass/ }));
    await waitFor(() => expect(names()).toEqual(["Brass Lamp"]));
    fireEvent.click(screen.getByText("go-decor"));
    await waitFor(() => expect(names()).toEqual(["Blue Vase"]));
    expect(sidebar().queryByRole("checkbox", { name: /Brass/ })).toBeNull();
    fireEvent.click(screen.getByText("go-lighting"));
    await waitFor(() => expect(names()).toHaveLength(3)); // Brass selection did not leak back
  });

  it("desktop and mobile drawer are driven by the same config; showMobile=false hides a group only on mobile", async () => {
    wrap(<BooksStorefront />);
    const desktop = within(await screen.findByTestId("filter-sidebar"));
    await waitFor(() => expect(desktop.getByRole("button", { name: /^Author/ })).toBeInTheDocument());
    expect(desktop.getByRole("button", { name: /^Language/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Filters$/ }));
    const drawer = within(screen.getByText("Filter Catalog").closest("div").parentElement);
    expect(drawer.getByRole("button", { name: /^Author/ })).toBeInTheDocument();
    expect(drawer.getByRole("button", { name: /^Format/ })).toBeInTheDocument();
    expect(drawer.queryByRole("button", { name: /^Language/ })).toBeNull();
    const trigger = drawer.getByRole("button", { name: /^Author/ });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("single-select Format narrows books to that format", async () => {
    const { container } = wrap(<BooksStorefront />);
    const desktop = within(await screen.findByTestId("filter-sidebar"));
    const grid = () => within(container.querySelector("main")).queryAllByTestId("book-card");
    await waitFor(() => expect(grid()).toHaveLength(4));
    await waitFor(() => expect(desktop.getByRole("button", { name: /^Digital \(PDF\)/ })).toBeInTheDocument());
    fireEvent.click(desktop.getByRole("button", { name: /^Digital \(PDF\)/ }));
    await waitFor(() => expect(grid()).toHaveLength(2)); // The Warm Home (PDF) + Notes on Slow Living (Physical + PDF)
    expect(grid().map((c) => c.textContent).join("|")).toMatch(/Warm Home/);
  });
});

describe("homepage reviews: real vs demo", () => {
  const demo = [{ id: "d1", rating: 5, comment: "Lovely", customerName: "Ananya S.", isDemo: true, isVerifiedPurchase: false }, { id: "d2", rating: 5, comment: "Calm", customerName: "Riya M.", isDemo: true }, { id: "d3", rating: 4, comment: "Warm", customerName: "Kavya R.", isDemo: true }];
  const real = [{ id: "r1", rating: 5, comment: "Genuine", customerName: "Priya S.", isVerifiedPurchase: true }];

  it("demo reviews render as a marquee, clearly labelled, with no verified badge or aggregate", () => {
    wrap(<ReviewsSection section={{ id: "rv", settings: { motion: "MARQUEE", demoMode: true }, reviews: demo, reviewSource: "DEMO", reviewSummary: { averageRating: 0, reviewCount: 0 } }} />);
    expect(screen.getByTestId("reviews-section")).toHaveAttribute("data-source", "DEMO");
    expect(screen.getByTestId("reviews-marquee")).toBeInTheDocument();
    expect(screen.getByTestId("reviews-demo-note").textContent).toMatch(/sample/i);
    expect(screen.queryByText("Verified")).toBeNull();
    expect(screen.queryByTestId("reviews-summary")).toBeNull();
  });

  it("real reviews carry no demo label and keep verified badges and the aggregate", () => {
    wrap(<ReviewsSection section={{ id: "rv", settings: { motion: "STATIC" }, reviews: real, reviewSource: "REAL", reviewSummary: { averageRating: 5, reviewCount: 1 } }} />);
    expect(screen.getByTestId("reviews-section")).toHaveAttribute("data-source", "REAL");
    expect(screen.queryByTestId("reviews-demo-note")).toBeNull();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByTestId("reviews-summary")).toBeInTheDocument();
  });

  it("is hidden when the server sends nothing (no real reviews and demo mode off)", () => {
    const { container } = wrap(<ReviewsSection section={{ id: "rv", settings: {}, reviews: [], reviewSource: "NONE", reviewSummary: {} }} />);
    expect(container.querySelector("[data-testid='reviews-section']")).toBeNull();
  });

  it("the marquee animation is disabled for reduced-motion users (stylesheet rule present)", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../src/index.css"), "utf8");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.reviews-marquee-track\s*\{\s*animation:\s*none/);
  });
});
