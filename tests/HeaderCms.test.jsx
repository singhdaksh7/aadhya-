import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Navbar from "../src/components/Navbar";
import TopUtilityBar from "../src/components/TopUtilityBar";
import PromoStrip from "../src/components/PromoStrip";
import CircularCategoryNav from "../src/components/CircularCategoryNav";
import AdminHeaderSettings from "../src/pages/admin/AdminHeaderSettings";
import { DEFAULT_HEADER_CMS_SETTINGS, normalizeHeaderSettings } from "../src/lib/headerCmsHelpers";

let mockSettings = {
  general: { storeName: "Aadya" },
  branding: {},
  header: {},
  shipping: { freeShippingThreshold: 2499 },
};

let mockPromos = [
  { id: "p-1", message: "SEASON SALE 20% OFF", couponCode: "SALE20", ctaLabel: "Shop Sale", ctaUrl: "/shop", isActive: true, sortOrder: 1 },
];

let mockCategories = [
  { id: "cat-1", name: "Home Decor", slug: "home-decor", isActive: true, image: "/uploads/decor.jpg" },
  { id: "cat-2", name: "Ceramics", slug: "ceramics", isActive: true, image: null },
  { id: "cat-3", name: "Linen & Textiles", slug: "textiles", isActive: true, image: "/uploads/textiles.jpg" },
];

vi.mock("../src/context/CartContext", () => ({
  useCart: () => ({ count: 5, setIsOpen: vi.fn() }),
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
  fetchPromos: vi.fn(() => Promise.resolve({ data: mockPromos })),
  adminFetchSiteSettings: vi.fn(() => Promise.resolve({ data: mockSettings })),
  adminUpdateSiteSettings: vi.fn((data) => Promise.resolve({ data })),
  adminListCategories: vi.fn(() => Promise.resolve({ data: mockCategories })),
  resolveMediaUrl: (url) => (url ? `http://api.test${url}` : null),
}));

function renderComponent(Component) {
  return render(
    <BrowserRouter>
      <Component />
    </BrowserRouter>
  );
}

