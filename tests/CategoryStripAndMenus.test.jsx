import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Navbar from "../src/components/Navbar";
import CategoryStrip from "../src/components/CircularCategoryNav";
import { normalizeHeaderSettings, DEFAULT_HEADER_CMS_SETTINGS } from "../src/lib/headerCmsHelpers";
import { buildNavModel, buildCategoryStripModel, columnsFromAllCategories, buildCategoryTree } from "../src/lib/navModel";

let mockSettings;
const base = () => ({ general: { storeName: "Aadya" }, branding: {}, header: {}, shipping: { freeShippingThreshold: 2499 } });

const categories = [
  { id: "c-books", name: "Books", slug: "books", isActive: true, parentId: null, image: "/uploads/books.jpg", desktopBanner: "/uploads/books-banner.jpg" },
  { id: "c-fic", name: "Fiction", slug: "fiction", isActive: true, parentId: "c-books", image: null },
  { id: "c-non", name: "Non-fiction", slug: "non-fiction", isActive: true, parentId: "c-books", image: null },
  { id: "c-old", name: "Retired Genre", slug: "retired", isActive: false, parentId: "c-books", image: null },
  { id: "c-decor", name: "Home Decor", slug: "home-decor", isActive: true, parentId: null, image: null, desktopBanner: "/uploads/decor-banner.jpg" },
  { id: "c-wall", name: "Wall Decor", slug: "wall-decor", isActive: true, parentId: "c-decor", image: "/uploads/wall.jpg" },
  { id: "c-candle", name: "Candles", slug: "candles", isActive: true, parentId: "c-decor", image: null },
  { id: "c-tex", name: "Home Textiles", slug: "home-textiles", isActive: true, parentId: null, image: null },
  { id: "c-gone", name: "Gone", slug: "gone", isActive: false, parentId: null, image: "/uploads/gone.jpg" },
];
// c-decor id alias used above
categories.find((c) => c.id === "c-wall").parentId = "c-decor";

vi.mock("../src/context/CartContext", () => ({ useCart: () => ({ count: 0, setIsOpen: vi.fn() }) }));
vi.mock("../src/context/CustomerAuthContext", () => ({ useCustomerAuth: () => ({ user: null }) }));
vi.mock("../src/hooks/useSiteSettings", () => ({
  useSiteSettings: () => mockSettings,
  refreshSiteSettings: vi.fn(() => Promise.resolve()),
  applyThemeVariables: vi.fn(),
}));
vi.mock("../src/lib/api", () => ({
  fetchCategories: vi.fn(() => Promise.resolve({ data: categories })),
  fetchNavigation: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  fetchPromos: vi.fn(() => Promise.resolve({ data: [] })),
  resolveMediaUrl: (url) => (url ? `http://api.test${url}` : null),
  resolveProductImageUrl: (url) => (url ? `http://api.test${url}` : null),
}));

const cmsWith = (header) => normalizeHeaderSettings(header);
const strip = (circularCategories, extra = {}) => cmsWith({ circularCategories: { enabled: true, ...circularCategories }, ...extra });

function renderStrip(cfg, cats = categories, props = {}) {
  return render(
    <BrowserRouter>
      <CategoryStrip categories={cats} cms={strip(cfg)} {...props} />
    </BrowserRouter>
  );
}
function renderNavbar() {
  return render(
    <BrowserRouter>
      <Navbar />
    </BrowserRouter>
  );
}
const stripEl = () => document.querySelector("[data-testid='category-strip']");
const labels = () => [...document.querySelectorAll("[data-testid='category-strip-item'] span.line-clamp-2")].map((n) => n.textContent);

beforeEach(() => {
  mockSettings = base();
});

