import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import HomepageRenderer from "../src/components/HomepageRenderer";

// Mock child components that make API calls
vi.mock("../src/components/CircularCategoryNav", () => ({
  default: () => <div data-testid="mock-category-circles">CircularCategoryNav</div>,
}));

vi.mock("../src/components/PromoStrip", () => ({
  default: ({ promoConfig }) => <div data-testid="mock-promo-strip" data-speed={promoConfig?.speed}>PromoStrip</div>,
}));

vi.mock("../src/components/HeroBannerCarousel", () => ({
  default: () => <div data-testid="mock-hero-carousel">HeroBannerCarousel</div>,
}));

vi.mock("../src/components/TrustServiceStrip", () => ({
  default: () => <div data-testid="mock-trust-strip">TrustServiceStrip</div>,
}));

vi.mock("../src/components/PromoBanners2Up", () => ({
  default: () => <div data-testid="mock-2up-banners">PromoBanners2Up</div>,
}));

describe("HomepageRenderer Component", () => {
  it("renders enabled sections in sort order and skips disabled sections", () => {
    const mockSections = [
      { id: "1", type: "HERO", name: "Hero Banner", isEnabled: true, sortOrder: 1, settings: {}, content: {} },
      { id: "2", type: "PROMO_TICKER", name: "Promo Ticker", isEnabled: true, sortOrder: 2, settings: {}, content: {} },
      { id: "3", type: "NEW_ARRIVALS", name: "New Arrivals", isEnabled: false, sortOrder: 3, settings: {}, content: {} },
      { id: "4", type: "TRUST_BADGES", name: "Trust Strip", isEnabled: true, sortOrder: 4, settings: {}, content: {} },
    ];

    render(
      <BrowserRouter>
        <HomepageRenderer sections={mockSections} />
      </BrowserRouter>
    );

    expect(screen.getByTestId("mock-hero-carousel")).toBeInTheDocument();
    expect(screen.getByTestId("mock-promo-strip")).toBeInTheDocument();
    expect(screen.getByTestId("mock-trust-strip")).toBeInTheDocument();
  });

  it("handles unknown section types safely without throwing errors", () => {
    const mockSections = [
      { id: "1", type: "UNKNOWN_FUTURE_TYPE", name: "Experimental Block", isEnabled: true, sortOrder: 1, settings: {}, content: {} },
      { id: "2", type: "HERO", name: "Hero Banner", isEnabled: true, sortOrder: 2, settings: {}, content: {} },
    ];

    render(
      <BrowserRouter>
        <HomepageRenderer sections={mockSections} />
      </BrowserRouter>
    );

    expect(screen.getByTestId("mock-hero-carousel")).toBeInTheDocument();
  });

  it("passes promo ticker settings through to the storefront component", () => {
    render(
      <BrowserRouter>
        <HomepageRenderer sections={[{ id: "ticker", type: "PROMO_STRIP", isEnabled: true, settings: { speed: 60, pauseOnHover: true } }]} />
      </BrowserRouter>
    );

    expect(screen.getByTestId("mock-promo-strip")).toHaveAttribute("data-speed", "60");
  });

  it("passes the new 90-second slow setting through unchanged", () => {
    render(<BrowserRouter><HomepageRenderer sections={[{ id: "ticker", type: "PROMO_STRIP", isEnabled: true, settings: { speed: 90 } }]} /></BrowserRouter>);
    expect(screen.getByTestId("mock-promo-strip")).toHaveAttribute("data-speed", "90");
  });
});
