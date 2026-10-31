import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  GiftsByOccasionSection,
  CuratedStoriesSection,
  GiftsByFestivalSection,
  GiftingBenefitsSection,
  GiftsByCraftSection,
  FeaturedGiftsSection,
  GiftsByBudgetSection,
  GiftingFaqSection,
  GiftingSeoSection,
  labelOrDefault,
} from "../src/components/gifting/GiftingSections";

vi.mock("../src/hooks/useSiteSettings", () => ({ useSiteSettings: () => ({}) }));
vi.mock("../src/components/ProductCard", () => ({ default: ({ product }) => <div>{product.name}</div> }));

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const item = { id: "a", title: "T", label: "L", question: "Q", answer: "A", heading: "H", destinationUrl: "/shop" };

// [component, content key holding the list, legacy eyebrow text]
const CASES = [
  [GiftsByOccasionSection, "items", "Celebrate Milestones"],
  [CuratedStoriesSection, "stories", "Artisan Narratives"],
  [GiftsByFestivalSection, "items", "Festive Celebrations"],
  [GiftingBenefitsSection, "cards", "Care in Every Box"],
  [GiftsByCraftSection, "crafts", "Artisanal Materials"],
  [GiftsByBudgetSection, "tiers", "Considered Values"],
  [GiftingFaqSection, "items", "Help & Assurance"],
];

describe("storefront editable eyebrows", () => {
  it.each(CASES)("%o: legacy content (no eyebrow field) renders the original text", (Component, key, legacy) => {
    wrap(<Component section={{ settings: { heading: "Head", [key]: [item] } }} />);
    expect(screen.getByTestId("section-eyebrow")).toHaveTextContent(legacy);
  });

  it.each(CASES)("%o: a custom eyebrow replaces the default", (Component, key) => {
    wrap(<Component section={{ settings: { heading: "Head", eyebrow: "Custom label", [key]: [item] } }} />);
    expect(screen.getByTestId("section-eyebrow")).toHaveTextContent("Custom label");
  });

  it.each(CASES)("%o: an explicitly empty eyebrow hides it", (Component, key) => {
    wrap(<Component section={{ settings: { heading: "Head", eyebrow: "", [key]: [item] } }} />);
    expect(screen.queryByTestId("section-eyebrow")).toBeNull();
    expect(screen.getByText("Head")).toBeInTheDocument();
  });

  it("featured gifts: default, custom and hidden eyebrow", () => {
    const products = [{ id: "p", name: "Lamp" }];
    const { unmount } = wrap(<FeaturedGiftsSection section={{ settings: {} }} products={products} />);
    expect(screen.getByTestId("section-eyebrow")).toHaveTextContent("Artisan Selection");
    unmount();
    const second = wrap(<FeaturedGiftsSection section={{ settings: { eyebrow: "" } }} products={products} />);
    expect(screen.queryByTestId("section-eyebrow")).toBeNull();
    second.unmount();
    wrap(<FeaturedGiftsSection section={{ settings: { eyebrow: "Picks" } }} products={products} />);
    expect(screen.getByTestId("section-eyebrow")).toHaveTextContent("Picks");
  });

  it("SEO section has no eyebrow unless one is set", () => {
    const { unmount } = wrap(<GiftingSeoSection section={{ settings: { heading: "SEO" } }} />);
    expect(screen.queryByTestId("section-eyebrow")).toBeNull();
    unmount();
    wrap(<GiftingSeoSection section={{ settings: { heading: "SEO", eyebrow: "Story" } }} />);
    expect(screen.getByTestId("section-eyebrow")).toHaveTextContent("Story");
  });

  it("card link labels: default, custom and hidden", () => {
    const base = { heading: "H", items: [item] };
    const { unmount } = wrap(<GiftsByOccasionSection section={{ settings: base }} />);
    expect(screen.getByText("Explore")).toBeInTheDocument();
    unmount();
    const b = wrap(<GiftsByOccasionSection section={{ settings: { ...base, cardCtaLabel: "Shop now" } }} />);
    expect(screen.getByText("Shop now")).toBeInTheDocument();
    b.unmount();
    wrap(<GiftsByOccasionSection section={{ settings: { ...base, cardCtaLabel: "" } }} />);
    expect(screen.queryByText("Explore")).toBeNull();
  });

  it("budget tier prefix and card label are editable", () => {
    const tiers = [{ id: "t", label: "Under 1000", destinationUrl: "/shop" }];
    const { unmount } = wrap(<GiftsByBudgetSection section={{ settings: { heading: "B", tiers } }} />);
    expect(screen.getByText("Tier 01")).toBeInTheDocument();
    expect(screen.getByText("Explore Collection")).toBeInTheDocument();
    unmount();
    wrap(<GiftsByBudgetSection section={{ settings: { heading: "B", tiers, tierLabel: "Level", cardCtaLabel: "" } }} />);
    expect(screen.getByText("Level 01")).toBeInTheDocument();
    expect(screen.queryByText("Explore Collection")).toBeNull();
  });

  it("story number prefix is editable and hideable", () => {
    const stories = [{ id: "s", heading: "Story head" }];
    const { unmount } = wrap(<CuratedStoriesSection section={{ settings: { heading: "S", stories } }} />);
    expect(screen.getByText("Story 01")).toBeInTheDocument();
    unmount();
    wrap(<CuratedStoriesSection section={{ settings: { heading: "S", stories, storyLabel: "" } }} />);
    expect(screen.queryByText(/Story 0/)).toBeNull();
  });

  it("labelOrDefault only falls back for non-strings", () => {
    expect(labelOrDefault(undefined, "x")).toBe("x");
    expect(labelOrDefault(null, "x")).toBe("x");
    expect(labelOrDefault("", "x")).toBe("");
    expect(labelOrDefault(" y ", "x")).toBe("y");
  });
});