describe("Category strip", () => {
  it("1. is disabled by default (and in the shipped defaults)", async () => {
    expect(DEFAULT_HEADER_CMS_SETTINGS.circularCategories.enabled).toBe(false);
    expect(normalizeHeaderSettings({}).circularCategories.enabled).toBe(false);
    renderNavbar();
    await waitFor(() => expect(screen.getByText("Books")).toBeInTheDocument());
    expect(stripEl()).toBeNull();
  });

  it("2. renders under the primary navigation when enabled", async () => {
    mockSettings.header = { circularCategories: { enabled: true } };
    renderNavbar();
    await waitFor(() => expect(stripEl()).not.toBeNull());
    const header = document.querySelector("header");
    expect(header.contains(stripEl())).toBe(true);
    expect(stripEl().previousElementSibling.textContent).toMatch(/Books/);
  });

  it("3. OFF removes the strip completely (no wrapper, no spacing)", async () => {
    mockSettings.header = { circularCategories: { enabled: false, shape: "CIRCLE" } };
    renderNavbar();
    await waitFor(() => expect(screen.getByText("Books")).toBeInTheDocument());
    expect(stripEl()).toBeNull();
    expect(document.querySelector("header").lastElementChild.className).not.toMatch(/py-/);
  });

  it.each([
    ["CIRCLE", "rounded-full", "aspect-square"],
    ["SQUARE", "rounded-none", "aspect-square"],
    ["ROUNDED_SQUARE", "rounded-2xl", "aspect-square"],
    ["RECTANGLE", "rounded-lg", "aspect-[4/3]"],
  ])("4-7. %s shape applies %s and %s", (shape, radius, aspect) => {
    renderStrip({ shape });
    expect(stripEl().getAttribute("data-shape")).toBe(shape);
    const media = document.querySelector("[data-testid='category-strip-media']");
    expect(media.className).toContain(radius);
    expect(media.className).toContain(aspect);
    const img = media.querySelector("img");
    expect(img.className).toContain("object-cover");
    expect(img.className).toContain("h-full w-full");
  });

  it("image fit can be contain (never stretched)", () => {
    renderStrip({ imageFit: "contain" });
    expect(document.querySelector("[data-testid='category-strip-media'] img").className).toContain("object-contain");
  });

  it("8. AUTO shows active root categories only by default, subcategories on request", () => {
    renderStrip({ mode: "AUTO" });
    expect(labels()).toEqual(["Books", "Home Decor", "Home Textiles"]);
  });

  it("8b. AUTO with subcategories included hides inactive categories; NAME sort works", () => {
    renderStrip({ mode: "AUTO", rootOnly: false, sortBy: "NAME", maxItems: 24 });
    const out = labels();
    expect(out).not.toContain("Gone");
    expect(out).not.toContain("Retired Genre");
    expect(out).toEqual([...out].sort((a, b) => a.localeCompare(b)));
    expect(out).toContain("Fiction");
  });

  it("9. MANUAL shows only the selected categories in admin order with overrides", () => {
    renderStrip({
      mode: "MANUAL",
      items: [
        { id: "a", enabled: true, categoryId: "c-tex", displayLabelOverride: "Soft Furnishings", badgeText: "NEW" },
        { id: "b", enabled: true, categoryId: "c-books" },
      ],
    });
    expect(labels()).toEqual(["Soft Furnishings", "Books"]);
    expect(screen.getByText("NEW")).toBeInTheDocument();
    expect(screen.getByText("Soft Furnishings").closest("a")).toHaveAttribute("href", "/shop/category/home-textiles");
  });

  it("10. disabled manual items and inactive categories are hidden", () => {
    renderStrip({
      mode: "MANUAL",
      items: [
        { id: "a", enabled: false, categoryId: "c-tex" },
        { id: "b", enabled: true, categoryId: "c-gone" },
        { id: "c", enabled: true, categoryId: "c-books" },
      ],
    });
    expect(labels()).toEqual(["Books"]);
  });

  it("11. desktop/mobile visibility toggles", () => {
    const { unmount } = renderStrip({ showMobile: false });
    expect(stripEl().className).toContain("hidden md:block");
    unmount();
    const second = renderStrip({ showDesktop: false });
    expect(stripEl().className).toContain("md:hidden");
    second.unmount();
    renderStrip({ showDesktop: false, showMobile: false });
    expect(stripEl()).toBeNull();
  });

  it("12. labels toggle", () => {
    const { unmount } = renderStrip({ showLabels: true });
    expect(screen.getByText("Books")).toBeInTheDocument();
    unmount();
    renderStrip({ showLabels: false });
    expect(screen.queryByText("Books")).not.toBeInTheDocument();
    expect(document.querySelector("img").getAttribute("alt")).toBe("Books");
  });

  it("13. maximum item limit is respected", () => {
    renderStrip({ mode: "AUTO", rootOnly: false, maxItems: 2 });
    expect(document.querySelectorAll("[data-testid='category-strip-item']")).toHaveLength(2);
  });

  it("14. unsafe destination overrides are rejected; safe ones are used", () => {
    renderStrip({
      mode: "MANUAL",
      items: [
        { id: "a", enabled: true, categoryId: "c-books", destinationOverride: "javascript:alert(1)" },
        { id: "b", enabled: true, categoryId: "c-tex", destinationOverride: "/collections/cosy" },
      ],
    });
    expect(screen.getByText("Books").closest("a")).toHaveAttribute("href", "/shop/category/books");
    expect(screen.getByText("Home Textiles").closest("a")).toHaveAttribute("href", "/collections/cosy");
  });

  it("15. legacy flags never enable the strip", () => {
    for (const header of [{ showCategoryCircles: true }, { showCircularCategories: true }, { circularCategories: { showArrows: true } }]) {
      expect(normalizeHeaderSettings(header).circularCategories.enabled).toBe(false);
      expect(buildCategoryStripModel({ cms: normalizeHeaderSettings(header), categories })).toBeNull();
    }
    expect(normalizeHeaderSettings({ circularCategories: { enabled: "yes" } }).circularCategories.enabled).toBe(false);
  });

  it("uses canonical categoryDepth without dropping legacy rootOnly compatibility", () => {
    expect(normalizeHeaderSettings({ circularCategories: { categoryDepth: "ALL" } }).circularCategories).toMatchObject({ categoryDepth: "ALL" });
    const legacy = normalizeHeaderSettings({ circularCategories: { rootOnly: false, showDividers: false, showTopDivider: false } }).circularCategories;
    expect(legacy).toMatchObject({ categoryDepth: "ALL", showTopSeparator: false, showBottomSeparator: false });
    for (const key of ["rootOnly", "showDividers", "showTopDivider", "showBottomDivider"]) expect(legacy).not.toHaveProperty(key);
    expect(buildCategoryStripModel({ cms: strip({ categoryDepth: "ALL", maxItems: 24 }), categories }).items.map((item) => item.name)).toContain("Fiction");
  });

  it.each([
    [false, false, "false", "false"],
    [true, false, "true", "false"],
    [false, true, "false", "true"],
  ])("separator contract top=%s bottom=%s", (showTopSeparator, showBottomSeparator, top, bottom) => {
    renderStrip({ showTopSeparator, showBottomSeparator });
    expect(stripEl()).toHaveAttribute("data-top-divider", top);
    expect(stripEl()).toHaveAttribute("data-bottom-divider", bottom);
    expect(stripEl().className.includes("border-t")).toBe(showTopSeparator);
    expect(stripEl().className.includes("border-b")).toBe(showBottomSeparator);
  });

  it("scrolls inside its own container and never positions itself sticky/fixed", () => {
    renderStrip({});
    const list = stripEl().querySelector("ul");
    expect(list.className).toMatch(/overflow-x-auto/);
    expect(list.className).toMatch(/min-w-0/);
    expect(stripEl().className).toMatch(/overflow-x-clip/);
    expect(stripEl().className).not.toMatch(/sticky|fixed/);
  });

  it("desktop and mobile item sizes map to different sensible widths", () => {
    renderStrip({ desktopSize: "large", mobileSize: "small" });
    const li = document.querySelector("[data-testid='category-strip-item']");
    expect(li.style.getPropertyValue("--strip-w-d")).toBe("120px");
    expect(li.style.getPropertyValue("--strip-w-m")).toBe("56px");
  });

  it("rectangle cards stay compact", () => {
    renderStrip({ shape: "RECTANGLE", desktopSize: "large", mobileSize: "large" });
    const li = document.querySelector("[data-testid='category-strip-item']");
    expect(parseInt(li.style.getPropertyValue("--strip-w-d"), 10)).toBeLessThanOrEqual(180);
    expect(parseInt(li.style.getPropertyValue("--strip-w-m"), 10)).toBeLessThanOrEqual(132);
  });

  it("scroll arrows are optional", () => {
    const { unmount } = renderStrip({ showArrows: true });
    expect(screen.getByLabelText("Scroll left")).toBeInTheDocument();
    unmount();
    renderStrip({ showArrows: false });
    expect(screen.queryByLabelText("Scroll left")).not.toBeInTheDocument();
  });
});

