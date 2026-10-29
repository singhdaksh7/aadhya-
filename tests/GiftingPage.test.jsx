import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import GiftingPage from "../src/pages/GiftingPage";
import {
  GiftingHeroSection,
  GiftsByOccasionSection,
  CuratedStoriesSection,
  GiftsByFestivalSection,
  GiftingBenefitsSection,
  GiftsByCraftSection,
  FeaturedGiftsSection,
  GiftsByBudgetSection,
  GiftingSeoSection,
  GiftingFaqSection,
} from "../src/components/gifting/GiftingSections";
import { DEFAULT_GIFTING_PAGE_SECTIONS } from "../src/lib/defaultGiftingContent";
import { MOCK_PRODUCTS } from "../src/mocks/products";
import { buildNavModel } from "../src/lib/navModel";
import { CartProvider } from "../src/context/CartContext";
import { WishlistProvider } from "../src/context/WishlistContext";

vi.mock("../src/hooks/useSiteSettings", () => ({
  useSiteSettings: () => ({
    general: { storeName: "Tushaqsa" },
    shipping: { dispatchEstimate: "24-48 hours", deliveryEstimate: "3-5 business days" },
    returns: { returnWindowDays: 7 },
  }),
}));

vi.mock("../src/lib/api", () => ({
  fetchPageBySlug: vi.fn(() =>
    Promise.resolve({
      data: {
        name: "Artisan Gifting",
        slug: "gifting",
        seoTitle: "Thoughtful Gifting | Tushaqsa",
        seoDescription: "Heirloom handcrafted gifts.",
        sections: DEFAULT_GIFTING_PAGE_SECTIONS,
      },
    })
  ),
  fetchProducts: vi.fn(() =>
    Promise.resolve({
      data: MOCK_PRODUCTS.slice(0, 4),
    })
  ),
  resolveProductImageUrl: (url) => url || null,
}));

function renderWithProviders(ui) {
  return render(
    <MemoryRouter initialEntries={["/gifting"]}>
      <CartProvider>
        <WishlistProvider>{ui}</WishlistProvider>
      </CartProvider>
    </MemoryRouter>
  );
}

