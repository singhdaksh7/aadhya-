import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import HomepageRenderer from "../src/components/HomepageRenderer";
import HeroBannerCarousel, { scriptCase } from "../src/components/HeroBannerCarousel";
import TrustServiceStrip from "../src/components/TrustServiceStrip";
import BlogPreviewSection from "../src/components/BlogPreviewSection";

vi.mock("../src/components/ProductCard", () => ({ default: ({ product }) => <div data-testid="product-card">{product.name}</div> }));
vi.mock("../src/components/PromoStrip", () => ({ default: () => <div /> }));
vi.mock("../src/hooks/useSiteSettings", () => ({ useSiteSettings: () => ({ heroBanners: [] }) }));
vi.mock("../src/lib/api", async (importOriginal) => ({ ...(await importOriginal()), fetchBanners: vi.fn(() => Promise.resolve({ data: [] })) }));

const wrap = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);
const products = [{ id: "p1", name: "Vase" }];

describe("hero banner redesign", () => {
  const banner = { id: "h", desktopImage: "/d.jpg", mobileImage: "/m.jpg", eyebrow: "Aadya Home", headline: "Decor that", highlightText: "Feels Like Home", description: "Handcrafted.", primaryCtaLabel: "Shop", primaryCtaUrl: "/shop", secondaryCtaLabel: "Explore", secondaryCtaUrl: "/collections", textPosition: "LEFT", textTheme: "DARK" };

  it("renders the copy on the image in light type with a script eyebrow, serif heading and solid + outlined buttons", () => {
    wrap(<HeroBannerCarousel bannersOverride={[banner]} />);
    expect(screen.getByTestId("hero-copy").className).toContain("text-white");
    expect(screen.getByTestId("hero-eyebrow").className).toContain("font-script");
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.className).toContain("font-serif-display");
    expect(h1.textContent).toContain("Feels Like Home");
    expect(screen.getByTestId("hero-cta-primary").className).toContain("store-bg-primary");
    expect(screen.getByTestId("hero-cta-secondary").className).toContain("border-white");
    expect(screen.getByTestId("hero-cta-secondary").className).toContain("bg-transparent");
    // a dark readability gradient, never the old white wash
    expect(screen.getByTestId("hero-overlay").className).toContain("from-charcoal");
    expect(screen.getByTestId("hero-overlay").className).not.toContain("from-white");
  });

  it("honours text position for LEFT, CENTER and RIGHT", () => {
    for (const [position, cls] of [["LEFT", "items-start"], ["CENTER", "items-center"], ["RIGHT", "items-end"]]) {
      const { unmount } = wrap(<HeroBannerCarousel bannersOverride={[{ ...banner, textPosition: position }]} />);
      expect(screen.getByTestId("hero-copy")).toHaveAttribute("data-position", position);
      expect(screen.getByTestId("hero-copy").className).toContain(cls);
      unmount();
    }
  });

  it("omits optional buttons and eyebrow instead of rendering empty chrome", () => {
    wrap(<HeroBannerCarousel bannersOverride={[{ ...banner, eyebrow: "", secondaryCtaLabel: "" }]} />);
    expect(screen.queryByTestId("hero-eyebrow")).toBeNull();
    expect(screen.queryByTestId("hero-cta-secondary")).toBeNull();
  });

  it("title-cases an ALL-CAPS eyebrow for the script face but leaves normal text alone", () => {
    expect(scriptCase("ARTISAN HERITAGE")).toBe("Artisan Heritage");
    expect(scriptCase("Artisan heritage")).toBe("Artisan heritage");
  });
});

describe("trust strip redesign", () => {
  const items = [{ id: "a", icon: "heart", title: "Curated", description: "Hand-selected" }, { id: "b", icon: "shield", title: "Secure", description: "Encrypted" }];

  it("stacks a light icon above a refined, centered title and caption (no filled icon bubble)", () => {
    wrap(<TrustServiceStrip items={items} />);
    const cells = screen.getAllByTestId("trust-item");
    expect(cells).toHaveLength(2);
    expect(cells[0].className).toContain("flex-col");
    expect(cells[0].className).toContain("text-center");
    expect(cells[0].querySelector("svg")).not.toBeNull();
    expect(cells[0].querySelector(".store-bg-primary-soft")).toBeNull();
    const title = screen.getByText("Curated");
    expect(title.className).toContain("font-serif-display");
    expect(title.className).toContain("text-[13px]");
  });
});