describe("Category strip thumbnails", () => {
  const manual = (item) => buildCategoryStripModel({ cms: strip({ mode: "MANUAL", items: [{ id: "x", enabled: true, ...item }] }), categories }).items[0];

  it("T1. manual imageOverride renders and wins over the category image", () => {
    renderStrip({ mode: "MANUAL", items: [{ id: "x", enabled: true, categoryId: "c-books", imageOverride: "/uploads/custom.jpg" }] });
    expect(document.querySelector("img").getAttribute("src")).toBe("http://api.test/uploads/custom.jpg");
  });

  it("T2. AUTO uses each category's real image", () => {
    renderStrip({ mode: "AUTO" });
    const srcs = [...document.querySelectorAll("img")].map((i) => i.getAttribute("src"));
    expect(srcs).toContain("http://api.test/uploads/books.jpg");
  });

  it("T3. fallback order: override -> category.image -> desktopBanner -> placeholder", () => {
    expect(manual({ categoryId: "c-books", imageOverride: "/uploads/o.jpg" }).image).toBe("/uploads/o.jpg");
    expect(manual({ categoryId: "c-books" }).image).toBe("/uploads/books.jpg");
    expect(manual({ categoryId: "c-decor" }).image).toBe("/uploads/decor-banner.jpg");
    expect(manual({ categoryId: "c-tex" }).image).toBeNull();
    renderStrip({ mode: "MANUAL", items: [{ id: "x", enabled: true, categoryId: "c-tex" }] });
    expect(screen.getByTestId("category-strip-placeholder")).toHaveTextContent("H");
  });

  it("T4. mobile image override is used on mobile (<source>) and on the mobile preview", () => {
    const item = { id: "x", enabled: true, categoryId: "c-books", imageOverride: "/uploads/d.jpg", mobileImageOverride: "/uploads/m.jpg" };
    const { unmount } = renderStrip({ mode: "MANUAL", items: [item] });
    const source = document.querySelector("picture source");
    expect(source.getAttribute("media")).toBe("(max-width: 767px)");
    expect(source.getAttribute("srcset")).toBe("http://api.test/uploads/m.jpg");
    expect(document.querySelector("img").getAttribute("src")).toBe("http://api.test/uploads/d.jpg");
    unmount();
    renderStrip({ mode: "MANUAL", items: [item] }, categories, { forceViewport: "mobile" });
    expect(document.querySelector("img").getAttribute("src")).toBe("http://api.test/uploads/m.jpg");
  });

  it("T5. a missing or broken image does not break the layout", () => {
    renderStrip({ mode: "MANUAL", items: [{ id: "x", enabled: true, categoryId: "c-tex" }, { id: "y", enabled: true, categoryId: "c-books" }] });
    const medias = document.querySelectorAll("[data-testid='category-strip-media']");
    expect(medias).toHaveLength(2);
    medias.forEach((m) => expect(m.className).toContain("aspect-square"));
    fireEvent.error(document.querySelector("img"));
    expect(screen.getAllByTestId("category-strip-placeholder")).toHaveLength(2);
  });

  it("T6. unsafe image overrides are ignored", () => {
    expect(manual({ categoryId: "c-books", imageOverride: "javascript:alert(1)" }).image).toBe("/uploads/books.jpg");
  });
});

