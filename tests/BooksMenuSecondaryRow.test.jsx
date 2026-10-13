import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MegaMenu, { MegaPromoCard } from "../src/components/MegaMenu";
import { buildNavModel, buildCategoryTree, resolveBooksSecondaryLinks, BOOKS_SECONDARY_LINKS } from "../src/lib/navModel";

const cat = (id, name, slug, parentId = null, extra = {}) => ({ id, name, slug, parentId, isActive: true, sortOrder: 0, ...extra });
const BOOKS = cat("books", "Books", "books");
const ALL_THEMES = [
  cat("t-int", "Home & Interiors", "books-home-and-interiors", "books"),
  cat("t-slow", "Slow Living", "books-slow-living", "books"),
  cat("t-coffee", "Coffee Table", "books-coffee-table", "books"),
  cat("t-journal", "Journaling & Guides", "books-journals-and-guides", "books"),
];
const EXISTING_LINKS = [
  { id: "l-all", label: "View All Books", enabled: true, destination: "/books" },
  { id: "l-1", label: "Spaces of Stillness", enabled: true, destination: "/shop/spaces-of-stillness" },
  { id: "l-2", label: "Aadya Home Styling Guide", enabled: true, destination: "/shop/aadya-home-styling-guide" },
  { id: "l-3", label: "The Art of Slow Living", enabled: true, destination: "/shop/the-art-of-slow-living" },
];
const booksItem = { id: "n-books", label: "Books", enabled: true, destinationType: "BOOKS", destination: "/books", megaMenuMode: "MANUAL", manualColumns: [{ id: "col-books", enabled: true, links: EXISTING_LINKS }], promoCard: { enabled: true, image: "/uploads/books.jpg", title: "Reading Edit", eyebrow: "Staff Picks", ctaLabel: "SHOP NOW →", ctaUrl: "/books", altText: "Books promo" } };
const decorItem = { id: "n-decor", label: "Home Decor", enabled: true, destinationType: "CATEGORY", categorySlug: "home-decor", megaMenuMode: "AUTO_FROM_CATEGORY" };

const model = (categories) => buildNavModel({ cms: { primaryNav: { mode: "MANUAL", items: [booksItem, decorItem] } }, categories, navigation: [] });
const booksModel = (categories) => model(categories).find((i) => i.label === "Books");
const renderMenu = (item) => render(<MemoryRouter><MegaMenu item={item} isOpen onClose={() => {}} id="m" /></MemoryRouter>);

describe("Books mega menu: secondary row", () => {
  it("renders all 6 labels in order, plus the 4 existing Books links, and keeps the promo", () => {
    renderMenu(booksModel([BOOKS, ...ALL_THEMES]));
    const row = screen.getByTestId("mega-secondary-row");
    expect(Array.from(row.children).map((c) => c.textContent)).toEqual(["New Releases", "Editor’s Picks", "Coffee Table Books", "Home & Interiors", "Slow Living", "Journals & Guides"]);
    ["View All Books", "Spaces of Stillness", "Aadya Home Styling Guide", "The Art of Slow Living"].forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
    expect(screen.getByTestId("mega-promo")).toBeInTheDocument();
  });

  it("every link points at a real destination: Books-page anchors or existing Books subcategories", () => {
    renderMenu(booksModel([BOOKS, ...ALL_THEMES]));
    const hrefs = screen.getAllByTestId("mega-secondary-link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/shop/books#new-releases", "/shop/books#editors-picks",
      "/shop/category/books-coffee-table", "/shop/category/books-home-and-interiors", "/shop/category/books-slow-living", "/shop/category/books-journals-and-guides",
    ]);
  });

  it("a label with no matching category becomes a non-clickable label, never a broken link", () => {
    renderMenu(booksModel([BOOKS, ALL_THEMES[0], ALL_THEMES[1]])); // production today: only Home & Interiors + Slow Living exist
    expect(screen.getAllByTestId("mega-secondary-link").map((a) => a.textContent)).toEqual(["New Releases", "Editor’s Picks", "Home & Interiors", "Slow Living"]);
    const labels = screen.getAllByTestId("mega-secondary-label");
    expect(labels.map((l) => l.textContent)).toEqual(["Coffee Table Books", "Journals & Guides"]);
    labels.forEach((l) => { expect(l.tagName).toBe("SPAN"); expect(l.closest("a")).toBeNull(); });
  });

  it("ignores same-named categories that are inactive or not under Books", () => {
    const stray = cat("x", "Slow Living", "books-slow-living", "other-root");
    const hidden = cat("y", "Coffee Table", "books-coffee-table", "books", { isActive: false });
    const links = resolveBooksSecondaryLinks(buildCategoryTree([BOOKS, stray, hidden, cat("other-root", "Other", "other")]));
    expect(links.find((l) => l.id === "bk-slow").to).toBeNull();
    expect(links.find((l) => l.id === "bk-coffee").to).toBeNull();
  });

  it("only the Books menu gets the row; other mega menus are unchanged", () => {
    const m = model([BOOKS, ...ALL_THEMES, cat("hd", "Home Decor", "home-decor"), cat("v", "Vases", "vases", "hd")]);
    expect(m.find((i) => i.label === "Home Decor").secondaryLinks ?? []).toEqual([]);
    const { container } = renderMenu(m.find((i) => i.label === "Home Decor"));
    expect(container.querySelector("[data-testid='mega-secondary-row']")).toBeNull();
  });

  it("defines exactly the six requested labels", () => {
    expect(BOOKS_SECONDARY_LINKS.map((l) => l.label)).toEqual(["New Releases", "Editor’s Picks", "Coffee Table Books", "Home & Interiors", "Slow Living", "Journals & Guides"]);
  });

  it("wraps cleanly (flex-wrap) with no heavy pill buttons or boxes", () => {
    renderMenu(booksModel([BOOKS, ...ALL_THEMES]));
    expect(screen.getByTestId("mega-secondary-row").className).toContain("flex-wrap");
    screen.getAllByTestId("mega-secondary-link").forEach((a) => expect(a.className).not.toMatch(/rounded|\bbg-|\bborder\b|shadow|px-\d/));
  });

  it("the promo still shows exactly one CTA arrow (the saved label already contains one)", () => {
    render(<MemoryRouter><MegaPromoCard promo={booksModel([BOOKS, ...ALL_THEMES]).promo} /></MemoryRouter>);
    const cta = screen.getByTestId("mega-promo-cta");
    expect((cta.textContent.match(/→/g) || []).length).toBe(1);
    expect(cta.textContent.replace("→", "").trim()).toBe("SHOP NOW");
  });
});
