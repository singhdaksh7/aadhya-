import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import TopUtilityBar from "../src/components/TopUtilityBar";
import Navbar from "../src/components/Navbar";

let mockSettings = {
  general: { storeName: "Aadya" },
  branding: {},
  header: { showUtilityBar: true, stickyHeader: true, showCategoryCircles: true },
  shipping: { freeShippingThreshold: 2499 },
};

vi.mock("../src/context/CartContext", () => ({ useCart: () => ({ count: 0, setIsOpen: vi.fn() }) }));
vi.mock("../src/context/CustomerAuthContext", () => ({ useCustomerAuth: () => ({ user: null }) }));
vi.mock("../src/hooks/useSiteSettings", () => ({ useSiteSettings: () => mockSettings }));
vi.mock("../src/lib/api", () => ({
  fetchCategories: vi.fn(() => Promise.resolve({ data: [] })),
  fetchNavigation: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  fetchPromos: vi.fn(() => Promise.resolve({ data: [] })),
  resolveMediaUrl: (u) => u || null,
}));

const renderBar = () => render(<BrowserRouter><TopUtilityBar /></BrowserRouter>);

describe("TopUtilityBar mobile overflow", () => {
  it("has no non-shrinking group below the sm breakpoint", () => {
    const { container } = renderBar();
    const bar = container.firstElementChild.firstElementChild;
    const groups = [...bar.children];
    groups.forEach((g) => {
      g.querySelectorAll("*").forEach((el) => {
        // any shrink-0 must be sm-gated or a tiny icon/separator-free right group
        const cls = String(el.getAttribute("class") || "");
        if (/(^|\s)shrink-0(\s|$)/.test(cls)) expect(el.tagName.toLowerCase()).toBe("svg");
      });
    });
    expect(groups[0].className).toMatch(/min-w-0/);
    expect(groups[0].className).not.toMatch(/(^|\s)shrink-0/);
  });

  it("shows only the first left item and first right link on mobile; rest are sm+ only", () => {
    const { container } = renderBar();
    const left = container.firstElementChild.firstElementChild.children[0];
    [...left.children].forEach((item, i) => {
      if (i === 0) expect(item.className).not.toMatch(/hidden/);
      else expect(item.className).toMatch(/hidden sm:flex/);
    });
    expect(screen.getByText(/Track Order/i).className).not.toMatch(/hidden/);
  });

  it("desktop still renders the full utility content in the DOM", () => {
    renderBar();
    expect(screen.getByText(/Free Shipping/i)).toBeInTheDocument();
    expect(screen.getByText(/Returns/i)).toBeInTheDocument();
    expect(screen.getByText(/Track Order/i)).toBeInTheDocument();
    expect(screen.getByText(/Help/i)).toBeInTheDocument();
  });

  it("header has no circles and no sticky/fixed classes (regression)", () => {
    const { container } = render(<BrowserRouter><Navbar /></BrowserRouter>);
    expect(container.querySelector("header").className).not.toMatch(/sticky|fixed|top-0/);
    expect(container.querySelector('[class~="group/scroller"]')).toBeNull();
  });
});
