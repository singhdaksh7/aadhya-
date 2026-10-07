import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import AdminHeaderSettings from "../src/pages/admin/AdminHeaderSettings";

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
const cats = [
  { id: "c-books", name: "Books", slug: "books", isActive: true, parentId: null, image: "/uploads/books.jpg" },
  { id: "c-fic", name: "Fiction", slug: "fiction", isActive: true, parentId: "c-books" },
  { id: "c-decor", name: "Home Decor", slug: "home-decor", isActive: true, parentId: null },
];

vi.mock("../src/context/CartContext", () => ({ useCart: () => ({ count: 0, setIsOpen: vi.fn() }) }));
vi.mock("../src/context/CustomerAuthContext", () => ({ useCustomerAuth: () => ({ user: null }) }));
vi.mock("../src/hooks/useSiteSettings", () => ({
  useSiteSettings: () => ({ general: {}, branding: {}, header: {}, shipping: {} }),
  refreshSiteSettings: vi.fn(() => Promise.resolve()),
  applyThemeVariables: vi.fn(),
}));
vi.mock("../src/lib/api", () => ({
  fetchCategories: vi.fn(() => Promise.resolve({ data: cats })),
  fetchNavigation: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  fetchPromos: vi.fn(() => Promise.resolve({ data: [] })),
  adminFetchSiteSettings: vi.fn(() => Promise.resolve({ data: { header: {}, shipping: {}, general: {} } })),
  adminUpdateSiteSettings: (...a) => mocks.update(...a),
  adminListCategories: vi.fn(() => Promise.resolve({ data: cats })),
  resolveMediaUrl: (u) => u || null,
  resolveProductImageUrl: (u) => u || null,
}));

const header = () => mocks.update.mock.calls.at(-1)[0].header;
const save = () => fireEvent.click(screen.getByText("Save Changes"));
async function open(tab) {
  render(
    <BrowserRouter>
      <AdminHeaderSettings />
    </BrowserRouter>
  );
  await waitFor(() => expect(screen.getByText("Header & Navigation CMS")).toBeInTheDocument());
  fireEvent.click(screen.getByText(tab));
}

