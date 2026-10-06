import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Navbar from "../src/components/Navbar";
import AdminHeaderSettings from "../src/pages/admin/AdminHeaderSettings";
import { normalizeHeaderSettings } from "../src/lib/headerCmsHelpers";
import { adminUpdateSiteSettings } from "../src/lib/api";

let mockSettings;
const baseSettings = () => ({
  general: { storeName: "Aadya" },
  branding: {},
  header: {},
  shipping: { freeShippingThreshold: 2499 },
});

const mockCategories = [
  { id: "c-light", name: "Lighting", slug: "lighting", isActive: true, parentId: null, image: "/uploads/light.jpg" },
  { id: "c-ceil", name: "Ceiling Lights", slug: "ceiling-lights", isActive: true, parentId: "c-light" },
  { id: "c-wall", name: "Wall Lights", slug: "wall-lights", isActive: true, parentId: "c-light" },
  { id: "c-hidden", name: "Hidden Lamps", slug: "hidden-lamps", isActive: false, parentId: "c-light" },
  { id: "c-cer", name: "Ceramics", slug: "ceramics", isActive: true, parentId: null },
];

vi.mock("../src/context/CartContext", () => ({
  useCart: () => ({ count: 4, setIsOpen: vi.fn() }),
}));
vi.mock("../src/context/CustomerAuthContext", () => ({
  useCustomerAuth: () => ({ user: null }),
}));
vi.mock("../src/hooks/useSiteSettings", () => ({
  useSiteSettings: () => mockSettings,
  refreshSiteSettings: vi.fn(() => Promise.resolve()),
  applyThemeVariables: vi.fn(),
}));
vi.mock("../src/lib/api", () => ({
  fetchCategories: vi.fn(() => Promise.resolve({ data: mockCategories })),
  fetchNavigation: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  fetchPromos: vi.fn(() => Promise.resolve({ data: [] })),
  adminFetchSiteSettings: vi.fn(() => Promise.resolve({ data: mockSettings })),
  adminUpdateSiteSettings: vi.fn((data) => Promise.resolve({ data })),
  adminListCategories: vi.fn(() => Promise.resolve({ data: mockCategories })),
  resolveMediaUrl: (url) => (url ? `http://api.test${url}` : null),
}));

const navItems = [
  { id: "n-light", label: "Lighting", enabled: true, destinationType: "CATEGORY", categoryId: "c-light", categorySlug: "lighting", megaMenuMode: "AUTO_FROM_CATEGORY" },
  { id: "n-cer", label: "Ceramics", enabled: true, destinationType: "CATEGORY", categoryId: "c-cer", megaMenuMode: "DISABLED" },
  { id: "n-off", label: "Hidden Item", enabled: false, destinationType: "CUSTOM_URL", destination: "/x" },
  {
    id: "n-books", label: "Books", enabled: true, destinationType: "BOOKS", destination: "/books", megaMenuMode: "MANUAL",
    manualColumns: [
      { id: "col-1", heading: "Browse", enabled: true, links: [
        { id: "l1", label: "Fiction", destination: "/shop/category/fiction", enabled: true },
        { id: "l2", label: "Off Link", destination: "/shop/category/off", enabled: false },
        { id: "l3", label: "Bad", destination: "javascript:alert(1)", enabled: true },
      ] },
    ],
    promoCard: { enabled: true, image: "/uploads/books.jpg", title: "Reading Edit", eyebrow: "Staff Picks", ctaLabel: "Read", ctaUrl: "/books", altText: "Books promo" },
  },
];

function withNav(extra = {}) {
  mockSettings.header = { primaryNav: { enabled: true, mode: "MANUAL", items: navItems }, ...extra };
}

function renderNavbar() {
  return render(
    <BrowserRouter>
      <Navbar />
    </BrowserRouter>
  );
}

const navRow = () => screen.getByRole("navigation", { name: "Primary" });

