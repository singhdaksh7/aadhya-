import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import React, { useState } from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import GiftingSectionFields, { moveListItem, parsePriceInput } from "../src/components/admin/GiftingSectionFields";
import NavItemEditor from "../src/components/admin/NavItemEditor";
import FooterColumnsEditor from "../src/components/admin/FooterColumnsEditor";
import { CuratedStoriesSection, GiftingBenefitsSection, GiftsByBudgetSection, FeaturedGiftsSection, storyImageSide, budgetTierUrl } from "../src/components/gifting/GiftingSections";
import { DESTINATION_TYPES, resolveDestination } from "../src/lib/navModel";
import { adminNavGroups } from "../src/components/admin/navConfig";

vi.mock("../src/components/admin/ImagePickerInput", () => ({
  default: ({ value, onChange }) => <input aria-label="image picker" value={value || ""} onChange={(e) => onChange(e.target.value)} />,
}));
vi.mock("../src/hooks/useSiteSettings", () => ({ useSiteSettings: () => ({}) }));
vi.mock("../src/components/ProductCard", () => ({ default: ({ product }) => <div data-testid="product-card">{product.name}</div> }));

let latest;
function Harness({ type, initial }) {
  const [value, setValue] = useState(initial);
  latest = value;
  return <GiftingSectionFields type={type} value={value} onChange={setValue} products={[{ id: "p1", name: "Brass Lamp", sku: "BL1", isActive: true }, { id: "p2", name: "Clay Pot", isActive: true }]} collections={[{ id: "c1", slug: "festive", name: "Festive" }]} categories={[{ id: "k1", slug: "decor", name: "Decor" }]} />;
}

