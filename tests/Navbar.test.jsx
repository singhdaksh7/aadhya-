import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Navbar from "../src/components/Navbar";

let mockSettings = {};

vi.mock("../src/context/CartContext", () => ({
  useCart: () => ({ count: 0, setIsOpen: vi.fn() }),
}));
vi.mock("../src/context/CustomerAuthContext", () => ({
  useCustomerAuth: () => ({ user: null }),
}));
vi.mock("../src/hooks/useSiteSettings", () => ({
  useSiteSettings: () => mockSettings,
}));
vi.mock("../src/lib/api", () => ({
  fetchCategories: vi.fn(() => Promise.resolve({ data: [] })),
  fetchNavigation: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  fetchPromos: vi.fn(() => Promise.resolve({ data: [] })),
  resolveMediaUrl: (url) => {
    if (!url) return null;
    return /^https?:\/\//.test(url) ? url : `http://api.test${url}`;
  },
}));

function renderNavbar() {
  return render(
    <BrowserRouter>
      <Navbar />
    </BrowserRouter>
  );
}

describe("Navbar logo rendering", () => {
  it("shows the store name text when no logo is configured", () => {
    mockSettings = { general: { storeName: "Aadya" }, branding: {}, header: {}, announcementBar: {} };
    renderNavbar();
    expect(screen.getAllByText("Aadya").length).toBeGreaterThan(0);
    expect(screen.queryByAltText(/Aadya Logo/)).not.toBeInTheDocument();
  });

  it("renders the uploaded desktop logo with a normalized absolute URL", () => {
    mockSettings = {
      general: { storeName: "Aadya" },
      branding: { desktopLogo: "/uploads/products/logo.png", logoAltText: "Aadya Logo", logoWidthDesktop: 150 },
      header: {},
      announcementBar: {},
    };
    renderNavbar();
    const images = screen.getAllByAltText("Aadya Logo");
    expect(images.length).toBeGreaterThan(0);
    images.forEach((img) => {
      expect(img.getAttribute("src")).toMatch(/^http:\/\/api\.test\/uploads\/products\/logo\.png$/);
    });
  });

  it("passes an already-absolute logo URL through unchanged (no double-prepending)", () => {
    mockSettings = {
      general: { storeName: "Aadya" },
      branding: { desktopLogo: "https://cdn.example.com/logo.png", logoAltText: "Aadya Logo" },
      header: {},
      announcementBar: {},
    };
    renderNavbar();
    const images = screen.getAllByAltText("Aadya Logo");
    images.forEach((img) => {
      expect(img.getAttribute("src")).toBe("https://cdn.example.com/logo.png");
    });
  });

  it("falls back to the text wordmark if the configured logo fails to load", () => {
    mockSettings = {
      general: { storeName: "Aadya" },
      branding: { desktopLogo: "/uploads/products/broken.png", logoAltText: "Aadya Logo" },
      header: {},
      announcementBar: {},
    };
    renderNavbar();
    const images = screen.getAllByAltText("Aadya Logo");
    images.forEach((img) => fireEvent.error(img));
    expect(screen.getAllByText("Aadya").length).toBeGreaterThan(0);
  });

  it("uses the dedicated mobile logo width when set", () => {
    mockSettings = {
      general: { storeName: "Aadya" },
      branding: {
        desktopLogo: "/uploads/products/logo.png",
        mobileLogo: "/uploads/products/logo-mobile.png",
        logoAltText: "Aadya Logo",
        logoWidthDesktop: 160,
        logoWidthMobile: 90,
      },
      header: {},
      announcementBar: {},
    };
    renderNavbar();
    const images = screen.getAllByAltText("Aadya Logo");
    const widths = images.map((img) => img.style.width);
    expect(widths).toContain("160px");
    expect(widths).toContain("90px");
  });

  it("caps logo height with max-height (never a fixed height) so a very wide/tall/square source isn't squashed or clipped", () => {
    mockSettings = {
      general: { storeName: "Aadya" },
      branding: {
        desktopLogo: "/uploads/products/wide-logo.png",
        mobileLogo: "/uploads/products/tall-logo.png",
        logoAltText: "Aadya Logo",
        logoMaxHeightDesktop: 60,
        logoMaxHeightMobile: 44,
      },
      header: {},
      announcementBar: {},
    };
    renderNavbar();
    const images = screen.getAllByAltText("Aadya Logo");
    const maxHeights = images.map((img) => img.style.maxHeight);
    expect(maxHeights).toContain("60px");
    expect(maxHeights).toContain("44px");
    images.forEach((img) => {
      expect(img.style.height).toBe(""); // never fixed — only capped via maxHeight
      expect(img.className).toMatch(/object-contain/);
      expect(img.className).toMatch(/object-center/);
    });
  });

  it("falls back to sensible default max-heights (60px desktop / 44px mobile) when unset", () => {
    mockSettings = {
      general: { storeName: "Aadya" },
      branding: { desktopLogo: "/uploads/products/logo.png", logoAltText: "Aadya Logo" },
      header: {},
      announcementBar: {},
    };
    renderNavbar();
    const images = screen.getAllByAltText("Aadya Logo");
    const maxHeights = images.map((img) => img.style.maxHeight);
    expect(maxHeights).toContain("60px");
    expect(maxHeights).toContain("44px");
  });

  it("renders a transparent-PNG logo the same way as any other (no background/clip added)", () => {
    mockSettings = {
      general: { storeName: "Aadya" },
      branding: { desktopLogo: "/uploads/products/transparent-logo.png", logoAltText: "Aadya Logo" },
      header: {},
      announcementBar: {},
    };
    renderNavbar();
    const images = screen.getAllByAltText("Aadya Logo");
    expect(images.length).toBeGreaterThan(0);
    images.forEach((img) => {
      expect(img.getAttribute("src")).toMatch(/transparent-logo\.png$/);
      expect(img.className).toMatch(/object-contain/);
    });
  });
});

describe("Navbar sticky header setting", () => {
  it("renders sticky classes when header.stickyHeader is true", () => {
    mockSettings = { general: { storeName: "Aadya" }, branding: {}, header: { stickyHeader: true }, announcementBar: {} };
    const { container } = renderNavbar();
    const header = container.querySelector("header");
    expect(header.className).toMatch(/sticky/);
    expect(header.className).toMatch(/top-0/);
  });

  it("renders static (non-sticky) layout by default when header.stickyHeader is unset", () => {
    mockSettings = { general: { storeName: "Aadya" }, branding: {}, header: {}, announcementBar: {} };
    const { container } = renderNavbar();
    const header = container.querySelector("header");
    expect(header.className).not.toMatch(/sticky/);
  });

  it("renders static (non-sticky) layout when header.stickyHeader is false", () => {
    mockSettings = { general: { storeName: "Aadya" }, branding: {}, header: { stickyHeader: false }, announcementBar: {} };
    const { container } = renderNavbar();
    const header = container.querySelector("header");
    expect(header.className).not.toMatch(/sticky/);
  });
});