describe("Primary nav + mega menus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = baseSettings();
  });

  it("1. circular category strip is absent by default", async () => {
    const { container } = renderNavbar();
    await waitFor(() => expect(screen.getByText("Lighting")).toBeInTheDocument());
    expect(container.querySelector(".group\\/scroller")).toBeNull();
    expect(screen.queryByLabelText("Scroll left")).not.toBeInTheDocument();
  });

  it("1b. circular strip still renders when explicitly enabled", async () => {
    mockSettings.header = { circularCategories: { enabled: true } };
    const { container } = renderNavbar();
    await waitFor(() => expect(container.querySelector(".group\\/scroller")).not.toBeNull());
  });

  it("2. hero follows nav with nothing in between", async () => {
    const { container } = renderNavbar();
    await waitFor(() => expect(screen.getByText("Lighting")).toBeInTheDocument());
    const header = container.querySelector("header");
    expect(header.lastElementChild.contains(navRow())).toBe(true);
  });

  it("3. default sticky mode is none, explicit saved choices are preserved", () => {
    expect(normalizeHeaderSettings({}).stickyMode).toBe("none");
    expect(normalizeHeaderSettings({ stickyMode: "always" }).stickyMode).toBe("always");
    expect(normalizeHeaderSettings({ stickyHeader: true }).stickyMode).toBe("always");
    expect(normalizeHeaderSettings({ stickyHeader: false }).stickyMode).toBe("none");
    expect(normalizeHeaderSettings({}).circularCategories.enabled).toBe(false);
    expect(normalizeHeaderSettings({ circularCategories: { enabled: true } }).circularCategories.enabled).toBe(true);
  });

  it("4. no sticky/fixed classes in default mode", async () => {
    const { container } = renderNavbar();
    await waitFor(() => expect(screen.getByText("Lighting")).toBeInTheDocument());
    expect(container.innerHTML).not.toMatch(/(sticky|fixed)/);
    expect(container.querySelector("header").className).not.toMatch(/top-0|z-40/);
  });

  it("4b. sticky classes appear only when explicitly configured", async () => {
    mockSettings.header = { stickyMode: "always" };
    const { container } = renderNavbar();
    expect(container.querySelector("header").className).toMatch(/sticky/);
  });

  it("5. renders admin-configured enabled items in order", async () => {
    withNav();
    renderNavbar();
    await waitFor(() => expect(within(navRow()).getByText("Lighting")).toBeInTheDocument());
    const labels = within(navRow()).getAllByRole("link").map((a) => a.textContent.trim());
    expect(labels).toEqual(["Lighting", "Ceramics", "Books"]);
    expect(within(navRow()).queryByText("Hidden Item")).not.toBeInTheDocument();
  });

  it("6/7/13. AUTO_FROM_CATEGORY opens on hover with real children; inactive hidden; leaving closes", async () => {
    withNav();
    renderNavbar();
    await waitFor(() => expect(within(navRow()).getByText("Lighting")).toBeInTheDocument());
    const trigger = within(navRow()).getByText("Lighting").closest("a");
    expect(trigger).toHaveAttribute("href", "/shop/category/lighting");

    fireEvent.mouseEnter(trigger.parentElement);
    await waitFor(() => expect(screen.getByTestId("mega-menu")).toBeInTheDocument());
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByTestId("mega-menu");
    expect(within(menu).getByText("Ceiling Lights").closest("a")).toHaveAttribute("href", "/shop/category/ceiling-lights");
    expect(within(menu).getByText("Wall Lights")).toBeInTheDocument();
    expect(within(menu).queryByText("Hidden Lamps")).not.toBeInTheDocument();

    fireEvent.mouseLeave(trigger.closest("div.relative.py-1").parentElement.parentElement);
    await waitFor(() => expect(screen.queryByTestId("mega-menu")).not.toBeInTheDocument());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("14. Escape closes the menu", async () => {
    withNav();
    renderNavbar();
    await waitFor(() => expect(within(navRow()).getByText("Lighting")).toBeInTheDocument());
    const trigger = within(navRow()).getByText("Lighting").closest("a");
    fireEvent.focus(trigger);
    await waitFor(() => expect(screen.getByTestId("mega-menu")).toBeInTheDocument());
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("mega-menu")).not.toBeInTheDocument());
  });

  it("9. DISABLED mega menu does not open", async () => {
    withNav();
    renderNavbar();
    await waitFor(() => expect(within(navRow()).getByText("Ceramics")).toBeInTheDocument());
    const trigger = within(navRow()).getByText("Ceramics").closest("a");
    expect(trigger).not.toHaveAttribute("aria-expanded");
    fireEvent.mouseEnter(trigger.parentElement);
    fireEvent.focus(trigger);
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByTestId("mega-menu")).not.toBeInTheDocument();
  });

  it("8/10/11. MANUAL (Books) renders configured columns, skips disabled/unsafe links, shows promo", async () => {
    withNav();
    renderNavbar();
    await waitFor(() => expect(within(navRow()).getByText("Books")).toBeInTheDocument());
    const trigger = within(navRow()).getByText("Books").closest("a");
    expect(trigger).toHaveAttribute("href", "/books");
    fireEvent.focus(trigger);
    const menu = await screen.findByTestId("mega-menu");
    expect(within(menu).getByText("Browse")).toBeInTheDocument();
    expect(within(menu).getByText("Fiction").closest("a")).toHaveAttribute("href", "/shop/category/fiction");
    expect(within(menu).queryByText("Off Link")).not.toBeInTheDocument();
    expect(within(menu).queryByText("Bad")).not.toBeInTheDocument();
    expect(screen.getByTestId("mega-promo")).toBeInTheDocument();
    expect(screen.getByAltText("Books promo")).toHaveAttribute("src", "http://api.test/uploads/books.jpg");
    expect(screen.getByText("Reading Edit")).toBeInTheDocument();
  });

  it("12. promo card omitted when not configured", async () => {
    withNav();
    renderNavbar();
    await waitFor(() => expect(within(navRow()).getByText("Lighting")).toBeInTheDocument());
    fireEvent.focus(within(navRow()).getByText("Lighting").closest("a"));
    await screen.findByTestId("mega-menu");
    expect(screen.queryByTestId("mega-promo")).not.toBeInTheDocument();
  });

  it("15. mobile accordion uses the same nav data", async () => {
    withNav();
    renderNavbar();
    await waitFor(() => expect(within(navRow()).getByText("Lighting")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Open menu"));
    const toggle = await screen.findByLabelText("Toggle Lighting menu");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Ceiling Lights")).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Ceiling Lights")).toBeInTheDocument();
    expect(screen.queryByText("Hidden Lamps")).not.toBeInTheDocument();
    // Ceramics has its mega menu disabled -> no expander
    expect(screen.queryByLabelText("Toggle Ceramics menu")).not.toBeInTheDocument();
  });

  it("17. cart, search and account still work", async () => {
    renderNavbar();
    expect(screen.getByText("Cart")).toBeInTheDocument();
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/search/i).length).toBeGreaterThan(0);
    expect(screen.getByTitle("Sign In")).toHaveAttribute("href", "/login");
  });
});