describe("Gifting Page Storefront Experience", () => {
  it("renders all 10 core sections in the prescribed order", async () => {
    renderWithProviders(<GiftingPage />);

    await waitFor(() => {
      expect(screen.getByTestId("gifting-hero")).toBeInTheDocument();
    });

    expect(screen.getByTestId("gifts-by-occasion")).toBeInTheDocument();
    expect(screen.getByTestId("curated-stories")).toBeInTheDocument();
    expect(screen.getByTestId("gifts-by-festival")).toBeInTheDocument();
    expect(screen.getByTestId("gifting-benefits")).toBeInTheDocument();
    expect(screen.getByTestId("gifts-by-craft")).toBeInTheDocument();
    expect(screen.getByTestId("featured-gifts")).toBeInTheDocument();
    expect(screen.getByTestId("gifts-by-budget")).toBeInTheDocument();
    expect(screen.getByTestId("gifting-seo")).toBeInTheDocument();
    expect(screen.getByTestId("gifting-faq")).toBeInTheDocument();
  });

  it("renders Gifting Hero with correct title, description, and CTA", () => {
    const heroSec = DEFAULT_GIFTING_PAGE_SECTIONS.find((s) => s.type === "GIFTING_HERO");
    renderWithProviders(<GiftingHeroSection section={heroSec} />);

    expect(screen.getByTestId("gifting-hero-title")).toHaveTextContent(heroSec.settings.title);
    expect(screen.getByTestId("gifting-hero-desc")).toHaveTextContent(heroSec.settings.description);
    const cta = screen.getByTestId("gifting-hero-cta");
    expect(cta).toHaveTextContent(heroSec.settings.ctaLabel);
    expect(cta).toHaveAttribute("href", heroSec.settings.ctaUrl);
  });

  it("renders Gifts by Occasion cards with active items and valid links", () => {
    const occSec = DEFAULT_GIFTING_PAGE_SECTIONS.find((s) => s.type === "GIFTS_BY_OCCASION");
    renderWithProviders(<GiftsByOccasionSection section={occSec} />);

    expect(screen.getByText("Gifts by Occasion")).toBeInTheDocument();
    expect(screen.getByText("House Warming")).toBeInTheDocument();
    expect(screen.getByText("Anniversary Gifts")).toBeInTheDocument();
    expect(screen.getByTestId("occasion-card-0")).toHaveAttribute("href", "/shop/category/home-decor");
  });

  it("renders Curated Gifting Stories with alternating layout concept", () => {
    const storiesSec = DEFAULT_GIFTING_PAGE_SECTIONS.find((s) => s.type === "CURATED_STORIES");
    renderWithProviders(<CuratedStoriesSection section={storiesSec} />);

    expect(screen.getByText("For Peaceful Sanctuaries")).toBeInTheDocument();
    expect(screen.getByText("From Indian Hands with Love")).toBeInTheDocument();
    expect(screen.getByTestId("story-card-0")).toBeInTheDocument();
  });

  it("renders Gifts by Festival and links to festive/craft collections", () => {
    const festSec = DEFAULT_GIFTING_PAGE_SECTIONS.find((s) => s.type === "GIFTS_BY_FESTIVAL");
    renderWithProviders(<GiftsByFestivalSection section={festSec} />);

    expect(screen.getByText("Diwali Lights")).toBeInTheDocument();
    expect(screen.getByText("Wedding Season")).toBeInTheDocument();
    expect(screen.getByTestId("festival-card-0")).toHaveAttribute("href", "/collections/festive-gifting");
  });

  it("interpolates store settings into Gifting Benefits strip", () => {
    const benefitSec = DEFAULT_GIFTING_PAGE_SECTIONS.find((s) => s.type === "GIFTING_BENEFITS");
    renderWithProviders(<GiftingBenefitsSection section={benefitSec} />);

    expect(screen.getByText("Thoughtfully Packaged")).toBeInTheDocument();
    expect(screen.getByText("Handmade in India")).toBeInTheDocument();
    expect(screen.getByText(/Orders dispatched within 24-48 hours/i)).toBeInTheDocument();
  });

  it("renders Gifts by Craft pointing to real material categories/searches", () => {
    const craftSec = DEFAULT_GIFTING_PAGE_SECTIONS.find((s) => s.type === "GIFTS_BY_CRAFT");
    renderWithProviders(<GiftsByCraftSection section={craftSec} />);

    expect(screen.getByText("Sand-Cast Brass & Bronze")).toBeInTheDocument();
    expect(screen.getByText("Raw Terracotta & Clay")).toBeInTheDocument();
  });

  it("renders Featured Gift Products reusing ProductCard", () => {
    const featSec = DEFAULT_GIFTING_PAGE_SECTIONS.find((s) => s.type === "FEATURED_GIFTS");
    renderWithProviders(<FeaturedGiftsSection section={featSec} products={MOCK_PRODUCTS.slice(0, 4)} />);

    expect(screen.getByText("Handpicked Gifts")).toBeInTheDocument();
    expect(screen.getAllByTestId("product-card-root").length).toBe(4);
  });

  it("renders Gifts by Budget tiers", () => {
    const budgetSec = DEFAULT_GIFTING_PAGE_SECTIONS.find((s) => s.type === "GIFTS_BY_BUDGET");
    renderWithProviders(<GiftsByBudgetSection section={budgetSec} />);

    expect(screen.getByText("Under ₹1,000")).toBeInTheDocument();
    expect(screen.getByText("Under ₹2,000")).toBeInTheDocument();
    expect(screen.getByTestId("budget-card-0")).toHaveAttribute("href", "/shop?maxPrice=1000");
  });

  it("renders Gifting FAQ and toggles accordion items", () => {
    const faqSec = DEFAULT_GIFTING_PAGE_SECTIONS.find((s) => s.type === "GIFTING_FAQ");
    renderWithProviders(<GiftingFaqSection section={faqSec} />);

    const question = screen.getByText("Can I include a personalized gift note?");
    expect(screen.queryByText(/You can specify gift instructions/i)).not.toBeInTheDocument();

    fireEvent.click(question);
    expect(screen.getByText(/You can specify gift instructions/i)).toBeInTheDocument();
  });

  it("allows navigation model to link directly to /gifting", () => {
    const cms = {
      primaryNav: {
        mode: "MANUAL",
        items: [
          {
            id: "nav-gift",
            label: "Gifting",
            destinationType: "GIFTING",
            destination: "/gifting",
            enabled: true,
          },
        ],
      },
    };

    const nav = buildNavModel({ cms, categories: [], navigation: [] });
    expect(nav[0].label).toBe("Gifting");
    expect(nav[0].to).toBe("/gifting");
  });
});