describe("Admin: category strip + nav item editors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockImplementation((body) => Promise.resolve({ data: body }));
  });

  it("MANUAL strip item: category, label, thumbnails, badge, destination, reorder, remove", async () => {
    await open("Category Scroller Strip");
    fireEvent.change(screen.getByLabelText("Category Source Mode"), { target: { value: "MANUAL" } });
    fireEvent.click(screen.getByText("+ Add Category"));
    fireEvent.click(screen.getByText("+ Add Category"));
    expect(screen.getAllByText("Thumbnail Image Override")).toHaveLength(2);
    expect(screen.getAllByText(/Mobile Thumbnail Override/)).toHaveLength(2);

    const ed = screen.getByTestId("strip-item-editor-0");
    fireEvent.change(ed.querySelector("select"), { target: { value: "c-books" } });
    fireEvent.change(ed.querySelector("input[placeholder='Books']"), { target: { value: "Reads" } });
    fireEvent.change(ed.querySelector("input[placeholder='NEW']"), { target: { value: "HOT" } });
    fireEvent.change(ed.querySelector("input[placeholder='/shop/category/books']"), { target: { value: "/books" } });

    fireEvent.click(screen.getAllByLabelText("Move strip item down")[0]);
    fireEvent.click(screen.getAllByLabelText("Remove strip item")[0]);
    save();
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    const items = header().circularCategories.items;
    expect(items).toHaveLength(1);
    // after the move the configured item is second; removing the first (blank) one leaves it
    expect(items[0]).toMatchObject({ categoryId: "c-books", slug: "books", displayLabelOverride: "Reads", badgeText: "HOT", destinationOverride: "/books" });
  });

  it("AUTO strip settings: depth, sizes, fit and display toggles save", async () => {
    await open("Category Scroller Strip");
    fireEvent.change(screen.getByLabelText("Category Depth"), { target: { value: "ALL" } });
    fireEvent.change(screen.getByLabelText("Desktop Item Size"), { target: { value: "large" } });
    fireEvent.change(screen.getByLabelText("Mobile Item Size"), { target: { value: "small" } });
    fireEvent.change(screen.getByLabelText("Image Fit"), { target: { value: "contain" } });
    fireEvent.click(screen.getByLabelText("Show on Mobile"));
    save();
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(header().circularCategories).toMatchObject({
      rootOnly: false,
      desktopSize: "large",
      mobileSize: "small",
      imageFit: "contain",
      showMobile: false,
      enabled: false,
    });
  });

  it("Books nav item: show toggle, ALL_CATEGORIES, scope, parents, exclusions, max", async () => {
    await open("Primary Navigation");
    fireEvent.change(screen.getByDisplayValue(/AUTO \(Category/), { target: { value: "MANUAL" } });
    fireEvent.click(screen.getByText("+ Add Navigation Item"));
    expect(screen.getByText("Show this menu item on storefront")).toBeInTheDocument();

    const ed = screen.getByTestId("nav-item-editor-0");
    fireEvent.change(ed.querySelector("input[type='text']"), { target: { value: "Books" } });
    fireEvent.change(screen.getByLabelText("Destination Type"), { target: { value: "BOOKS" } });
    fireEvent.change(screen.getByLabelText("Mega Menu Mode"), { target: { value: "ALL_CATEGORIES" } });
    fireEvent.change(screen.getByLabelText("Category Scope"), { target: { value: "PARENTS" } });
    fireEvent.click(screen.getByLabelText("Parent Books"));
    fireEvent.click(screen.getByLabelText("Include Home Decor"));
    fireEvent.change(screen.getByLabelText("Maximum Categories Shown"), { target: { value: "10" } });
    save();
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(header().primaryNav.items[0]).toMatchObject({
      label: "Books",
      destinationType: "BOOKS",
      destination: "/books",
      megaMenuMode: "ALL_CATEGORIES",
      megaCategoryScope: "PARENTS",
      megaParentIds: ["c-books"],
      megaExcludedCategoryIds: ["c-decor"],
      megaMaxCategories: 10,
    });
  });

  it("hiding a nav item keeps its configuration (enabled=false)", async () => {
    await open("Primary Navigation");
    fireEvent.change(screen.getByDisplayValue(/AUTO \(Category/), { target: { value: "MANUAL" } });
    fireEvent.click(screen.getByText("+ Add Navigation Item"));
    fireEvent.click(screen.getByLabelText("Enable New Collection"));
    expect(screen.getByText(/Hidden on storefront/)).toBeInTheDocument();
    save();
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(header().primaryNav.items[0]).toMatchObject({ enabled: false, label: "New Collection" });
  });

  it("Enable Mega Menus is one master switch (writes both flags)", async () => {
    await open("Mega Menu");
    fireEvent.click(screen.getByLabelText("Enable Mega Menus"));
    save();
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(header().megaMenu.enabled).toBe(false);
    expect(header().primaryNav.enableMegaMenu).toBe(false);
  });

  it("Live Preview reflects the draft strip shape", async () => {
    await open("Category Scroller Strip");
    fireEvent.click(screen.getByLabelText("Enable Category Strip"));
    fireEvent.change(screen.getByLabelText("Item Shape"), { target: { value: "ROUNDED_SQUARE" } });
    fireEvent.click(screen.getByText("Live Preview"));
    await waitFor(() => expect(document.querySelector("[data-testid='category-strip']")).not.toBeNull());
    expect(document.querySelector("[data-testid='category-strip']").getAttribute("data-shape")).toBe("ROUNDED_SQUARE");
    fireEvent.click(screen.getByText("Mobile (390px)"));
    expect(document.querySelector("[data-testid='category-strip']")).not.toBeNull();
  });
});
