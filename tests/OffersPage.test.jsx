import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import OffersPage from "../src/pages/OffersPage";
import OfferCard, { copyText, discountHeadline } from "../src/components/offers/OfferCard";

const offersMock = vi.fn();
const newsMock = vi.fn();

vi.mock("../src/hooks/useSiteSettings", () => ({
  useSiteSettings: () => ({ general: { storeName: "Tushaqsa" } }),
}));

vi.mock("../src/lib/api", () => ({
  fetchOffers: (...a) => offersMock(...a),
  fetchWhatsNew: (...a) => newsMock(...a),
  resolveProductImageUrl: (u) => u || null,
}));

const OFFER = {
  code: "FESTIVE10",
  title: "Festive 10% off",
  discountType: "PERCENTAGE",
  value: 10,
  minimumOrderAmount: 999,
  maximumDiscountAmount: 500,
  validFrom: "2026-10-01T00:00:00.000Z",
  validUntil: "2026-12-31T00:00:00.000Z",
  status: "ACTIVE",
  applicability: "Applies to all products",
  terms: "Not valid with other offers.",
};

const renderPage = () => render(<MemoryRouter><OffersPage /></MemoryRouter>);

describe("OffersPage", () => {
  beforeEach(() => {
    offersMock.mockResolvedValue({ data: [OFFER, { ...OFFER, code: "SOON5", title: "Soon", status: "UPCOMING" }] });
    newsMock.mockResolvedValue({
      data: [{ id: "1", title: "Diwali drop", subtitle: "New lamps", badge: "New", ctaLabel: "Explore", ctaUrl: "/collections", imageUrl: null }],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders coupon cards with code, headline and conditions", async () => {
    renderPage();
    const cards = await screen.findAllByTestId("offer-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByText("FESTIVE10")).toBeInTheDocument();
    expect(screen.getAllByText("10% OFF").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Min\. order ₹999/).length).toBe(2);
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("opens a details modal with min order, max discount, validity and terms", async () => {
    renderPage();
    fireEvent.click((await screen.findAllByTestId("offer-card"))[0]);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Minimum order");
    expect(dialog).toHaveTextContent("₹999");
    expect(dialog).toHaveTextContent("₹500");
    expect(dialog).toHaveTextContent("Not valid with other offers.");
  });

  it("switches to What's New and renders its cards", async () => {
    renderPage();
    await screen.findAllByTestId("offer-card");
    fireEvent.click(screen.getByRole("tab", { name: "What's New" }));
    expect(await screen.findByText("Diwali drop")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/collections");
  });

  it("shows empty states for both tabs", async () => {
    offersMock.mockResolvedValue({ data: [] });
    newsMock.mockResolvedValue({ data: [] });
    renderPage();
    expect(await screen.findByText(/No offers are running right now/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "What's New" }));
    expect(await screen.findByText(/Nothing new to show yet/)).toBeInTheDocument();
  });

  it("shows an error notice when the offers request fails", async () => {
    offersMock.mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByText(/Unable to load this right now/)).toBeInTheDocument();
  });
});

describe("Copy code", () => {
  it("uses the Clipboard API and shows Copied", async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.assign(navigator, { clipboard: { writeText } });
    render(<MemoryRouter><OfferCard offer={OFFER} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Copy code FESTIVE10/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Copy code FESTIVE10/ })).toHaveTextContent("Copied"));
    expect(writeText).toHaveBeenCalledWith("FESTIVE10");
    // Clicking copy must not open the details modal.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("falls back to execCommand when the Clipboard API is unavailable", async () => {
    Object.assign(navigator, { clipboard: undefined });
    document.execCommand = vi.fn().mockReturnValue(true);
    expect(await copyText("ABC")).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("builds discount headlines for both discount types", () => {
    expect(discountHeadline({ discountType: "FIXED", value: 500 })).toBe("₹500 OFF");
    expect(discountHeadline({ discountType: "PERCENTAGE", value: 15 })).toBe("15% OFF");
  });
});
