import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import HomepageRenderer from "../src/components/HomepageRenderer";
import { CartProvider } from "../src/context/CartContext";
import { WishlistProvider } from "../src/context/WishlistContext";

function withProviders(children) {
  return (
    <BrowserRouter>
      <CartProvider>
        <WishlistProvider>{children}</WishlistProvider>
      </CartProvider>
    </BrowserRouter>
  );
}

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

  it("renders product cards from section.products (server-resolved) for New Arrivals", () => {
    const products = [
      { id: "p1", name: "Clay Vessel", slug: "clay-vessel", price: 999, images: ["/vessel.jpg"] },
      { id: "p2", name: "Linen Runner", slug: "linen-runner", price: 1299, images: ["/runner.jpg"] },
    ];
    render(withProviders(
      <HomepageRenderer sections={[{ id: "na", type: "NEW_ARRIVALS", isEnabled: true, settings: { limit: 4 }, products }]} />
    ));
    expect(screen.getByText("Clay Vessel")).toBeInTheDocument();
    expect(screen.getByText("Linen Runner")).toBeInTheDocument();
  });

  it("hides the New Arrivals section entirely (no heading, no empty grid) when zero products match", () => {
    render(
      <BrowserRouter>
        <HomepageRenderer sections={[{ id: "na", type: "NEW_ARRIVALS", isEnabled: true, settings: {}, products: [] }]} />
      </BrowserRouter>
    );
    expect(screen.queryByText("New Arrivals")).not.toBeInTheDocument();
  });

  it("hides the Best Sellers section entirely when zero products match", () => {
    render(
      <BrowserRouter>
        <HomepageRenderer sections={[{ id: "bs", type: "BEST_SELLERS", isEnabled: true, settings: {}, products: [] }]} />
      </BrowserRouter>
    );
    expect(screen.queryByText("Best Sellers")).not.toBeInTheDocument();
  });

  it("falls back to legacy newArrivals/bestSellers props when section.products is absent", () => {
    const legacyProducts = [{ id: "p3", name: "Legacy Prop Product", slug: "legacy", price: 500, images: ["/x.jpg"] }];
    render(withProviders(
      <HomepageRenderer
        sections={[{ id: "na", type: "NEW_ARRIVALS", isEnabled: true, settings: {} }]}
        newArrivals={legacyProducts}
      />
    ));
    expect(screen.getByText("Legacy Prop Product")).toBeInTheDocument();
  });
});