describe("Admin Header CMS: nav mega menu mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = baseSettings();
  });

  it("16. saves mega menu mode and category mapping", async () => {
    render(
      <BrowserRouter>
        <AdminHeaderSettings />
      </BrowserRouter>
    );
    await waitFor(() => expect(screen.getByText("Header & Navigation CMS")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Primary Navigation"));
    fireEvent.change(screen.getByDisplayValue(/AUTO \(Category/), { target: { value: "MANUAL" } });
    fireEvent.click(screen.getByText("+ Add Navigation Item"));

    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "c-light" } });
    expect(screen.getByLabelText("Mega Menu")).toHaveValue("AUTO_FROM_CATEGORY");

    fireEvent.click(screen.getByText("Save Changes"));
    await waitFor(() => expect(adminUpdateSiteSettings).toHaveBeenCalled());
    const saved = adminUpdateSiteSettings.mock.calls[0][0].header.primaryNav;
    expect(saved.mode).toBe("MANUAL");
    expect(saved.items[0]).toMatchObject({
      destinationType: "CATEGORY",
      categoryId: "c-light",
      categorySlug: "lighting",
      megaMenuMode: "AUTO_FROM_CATEGORY",
      destination: "/shop/category/lighting",
    });
  });

  it("16b. preview shows mega menu for a chosen item and no circles by default", async () => {
    withNav();
    render(
      <BrowserRouter>
        <AdminHeaderSettings />
      </BrowserRouter>
    );
    await waitFor(() => expect(screen.getByText("Header & Navigation CMS")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Live Preview"));
    const picker = screen.getByTestId("preview-menu-picker");
    fireEvent.click(within(picker).getByText("Lighting"));
    expect(await screen.findByText("Ceiling Lights")).toBeInTheDocument();
    expect(screen.getByText("Hero starts here")).toBeInTheDocument();
    expect(screen.queryByLabelText("Scroll left")).not.toBeInTheDocument();
  });
});