describe("Navigation hover menus", () => {
  const nav = (items, extra = {}) => cmsWith({ primaryNav: { enabled: true, mode: "MANUAL", items }, ...extra });
  const item = (extra) => ({ id: "n", label: "Books", enabled: true, destinationType: "BOOKS", destination: "/books", ...extra });
  const model = (items, extra) => buildNavModel({ cms: nav(items, extra), categories });
  const linkLabels = (navItem) => navItem.columns.flatMap((c) => [c.title, ...c.links.map((l) => l.label)]).filter(Boolean);

  it("16. DISABLED produces no hover menu", () => {
    const [b] = model([item({ megaMenuMode: "DISABLED" })]);
    expect(b.hasMenu).toBe(false);
    expect(b.columns).toEqual([]);
  });

  it("17-18. AUTO_FROM_CATEGORY shows active children and hides inactive ones", () => {
    const [b] = model([item({ destinationType: "CATEGORY", categoryId: "c-books", megaMenuMode: "AUTO_FROM_CATEGORY" })]);
    expect(linkLabels(b)).toEqual(expect.arrayContaining(["Fiction", "Non-fiction"]));
    expect(linkLabels(b)).not.toContain("Retired Genre");
  });

  it("L. a parent's children are organised into columns using the existing hierarchy rules", () => {
    const [d] = model([item({ id: "d", label: "Home Decor", destinationType: "CATEGORY", categoryId: "c-decor", megaMenuMode: "AUTO_FROM_CATEGORY" })]);
    expect(linkLabels(d)).toEqual(expect.arrayContaining(["Wall Decor", "Candles"]));
  });

  it("19. ALL_CATEGORIES shows all active categories (roots by default) with real links", () => {
    const [b] = model([item({ megaMenuMode: "ALL_CATEGORIES" })]);
    expect(b.hasMenu).toBe(true);
    expect(linkLabels(b)).toEqual(expect.arrayContaining(["Books", "Home Decor", "Home Textiles"]));
    expect(linkLabels(b)).not.toContain("Gone");
    const links = b.columns.flatMap((c) => c.links);
    expect(links.find((l) => l.label === "Home Decor").to).toBe("/shop/category/home-decor");
  });

  it("19b. scope ALL includes subcategories grouped under their parent; PARENTS limits to chosen parents", () => {
    const [all] = model([item({ megaMenuMode: "ALL_CATEGORIES", megaCategoryScope: "ALL" })]);
    expect(all.columns.find((c) => c.title === "Books").links.map((l) => l.label)).toEqual(["Fiction", "Non-fiction"]);
    expect(linkLabels(all)).not.toContain("Retired Genre");
    const [parents] = model([item({ megaMenuMode: "ALL_CATEGORIES", megaCategoryScope: "PARENTS", megaParentIds: ["c-decor"] })]);
    expect(linkLabels(parents)).toEqual(["Home Decor", "Wall Decor", "Candles"]);
  });

  it("20. per-menu excluded categories are hidden without deactivating them", () => {
    const [b] = model([item({ megaMenuMode: "ALL_CATEGORIES", megaExcludedCategoryIds: ["c-decor", "c-tex"] })]);
    expect(linkLabels(b)).toEqual(["Books"]);
    expect(categories.find((c) => c.id === "c-decor").isActive).toBe(true);
    const tree = buildCategoryTree(categories);
    const cols = columnsFromAllCategories(tree, { scope: "ALL", excludedIds: ["c-decor"] });
    expect(cols.flatMap((c) => [c.title, ...c.links.map((l) => l.label)])).not.toContain("Wall Decor");
  });

  it("maximum category count limits the menu", () => {
    const [b] = model([item({ megaMenuMode: "ALL_CATEGORIES", megaMaxCategories: 2 })]);
    expect(b.columns.flatMap((c) => c.links)).toHaveLength(2);
  });

  it("21. MANUAL columns work", () => {
    const [b] = model([item({ megaMenuMode: "MANUAL", manualColumns: [{ id: "g", heading: "Shop by Genre", enabled: true, links: [{ label: "Fiction", destination: "/shop/category/fiction" }, { label: "Bad", destination: "javascript:1" }] }] })]);
    expect(b.columns[0].title).toBe("Shop by Genre");
    expect(b.columns[0].links.map((l) => l.label)).toEqual(["Fiction"]);
  });

  it("22. top-level enabled OFF removes the item but keeps configuration", () => {
    const items = [item({ enabled: false }), item({ id: "m", label: "Other", destinationType: "CUSTOM_URL", destination: "/o" })];
    const out = model(items);
    expect(out.map((i) => i.label)).toEqual(["Other"]);
    expect(items[0].megaMenuMode).toBeUndefined();
  });

  it("23. desktop/mobile toggles are exposed per item", () => {
    const [a] = model([item({ showDesktop: false, showMobile: true })]);
    expect(a.showDesktop).toBe(false);
    expect(a.showMobile).toBe(true);
  });

  it("24. global Enable Mega Menus OFF turns every dropdown into a plain link", () => {
    const items = [item({ megaMenuMode: "ALL_CATEGORIES" }), item({ id: "z", label: "Decor", destinationType: "CATEGORY", categoryId: "c-decor", megaMenuMode: "AUTO_FROM_CATEGORY" })];
    for (const header of [{ megaMenu: { enabled: false } }, { primaryNav: { enabled: true, mode: "MANUAL", items, enableMegaMenu: false } }]) {
      const out = buildNavModel({ cms: cmsWith({ primaryNav: { enabled: true, mode: "MANUAL", items }, ...header, ...(header.primaryNav ? { primaryNav: header.primaryNav } : {}) }), categories });
      expect(out.every((i) => !i.hasMenu && i.columns.length === 0)).toBe(true);
    }
  });

  it("25. Books pointing at /books can independently show all categories", () => {
    const [b] = model([item({ destinationType: "BOOKS", destination: "/books", megaMenuMode: "ALL_CATEGORIES" })]);
    expect(b.to).toBe("/books");
    expect(b.hasMenu).toBe(true);
    expect(b.columns.length).toBeGreaterThan(0);
  });

  it("Strip and mega menus are independent of each other", () => {
    for (const stripOn of [true, false]) {
      for (const megaOn of [true, false]) {
        const cms = cmsWith({
          primaryNav: { enabled: true, mode: "MANUAL", items: [item({ megaMenuMode: "ALL_CATEGORIES" })] },
          megaMenu: { enabled: megaOn },
          circularCategories: { enabled: stripOn },
        });
        expect(buildNavModel({ cms, categories })[0].hasMenu).toBe(megaOn);
        expect(!!buildCategoryStripModel({ cms, categories })).toBe(stripOn);
      }
    }
  });

  it("Books hover (DOM) opens the ALL_CATEGORIES dropdown and links to real destinations", async () => {
    mockSettings.header = { primaryNav: { enabled: true, mode: "MANUAL", items: [item({ megaMenuMode: "ALL_CATEGORIES" })] } };
    renderNavbar();
    const trigger = await screen.findByRole("link", { name: /Books/ });
    fireEvent.mouseEnter(trigger);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    await waitFor(() => expect(within(nav.parentElement).getAllByRole("link", { name: "Home Decor" }).length).toBeGreaterThan(0));
    const decor = within(nav.parentElement).getAllByRole("link", { name: "Home Decor" })[0];
    expect(decor).toHaveAttribute("href", "/shop/category/home-decor");
  });

  it("26. the mobile drawer uses the same normalized nav data", async () => {
    mockSettings.header = {
      primaryNav: {
        enabled: true,
        mode: "MANUAL",
        items: [item({ megaMenuMode: "ALL_CATEGORIES", megaExcludedCategoryIds: ["c-tex"] }), item({ id: "hid", label: "Desktop Only", destinationType: "CUSTOM_URL", destination: "/d", showMobile: false })],
      },
    };
    renderNavbar();
    await screen.findAllByText("Books");
    fireEvent.click(screen.getByLabelText("Open menu"));
    const toggle = await screen.findByLabelText("Toggle Books menu");
    fireEvent.click(toggle);
    const panel = document.getElementById("mobile-submenu-n");
    expect(within(panel).getByText("Home Decor")).toBeInTheDocument();
    expect(within(panel).queryByText("Home Textiles")).not.toBeInTheDocument();
    expect(screen.queryByText("Desktop Only", { selector: "a" })).toBeNull();
  });
});

describe("Header regression safety", () => {
  it("27. the header never becomes sticky/fixed (strip on or off)", async () => {
    for (const enabled of [false, true]) {
      mockSettings.header = { stickyMode: "always", stickyHeader: true, circularCategories: { enabled } };
      const { unmount } = renderNavbar();
      await waitFor(() => expect(screen.getAllByText("Books").length).toBeGreaterThan(0));
      const header = document.querySelector("header");
      expect(header.className).not.toMatch(/sticky|fixed/);
      if (enabled) await waitFor(() => expect(stripEl()).not.toBeNull());
      if (stripEl()) expect(stripEl().className).not.toMatch(/sticky|fixed/);
      unmount();
    }
  });

  it("28. no strip when the toggle is OFF, regardless of other strip settings", async () => {
    mockSettings.header = { circularCategories: { enabled: false, shape: "RECTANGLE", mode: "MANUAL", items: [{ id: "a", enabled: true, categoryId: "c-books" }] } };
    renderNavbar();
    await waitFor(() => expect(screen.getAllByText("Books").length).toBeGreaterThan(0));
    expect(stripEl()).toBeNull();
  });
});