describe("shared section heading system", () => {
  it.each([
    ["NEW_ARRIVALS", { eyebrow: "FRESH DROPS", title: "New This Week", subtitle: "New pieces selected for the season" }],
    ["BEST_SELLERS", { eyebrow: "MOST CHERISHED", title: "Best Sellers", subtitle: "Loved most" }],
  ])("%s renders eyebrow, flanking ornaments, serif heading and subtitle", (type, settings) => {
    wrap(<HomepageRenderer sections={[{ id: type, type, isEnabled: true, settings, products }]} />);
    const title = screen.getByTestId("section-title");
    expect(title.firstElementChild.textContent).toBe(settings.eyebrow);
    expect(title.querySelectorAll("[data-testid='heading-ornament']")).toHaveLength(2);
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2.className).toContain("font-serif-display");
    expect(h2.parentElement.firstElementChild.getAttribute("data-testid")).toBe("heading-ornament");
    expect(h2.parentElement.lastElementChild.getAttribute("data-testid")).toBe("heading-ornament");
    expect(screen.getByText(settings.subtitle)).toBeInTheDocument();
  });

  it("falls back to smart defaults when nothing is configured", () => {
    wrap(<HomepageRenderer sections={[{ id: "n", type: "NEW_ARRIVALS", isEnabled: true, settings: {}, products }]} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("New This Week");
    expect(screen.getByText("New pieces selected for the season")).toBeInTheDocument();
  });

  it("Shop the Look uses the same ornamented heading and shows an optional subtitle", () => {
    const settings = { eyebrow: "Lifestyle", title: "Shop the Look", subtitle: "Rooms we love", items: [{ id: "l", title: "Living", tagline: "Brass", image: "/l.jpg", url: "/c/x", enabled: true }] };
    wrap(<HomepageRenderer sections={[{ id: "s", type: "SHOP_THE_LOOK", isEnabled: true, settings }]} />);
    expect(screen.getByTestId("section-title")).toHaveAttribute("data-align", "CENTER");
    expect(screen.getAllByTestId("heading-ornament")).toHaveLength(2);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Shop the Look");
    expect(screen.getByText("Rooms we love")).toBeInTheDocument();
  });

  it("Shop the Look hides when it has no enabled looks", () => {
    wrap(<HomepageRenderer sections={[{ id: "s", type: "SHOP_THE_LOOK", isEnabled: true, settings: { items: [{ id: "l", title: "x", enabled: false }] } }]} />);
    expect(screen.queryByText("Shop the Look")).toBeNull();
  });

  it("LEFT alignment keeps the legacy heading without ornaments", () => {
    wrap(<HomepageRenderer sections={[{ id: "n", type: "NEW_ARRIVALS", isEnabled: true, settings: { headingAlign: "LEFT" }, products }]} />);
    expect(screen.queryByTestId("heading-ornament")).toBeNull();
  });
});

describe("conditional data-driven sections", () => {
  const book = { id: "b1", name: "Slow Living", author: "A. Writer", price: 500, images: ["/b.jpg"], shortDescription: "x" };
  const renderSection = (section) => wrap(<HomepageRenderer sections={[section]} />);

  it("Books shelf renders only when at least one real book exists, and reappears when one is added", () => {
    const { unmount } = renderSection({ id: "bk", type: "BOOKS_SHELF", isEnabled: true, settings: {}, books: [] });
    expect(screen.queryByText("From Our Bookshelf")).toBeNull();
    unmount();
    renderSection({ id: "bk", type: "BOOKS_SHELF", isEnabled: true, settings: {}, books: [book] });
    expect(screen.getByText("From Our Bookshelf")).toBeInTheDocument();
    expect(screen.getByText("Slow Living")).toBeInTheDocument();
  });

  it("Reviews render only with approved reviews and never fabricate placeholders", () => {
    const { unmount, container } = renderSection({ id: "rv", type: "TESTIMONIALS", isEnabled: true, settings: { title: "Loved" }, reviews: [], reviewSummary: { averageRating: 0, reviewCount: 0 } });
    expect(container.querySelector("[data-testid='reviews-section']")).toBeNull();
    expect(screen.queryByText("Loved")).toBeNull();
    unmount();
    renderSection({ id: "rv", type: "TESTIMONIALS", isEnabled: true, settings: { title: "Loved", motion: "STATIC" }, reviews: [{ id: "r1", rating: 5, comment: "Real words", customerName: "Priya S." }], reviewSummary: { averageRating: 5, reviewCount: 1 } });
    expect(screen.getByText("Loved")).toBeInTheDocument();
    expect(screen.getAllByTestId("review-card")).toHaveLength(1);
  });

  it("Blog preview renders only with published posts", () => {
    const { unmount, container } = wrap(<BlogPreviewSection section={{ id: "bl", settings: {}, posts: [] }} />);
    expect(container.querySelector("[data-testid='blog-section']")).toBeNull();
    unmount();
    wrap(<BlogPreviewSection section={{ id: "bl", settings: {}, posts: [{ id: "p", slug: "s", title: "A Story", publishDate: "2026-09-01", readingMinutes: 3 }] }} />);
    expect(screen.getByText("A Story")).toBeInTheDocument();
  });
});
