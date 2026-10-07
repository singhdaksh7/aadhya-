import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import HomepageRenderer from "../src/components/HomepageRenderer";
import ReviewsSection from "../src/components/ReviewsSection";
import BlogPreviewSection from "../src/components/BlogPreviewSection";
import HomepageSectionFields from "../src/components/admin/HomepageSectionFields";

vi.mock("../src/components/ProductCard", () => ({ default: ({ product }) => <div data-testid="product-card">{product.name}</div> }));
vi.mock("../src/components/HeroBannerCarousel", () => ({ default: () => <div /> }));
vi.mock("../src/components/PromoStrip", () => ({ default: () => <div /> }));
vi.mock("../src/components/admin/ImagePickerInput", () => ({ default: () => <div /> }));

const wrap = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);
const products = [{ id: "p1", name: "Vase" }, { id: "p2", name: "Cushion" }];
const rail = (settings, type = "NEW_ARRIVALS") => ({ id: "r", type, isEnabled: true, settings, products });

describe("centered homepage headings", () => {
  it("New This Week defaults to a centered eyebrow / heading / subtitle with a centered CTA below the products", () => {
    wrap(<HomepageRenderer sections={[rail({ eyebrow: "FRESH DROPS", title: "New This Week", subtitle: "Selected for the season", ctaLabel: "SEE ALL NEW ARRIVALS", ctaUrl: "/new-arrivals" })]} />);
    const title = screen.getByTestId("section-title");
    expect(title).toHaveAttribute("data-align", "CENTER");
    expect(title.className).toContain("text-center");
    expect(title.className).toContain("max-w-2xl");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("New This Week");
    expect(screen.getByText("Selected for the season")).toBeInTheDocument();
    const cta = screen.getByTestId("section-cta");
    expect(cta).toHaveAttribute("href", "/new-arrivals");
    expect(cta.parentElement.className).toContain("justify-center");
    // CTA sits after the product row in document order
    const cards = screen.getAllByTestId("product-card");
    expect(cards[cards.length - 1].compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("Best Sellers uses the same centered treatment; headingAlign LEFT restores the legacy layout", () => {
    const { unmount } = wrap(<HomepageRenderer sections={[rail({}, "BEST_SELLERS")]} />);
    expect(screen.getByTestId("section-title")).toHaveAttribute("data-align", "CENTER");
    unmount();
    wrap(<HomepageRenderer sections={[rail({ headingAlign: "LEFT" })]} />);
    expect(screen.queryByTestId("section-title")).toBeNull();
    expect(screen.queryByTestId("section-cta")).toBeNull();
  });

  it("hides the centered CTA when showCta is false", () => {
    wrap(<HomepageRenderer sections={[rail({ showCta: false })]} />);
    expect(screen.queryByTestId("section-cta")).toBeNull();
  });

  it("reviews and blog use centered titles; blog View All is a centered bordered CTA", () => {
    const reviews = [{ id: "r1", rating: 5, comment: "Lovely", customerName: "Priya S." }];
    const { unmount } = wrap(<ReviewsSection section={{ id: "rv", settings: { eyebrow: "LOVED", title: "Reviews", subtitle: "Real words" }, reviews, reviewSummary: {} }} />);
    expect(screen.getByTestId("section-title")).toHaveAttribute("data-align", "CENTER");
    expect(screen.getByText("Real words")).toBeInTheDocument();
    unmount();
    const posts = [{ id: "b1", slug: "a", title: "A", publishDate: "2026-09-01", readingMinutes: 2 }];
    wrap(<BlogPreviewSection section={{ id: "bl", settings: { viewAllUrl: "/blog" }, posts }} />);
    expect(screen.getByTestId("section-title")).toHaveAttribute("data-align", "CENTER");
    expect(screen.getByTestId("section-cta")).toHaveAttribute("href", "/blog");
    expect(screen.getByTestId("section-cta").textContent).toContain("View All Stories");
  });

  it("admin exposes Heading alignment only for sections that support it", () => {
    const { unmount } = render(<HomepageSectionFields type="NEW_ARRIVALS" value={{}} onChange={() => {}} />);
    expect(screen.getByLabelText("Heading alignment")).toBeInTheDocument();
    unmount();
    render(<HomepageSectionFields type="NEWSLETTER" value={{}} onChange={() => {}} />);
    expect(screen.queryByLabelText("Heading alignment")).toBeNull();
  });
});