describe("Storefront Header CMS Frontend Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings = {
      general: { storeName: "Aadya" },
      branding: {},
      header: {},
      shipping: { freeShippingThreshold: 2499 },
    };
  });

  it("1. utility bar hidden when utilityBar.enabled is false or showUtilityBar is false", () => {
    mockSettings.header = { utilityBar: { enabled: false } };
    const { container } = renderComponent(TopUtilityBar);
    expect(container.firstChild).toBeNull();
  });

  it("2. utility custom labels render correctly", () => {
    mockSettings.header = {
      utilityBar: {
        enabled: true,
        items: [
          { id: "ub-1", enabled: true, label: "Express Pan-India Shipping", icon: "truck", linkType: "internal", url: "/shipping" },
        ],
      },
    };
    renderComponent(TopUtilityBar);
    expect(screen.getByText("Express Pan-India Shipping")).toBeInTheDocument();
  });

  it("3 & 4. Track Order and Help custom URLs render", () => {
    mockSettings.header = {
      utilityBar: {
        enabled: true,
        items: [
          { id: "ub-4", enabled: true, label: "Track Shipment", icon: "location", url: "/custom-track" },
          { id: "ub-5", enabled: true, label: "Support Portal", icon: "help", url: "/support" },
        ],
      },
    };
    renderComponent(TopUtilityBar);
    const trackLink = screen.getByText("Track Shipment").closest("a");
    const helpLink = screen.getByText("Support Portal").closest("a");
    expect(trackLink).toHaveAttribute("href", "/custom-track");
    expect(helpLink).toHaveAttribute("href", "/support");
  });

  it("5. promo ticker hidden when promoTicker.enabled is false", () => {
    mockSettings.header = { promoTicker: { enabled: false } };
    const { container } = renderComponent(PromoStrip);
    expect(container.firstChild).toBeNull();
  });

  it("6 & 7. ticker custom speed and pause-on-hover setting applied to marquee container", () => {
    mockSettings.header = { promoTicker: { enabled: true, speed: 45, pauseOnHover: true } };
    const { container } = renderComponent(PromoStrip);
    const marquee = container.querySelector(".animate-marquee-ticker");
    expect(marquee).toBeInTheDocument();
    expect(marquee.className).toMatch(/marquee-ticker-pauseable/);
    expect(marquee.style.getPropertyValue("--ticker-duration")).toBe("45s");
  });

  it("8. primary nav hidden when primaryNav.enabled is false", () => {
    mockSettings.header = { primaryNav: { enabled: false } };
    const { container } = renderComponent(Navbar);
    // Desktop primary nav container should not render
    const navRow = container.querySelector(".border-t.store-border.store-bg");
    expect(navRow).toBeNull();
  });

  it("9. NEW badge hidden when primaryNav.showNewBadge is false", async () => {
    mockSettings.header = { primaryNav: { enabled: true, showNewBadge: false }, circularCategories: { enabled: false } };
    renderComponent(Navbar);
    await waitFor(() => {
      expect(screen.getByText("Home Decor")).toBeInTheDocument();
    });
    expect(screen.queryByText("NEW")).not.toBeInTheDocument();
  });

  it("10. mega menu disabled when enableMegaMenu is false", async () => {
    mockSettings.header = { primaryNav: { enabled: true, enableMegaMenu: false } };
    renderComponent(Navbar);
    await waitFor(() => {
      const homeDecorLink = screen.getByText("Home Decor");
      expect(homeDecorLink).toBeInTheDocument();
      // Mouse enter should not trigger mega menu
      fireEvent.mouseEnter(homeDecorLink);
    });
    expect(screen.queryByText("Artisan Craftsmanship")).not.toBeInTheDocument();
  });

  it("11. circular category strip hidden when circularCategories.enabled is false", () => {
    mockSettings.header = { circularCategories: { enabled: false } };
    const { container } = renderComponent(CircularCategoryNav);
    expect(container.firstChild).toBeNull();
  });

  it("12. circular category maxItems limit respected", async () => {
    mockSettings.header = { circularCategories: { enabled: true, maxItems: 1 } };
    render(
      <BrowserRouter>
        <CircularCategoryNav categories={mockCategories} />
      </BrowserRouter>
    );
    expect(screen.getByText("Home Decor")).toBeInTheDocument();
    expect(screen.queryByText("Ceramics")).not.toBeInTheDocument();
  });

  it("13. category scroll arrows hidden when showArrows is false", () => {
    mockSettings.header = { circularCategories: { enabled: true, showArrows: false } };
    render(
      <BrowserRouter>
        <CircularCategoryNav categories={mockCategories} />
      </BrowserRouter>
    );
    expect(screen.queryByLabelText("Scroll left")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Scroll right")).not.toBeInTheDocument();
  });

  it("14. legacy default settings render current storefront header layout cleanly", () => {
    mockSettings.header = {}; // default legacy payload
    renderComponent(Navbar);
    expect(screen.getByText("Cart")).toBeInTheDocument();
    expect(screen.getByText("Track Order")).toBeInTheDocument();
  });

  it("15. promo content comes from promo API", async () => {
    renderComponent(PromoStrip);
    await waitFor(() => {
      expect(screen.getAllByText("SEASON SALE 20% OFF").length).toBeGreaterThan(0);
      expect(screen.getAllByText("SALE20").length).toBeGreaterThan(0);
    });
  });

  it("16. cart count remains functional", () => {
    renderComponent(Navbar);
    expect(screen.getAllByText("5").length).toBeGreaterThan(0);
  });

  it("17. mobile navigation drawer toggles and exposes links", async () => {
    renderComponent(Navbar);
    const menuBtn = screen.getByLabelText("Open menu");
    fireEvent.click(menuBtn);

    await waitFor(() => {
      expect(screen.getByText("Customer Login")).toBeInTheDocument();
    });
  });

  it("18. Admin Header CMS page loads saved settings and permits live preview toggle", async () => {
    renderComponent(AdminHeaderSettings);

    await waitFor(() => {
      expect(screen.getByText("Header & Navigation CMS")).toBeInTheDocument();
      expect(screen.getByText("1. General Header Settings")).toBeInTheDocument();
    });

    // Switch to Preview tab
    const previewTabBtn = screen.getByText("Live Preview");
    fireEvent.click(previewTabBtn);

    expect(screen.getByText("Desktop (1280px)")).toBeInTheDocument();
    expect(screen.getByText("Mobile (390px)")).toBeInTheDocument();

    // Toggle to Mobile viewport
    fireEvent.click(screen.getByText("Mobile (390px)"));
    expect(screen.getByText("Mobile (390px)").className).toMatch(/bg-charcoal/);
  });
});
