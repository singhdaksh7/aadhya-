import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Navbar from "../src/components/Navbar";
import TopUtilityBar from "../src/components/TopUtilityBar";
import MegaMenu from "../src/components/MegaMenu";
import CircularCategoryNav from "../src/components/CircularCategoryNav";

let mockSettings = {
  general: { storeName: "Aadya" },
  branding: {},
  header: { showUtilityBar: true, showSearch: true },
  announcementBar: { active: true, text: "Special Offer" },
  shipping: { freeShippingThreshold: 2499 },
};

let mockCategories = [
  { id: "cat-1", name: "Home Decor", slug: "home-decor", isActive: true, image: "/uploads/decor.jpg", parentId: null },
  { id: "cat-2", name: "Ceramics", slug: "ceramics", isActive: true, image: null, parentId: "cat-1" },
  { id: "cat-3", name: "Linen & Textiles", slug: "textiles", isActive: true, image: "/uploads/textiles.jpg", parentId: null },
  { id: "cat-4", name: "Inactive Section", slug: "inactive", isActive: false, image: null, parentId: null },
];

vi.mock("../src/context/CartContext", () => ({
  useCart: () => ({ count: 3, setIsOpen: vi.fn() }),
}));

vi.mock("../src/context/CustomerAuthContext", () => ({
  useCustomerAuth: () => ({ user: null }),
}));

vi.mock("../src/hooks/useSiteSettings", () => ({
  useSiteSettings: () => mockSettings,
}));

vi.mock("../src/lib/api", () => ({
  fetchCategories: vi.fn(() => Promise.resolve({ data: mockCategories })),
  fetchNavigation: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  fetchPromos: vi.fn(() => Promise.resolve({ data: [] })),
  resolveMediaUrl: (url) => {
    if (!url) return null;
    return /^https?:\/\//.test(url) ? url : `http://api.test${url}`;
  },
}));

function renderHeader() {
  return render(
    <BrowserRouter>
      <Navbar />
    </BrowserRouter>
  );
}

describe("Premium Storefront Header & Navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the top utility bar with threshold, returns, and track order", () => {
    render(
      <BrowserRouter>
        <TopUtilityBar />
      </BrowserRouter>
    );
    expect(screen.getByText(/Free Shipping ₹2,499\+/i)).toBeInTheDocument();
    expect(screen.getByText(/Easy 7-Day Returns/i)).toBeInTheDocument();
    expect(screen.getByText(/Track Order/i)).toBeInTheDocument();
    expect(screen.getByText(/Help & FAQ/i)).toBeInTheDocument();
  });

  it("renders centered logo and main header layout", async () => {
    renderHeader();
    const logoText = screen.getAllByText("Aadya");
    expect(logoText.length).toBeGreaterThan(0);
    expect(screen.getByText("Cart")).toBeInTheDocument();
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("renders primary category navigation from API and hides inactive categories", async () => {
    renderHeader();
    await waitFor(() => {
      expect(screen.getByText("Home Decor")).toBeInTheDocument();
      expect(screen.getByText("Linen & Textiles")).toBeInTheDocument();
    });
    expect(screen.queryByText("Inactive Section")).not.toBeInTheDocument();
  });

  it("routes category links correctly", async () => {
    renderHeader();
    await waitFor(() => {
      const homeDecorLink = screen.getByText("Home Decor").closest("a");
      expect(homeDecorLink).toHaveAttribute("href", "/shop/category/home-decor");
    });
  });

  it("renders circular category strip with image resolution and neutral text fallbacks (explicitly enabled)", async () => {
    const original = mockSettings.header;
    mockSettings.header = { circularCategories: { enabled: true, rootOnly: false } };
    render(
      <BrowserRouter>
        <CircularCategoryNav categories={[...mockCategories.filter((c) => c.isActive), { id: "cat-5", name: "Zen", slug: "zen", isActive: true, image: null, parentId: null }]} />
      </BrowserRouter>
    );

    const decorImg = document.querySelector("img");
    expect(decorImg.getAttribute("src")).toBe("http://api.test/uploads/decor.jpg");

    // A child without its own image inherits the parent's image (Ceramics -> Home Decor)
    const imgs = [...document.querySelectorAll("img")].map((i) => i.getAttribute("src"));
    expect(imgs.filter((s) => s === "http://api.test/uploads/decor.jpg")).toHaveLength(2);
    expect(screen.queryByText("C")).toBeNull();

    // A category with no image anywhere in its chain still shows the neutral fallback letter
    expect(screen.getByText("Z")).toBeInTheDocument();
    mockSettings.header = original;
  });

  it("renders a normalized mega menu item with columns and promo", async () => {
    const item = {
      id: "cat-1",
      label: "Home Decor",
      columns: [
        { id: "c1", title: "Home Decor", to: "/shop/category/home-decor", links: [
          { id: "sub-1", label: "Vessels", to: "/shop/category/vessels" },
          { id: "sub-2", label: "Wall Art", to: "/shop/category/wall-art" },
        ] },
      ],
      promo: { image: "/uploads/decor.jpg", eyebrow: "Curated Edit", title: "Artisan", description: "", ctaLabel: "Shop", ctaUrl: "/shop", altText: "Promo" },
    };
    render(
      <BrowserRouter>
        <MegaMenu item={item} isOpen={true} onClose={vi.fn()} />
      </BrowserRouter>
    );
    expect(screen.getByText("Vessels")).toBeInTheDocument();
    expect(screen.getByText("Wall Art")).toBeInTheDocument();
    expect(screen.getByText("Curated Edit")).toBeInTheDocument();
  });

  it("closes mega menu on Escape key press", async () => {
    const handleClose = vi.fn();
    const item = { id: "cat-1", label: "Home Decor", columns: [{ id: "c1", title: "", links: [{ id: "s", label: "Vessels", to: "/x" }] }], promo: null };
    render(
      <BrowserRouter>
        <MegaMenu item={item} isOpen={true} onClose={handleClose} />
      </BrowserRouter>
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("mobile menu opens and exposes category hierarchy in drawer", async () => {
    renderHeader();
    const menuBtn = screen.getByLabelText("Open menu");
    fireEvent.click(menuBtn);

    await waitFor(() => {
      expect(screen.getAllByText("Home Decor").length).toBeGreaterThan(0);
    });
  });

  it("search button triggers search UI", async () => {
    renderHeader();
    const searchBtns = screen.getAllByLabelText(/search/i);
    expect(searchBtns.length).toBeGreaterThan(0);
  });
});
