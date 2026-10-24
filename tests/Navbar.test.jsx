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
    mockSettings = { general: { storeName: "Tushaqsa" }, branding: {}, header: {}, announcementBar: {} };
    renderNavbar();
    expect(screen.getAllByText("Tushaqsa").length).toBeGreaterThan(0);
    expect(screen.queryByAltText(/Home Decor and Lifestyle Products/)).not.toBeInTheDocument();
  });

  it("renders the uploaded desktop logo with a normalized absolute URL", () => {
    mockSettings = {
      general: { storeName: "Tushaqsa" },
      branding: { desktopLogo: "/uploads/products/logo.png", logoAltText: "Tushaqsa - Home Decor and Lifestyle Products", logoWidthDesktop: 150 },
      header: {},
      announcementBar: {},
    };
    renderNavbar();
    const images = screen.getAllByAltText("Tushaqsa - Home Decor and Lifestyle Products");
    expect(images.length).toBeGreaterThan(0);
    images.forEach((img) => {
      expect(img.getAttribute("src")).toMatch(/^http:\/\/api\.test\/uploads\/products\/logo\.png$/);
    });
  });

  it("passes an already-absolute logo URL through unchanged (no double-prepending)", () => {
    mockSettings = {
      general: { storeName: "Tushaqsa" },
      branding: { desktopLogo: "https://cdn.example.com/logo.png", logoAltText: "Tushaqsa - Home Decor and Lifestyle Products" },
      header: {},
      announcementBar: {},
    };
    renderNavbar();
    const images = screen.getAllByAltText("Tushaqsa - Home Decor and Lifestyle Products");
    images.forEach((img) => {
      expect(img.getAttribute("src")).toBe("https://cdn.example.com/logo.png");
    });
  });

  it("falls back to the text wordmark if the configured logo fails to load", () => {
    mockSettings = {
      general: { storeName: "Tushaqsa" },
      branding: { desktopLogo: "/uploads/products/broken.png", logoAltText: "Tushaqsa - Home Decor and Lifestyle Products" },
      header: {},
      announcementBar: {},
    };
    renderNavbar();
    const images = screen.getAllByAltText("Tushaqsa - Home Decor and Lifestyle Products");
    images.forEach((img) => fireEvent.error(img));
    expect(screen.getAllByText("Tushaqsa").length).toBeGreaterThan(0);
  });

  it("uses the dedicated mobile logo width when set", () => {
    mockSettings = {
      general: { storeName: "Tushaqsa" },
      branding: {
        desktopLogo: "/uploads/products/logo.png",
        mobileLogo: "/uploads/products/logo-mobile.png",
        logoAltText: "Tushaqsa - Home Decor and Lifestyle Products",
        logoWidthDesktop: 160,
        logoWidthMobile: 90,
      },
      header: {},
      announcementBar: {},
    };
    renderNavbar();
    const images = screen.getAllByAltText("Tushaqsa - Home Decor and Lifestyle Products");
    const widths = images.map((img) => img.style.width);
    expect(widths).toContain("160px");
    expect(widths).toContain("90px");
  });

  it("honors explicit width AND height independently for desktop and mobile (no caps), never cropping", () => {
    mockSettings = {
      general: { storeName: "Tushaqsa" },
      branding: {
        desktopLogo: "/uploads/products/wide-logo.png",
        mobileLogo: "/uploads/products/tall-logo.png",
        logoAltText: "Tushaqsa - Home Decor and Lifestyle Products",
        logoWidthDesktop: 520,
        logoHeightDesktop: 180,
        logoWidthMobile: 260,
        logoHeightMobile: 90,
      },
      header: {},
      announcementBar: {},
    };
    renderNavbar();
    const images = screen.getAllByAltText("Tushaqsa - Home Decor and Lifestyle Products");
    expect(images.map((i) => i.style.width)).toEqual(expect.arrayContaining(["520px", "260px"]));
    expect(images.map((i) => i.style.height)).toEqual(expect.arrayContaining(["180px", "90px"]));
    images.forEach((img) => {
      expect(img.style.maxHeight).toBe("");
      expect(img.style.maxWidth).toBe("100%");
      expect(img.className).toMatch(/object-contain/);
    });
  });

  it("leaves height auto when only a width is configured", () => {
    mockSettings = {
      general: { storeName: "Tushaqsa" },
      branding: { desktopLogo: "/uploads/products/logo.png", logoAltText: "Tushaqsa - Home Decor and Lifestyle Products" },
      header: {},
      announcementBar: {},
    };
    renderNavbar();
    screen.getAllByAltText("Tushaqsa - Home Decor and Lifestyle Products").forEach((img) => expect(img.style.height).toBe(""));
  });

  it("renders a transparent-PNG logo the same way as any other (no background/clip added)", () => {
    mockSettings = {
      general: { storeName: "Tushaqsa" },
      branding: { desktopLogo: "/uploads/products/transparent-logo.png", logoAltText: "Tushaqsa - Home Decor and Lifestyle Products" },
      header: {},
      announcementBar: {},
    };
    renderNavbar();
    const images = screen.getAllByAltText("Tushaqsa - Home Decor and Lifestyle Products");
    expect(images.length).toBeGreaterThan(0);
    images.forEach((img) => {
      expect(img.getAttribute("src")).toMatch(/transparent-logo\.png$/);
      expect(img.className).toMatch(/object-contain/);
    });
  });
});

describe("Navbar hotfix: never sticky, never circles", () => {
  const noStickyClasses = (header) => {
    expect(header.className).not.toMatch(/sticky|fixed|top-0|z-40/);
  };

  it("legacy header.stickyHeader:true does not make the header sticky", () => {
    mockSettings = { general: { storeName: "Tushaqsa" }, branding: {}, header: { stickyHeader: true }, announcementBar: {} };
    const { container } = renderNavbar();
    noStickyClasses(container.querySelector("header"));
  });

  it("saved stickyMode always/scroll is ignored on the storefront", () => {
    for (const stickyMode of ["always", "scroll"]) {
      mockSettings = { general: { storeName: "Tushaqsa" }, branding: {}, header: { stickyMode }, announcementBar: {} };
      const { container, unmount } = renderNavbar();
      noStickyClasses(container.querySelector("header"));
      unmount();
    }
  });

  it("legacy showCategoryCircles:true and circularCategories.enabled:true render no circles", () => {
    mockSettings = {
      general: { storeName: "Tushaqsa" }, branding: {}, announcementBar: {},
      header: { showCategoryCircles: true, circularCategories: { enabled: true } },
    };
    const { container } = renderNavbar();
    expect(container.querySelector("[class~=\"group/scroller\"]")).toBeNull();
    expect(screen.queryByLabelText("Scroll left")).not.toBeInTheDocument();
  });

  it("does not attach a scroll listener", () => {
    const spy = vi.spyOn(window, "addEventListener");
    mockSettings = { general: { storeName: "Tushaqsa" }, branding: {}, header: { stickyHeader: true }, announcementBar: {} };
    renderNavbar();
    expect(spy.mock.calls.some(([evt]) => evt === "scroll")).toBe(false);
    spy.mockRestore();
  });
});