describe("gifting admin editor", () => {
  it("moveListItem swaps and renumbers sortOrder", () => {
    const list = [{ id: "a", sortOrder: 1 }, { id: "b", sortOrder: 2 }, { id: "c", sortOrder: 3 }];
    const moved = moveListItem(list, 2, -1);
    expect(moved.map((i) => i.id)).toEqual(["a", "c", "b"]);
    expect(moved.map((i) => i.sortOrder)).toEqual([1, 2, 3]);
    expect(moveListItem(list, 0, -1)).toBe(list);
  });

  it("parsePriceInput maps blank to null and rejects negatives", () => {
    expect(parsePriceInput("")).toBeNull();
    expect(parsePriceInput("1500")).toBe(1500);
    expect(parsePriceInput("-5")).toBeNull();
  });

  it.each([
    ["GIFTS_BY_FESTIVAL", "items", "Add Festival"],
    ["GIFTING_BENEFITS", "cards", "Add Benefit"],
    ["GIFTS_BY_CRAFT", "crafts", "Add Craft"],
    ["GIFTS_BY_BUDGET", "tiers", "Add Tier"],
    ["GIFTS_BY_OCCASION", "items", "Add Occasion"],
    ["CURATED_STORIES", "stories", "Add Story"],
    ["GIFTING_FAQ", "items", "Add Question"],
  ])("%s supports add, disable, reorder and delete", async (type, key, addLabel) => {
    const user = userEvent.setup();
    render(<Harness type={type} initial={{ heading: "H" }} />);
    await user.click(screen.getByText(`+ ${addLabel}`));
    await user.click(screen.getByText(`+ ${addLabel}`));
    expect(latest[key]).toHaveLength(2);
    const firstId = latest[key][0].id;
    // disable first
    await user.click(within(screen.getByTestId("gifting-item-0")).getByLabelText("Enabled"));
    expect(latest[key][0].enabled).toBe(false);
    // reorder: move first down
    const downButtons = screen.getAllByText("▼");
    await user.click(downButtons[0]);
    expect(latest[key][1].id).toBe(firstId);
    expect(latest[key].map((i) => i.sortOrder)).toEqual([1, 2]);
    // delete
    await user.click(within(screen.getByTestId("gifting-item-0")).getByText("Remove"));
    expect(latest[key]).toHaveLength(1);
  });

  it("stories expose a layout orientation", async () => {
    const user = userEvent.setup();
    render(<Harness type="CURATED_STORIES" initial={{ stories: [{ id: "s", heading: "S", layout: "AUTO", enabled: true }] }} />);
    await user.selectOptions(screen.getByLabelText("Layout orientation"), "IMAGE_TOP");
    expect(latest.stories[0].layout).toBe("IMAGE_TOP");
  });

  it("benefits accept an uploaded image and an icon", async () => {
    render(<Harness type="GIFTING_BENEFITS" initial={{ cards: [{ id: "b", title: "T", icon: "gift", enabled: true }] }} />);
    fireEvent.change(screen.getByLabelText("image picker"), { target: { value: "/uploads/x.png" } });
    expect(latest.cards[0].image).toBe("/uploads/x.png");
  });

  it("budget tiers store min and max price", async () => {
    render(<Harness type="GIFTS_BY_BUDGET" initial={{ tiers: [{ id: "t", label: "Under 1000", enabled: true }] }} />);
    fireEvent.change(screen.getByLabelText("Min price"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Max price"), { target: { value: "1000" } });
    expect(latest.tiers[0].minPrice).toBe(500);
    expect(latest.tiers[0].maxPrice).toBe(1000);
  });

  it("featured gifts: manual products, collection and dynamic query sources", async () => {
    const user = userEvent.setup();
    render(<Harness type="FEATURED_GIFTS" initial={{ heading: "H", sourceMode: "AUTO", productIds: [] }} />);
    const source = screen.getByLabelText("Product source");
    await user.selectOptions(source, "MANUAL");
    await user.selectOptions(screen.getByLabelText("Add a product"), "p1");
    await user.selectOptions(screen.getByLabelText("Add a product"), "p2");
    expect(latest.productIds).toEqual(["p1", "p2"]);
    await user.click(screen.getByLabelText("Move product 2 up"));
    expect(latest.productIds).toEqual(["p2", "p1"]);

    await user.selectOptions(source, "COLLECTION");
    await user.selectOptions(screen.getByLabelText("Collection"), "festive");
    expect(latest.collectionSlug).toBe("festive");

    await user.selectOptions(source, "QUERY");
    await user.selectOptions(screen.getByLabelText("Category"), "decor");
    fireEvent.change(screen.getByLabelText("Maximum price"), { target: { value: "2500" } });
    expect(latest.sourceMode).toBe("QUERY");
    expect(latest.queryCategory).toBe("decor");
    expect(latest.queryMaxPrice).toBe(2500);
  });
});

describe("gifting storefront rendering of the new fields", () => {
  it("story layout controls image side", () => {
    expect(storyImageSide("AUTO", 0)).toBe("right");
    expect(storyImageSide("AUTO", 1)).toBe("left");
    expect(storyImageSide("IMAGE_LEFT", 0)).toBe("left");
    expect(storyImageSide("IMAGE_TOP", 3)).toBe("top");
    render(
      <MemoryRouter>
        <CuratedStoriesSection section={{ settings: { stories: [{ id: "a", heading: "A", layout: "IMAGE_TOP", enabled: true }, { id: "b", heading: "B", enabled: true }] } }} />
      </MemoryRouter>
    );
    expect(screen.getByTestId("story-card-0")).toHaveAttribute("data-layout", "top");
    expect(screen.getByTestId("story-card-1")).toHaveAttribute("data-layout", "left");
  });

  it("benefit image replaces the icon", () => {
    render(<GiftingBenefitsSection section={{ settings: { cards: [{ id: "x", title: "T", icon: "gift", image: "https://e.com/i.png", enabled: true }] } }} />);
    expect(screen.getByTestId("benefit-image-0")).toHaveAttribute("src", "https://e.com/i.png");
  });

  it("budget tiers link by explicit URL or by price range", () => {
    expect(budgetTierUrl({ destinationUrl: "/collections/x", minPrice: 1 })).toBe("/collections/x");
    expect(budgetTierUrl({ minPrice: 500, maxPrice: 1000 })).toBe("/shop?minPrice=500&maxPrice=1000");
    expect(budgetTierUrl({ maxPrice: 2000 })).toBe("/shop?maxPrice=2000");
    expect(budgetTierUrl({})).toBe("/shop");
    render(
      <MemoryRouter>
        <GiftsByBudgetSection section={{ settings: { tiers: [{ id: "t", label: "L", maxPrice: 2000, enabled: true }] } }} />
      </MemoryRouter>
    );
    expect(screen.getByTestId("budget-card-0")).toHaveAttribute("href", "/shop?maxPrice=2000");
  });

  it("featured gifts uses the CMS-resolved products, and stays empty for an explicit source with no matches", () => {
    const { rerender, container } = render(
      <MemoryRouter>
        <FeaturedGiftsSection section={{ settings: { sourceMode: "MANUAL" }, products: [{ id: "1", name: "Picked" }] }} products={[{ id: "9", name: "Fallback" }]} />
      </MemoryRouter>
    );
    expect(screen.getByText("Picked")).toBeInTheDocument();
    expect(screen.queryByText("Fallback")).toBeNull();
    rerender(
      <MemoryRouter>
        <FeaturedGiftsSection section={{ settings: { sourceMode: "QUERY" }, products: [] }} products={[{ id: "9", name: "Fallback" }]} />
      </MemoryRouter>
    );
    expect(container.querySelector("[data-testid='featured-gifts']")).toBeNull();
    rerender(
      <MemoryRouter>
        <FeaturedGiftsSection section={{ settings: { sourceMode: "AUTO" } }} products={[{ id: "9", name: "Fallback" }]} />
      </MemoryRouter>
    );
    expect(screen.getByText("Fallback")).toBeInTheDocument();
  });
});

describe("Gifting navigation and footer CMS", () => {
  it("Gifting is an admin destination type that resolves to /gifting", () => {
    expect(DESTINATION_TYPES).toContain("GIFTING");
    expect(resolveDestination({ type: "GIFTING", destination: "" })).toBe("/gifting");
  });

  it("NavItemEditor offers a labelled Gifting option and prefills /gifting", async () => {
    const onChange = vi.fn();
    render(
      <NavItemEditor item={{ id: "n1", label: "Gifts", enabled: true, destinationType: "CUSTOM_URL", destination: "/" }} index={0} total={1} categories={[]} onChange={onChange} onMove={() => {}} onDelete={() => {}} />
    );
    const select = screen.getByLabelText("Destination Type");
    expect(within(select).getByRole("option", { name: "Gifting page" })).toBeInTheDocument();
    await userEvent.setup().selectOptions(select, "GIFTING");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ destinationType: "GIFTING", destination: "/gifting" }));
  });

  it("footer columns can link to the Gifting page without typing a URL", async () => {
    const onChange = vi.fn();
    render(<FooterColumnsEditor columns={[{ id: "c", title: "Company", enabled: true, links: [{ label: "Gifts", type: "CUSTOM_URL", url: "/x" }] }]} onChange={onChange} pages={[]} />);
    const select = screen.getByLabelText("Column 1 link 1 type");
    expect(within(select).getByRole("option", { name: "Gifting page" })).toBeInTheDocument();
    await userEvent.setup().selectOptions(select, "GIFTING");
    expect(onChange.mock.calls.at(-1)[0][0].links[0]).toMatchObject({ type: "GIFTING" });
  });

  it("admin sidebar has a Marketing group with Popup / Promotions", () => {
    const marketing = adminNavGroups.find((g) => g.title === "Marketing");
    expect(marketing.items).toEqual([{ to: "/admin/popup", label: "Popup / Promotions" }]);
  });
});
