import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ExploreMore from "../src/components/ExploreMore";
import HomepageRenderer from "../src/components/HomepageRenderer";
import HomepageSectionFields from "../src/components/admin/HomepageSectionFields";
import { moveExploreItem } from "../src/components/admin/ExploreMoreFields";

vi.mock("../src/components/HeroBannerCarousel", () => ({ default: () => <div /> }));
vi.mock("../src/components/PromoStrip", () => ({ default: () => <div /> }));
vi.mock("../src/components/ProductCard", () => ({ default: () => <div /> }));
vi.mock("../src/components/admin/ImagePickerInput", () => ({
  default: ({ label, value, onChange }) => (<label>{label}<input aria-label={label} value={value || ""} onChange={(e) => onChange(e.target.value)} /></label>),
}));
vi.mock("../src/lib/api", async (importOriginal) => ({ ...(await importOriginal()), resolveMediaUrl: (url) => (url ? `http://api.test${url}` : null) }));

const card = (n, over = {}) => ({ id: `c${n}`, title: `Card ${n}`, subtitle: `Sub ${n}`, ctaLabel: `Go ${n}`, url: `/page-${n}`, icon: "tag", enabled: true, sortOrder: n, ...over });
const view = (config) => render(<MemoryRouter><ExploreMore config={config} /></MemoryRouter>);
const titles = () => screen.getAllByTestId("explore-card").map((n) => n.querySelector("h3").textContent);

describe("ExploreMore storefront", () => {
  it("renders enabled cards sorted by sortOrder and hides disabled ones", () => {
    view({ title: "Explore More", items: [card(3), card(1), card(2, { enabled: false })] });
    expect(titles()).toEqual(["Card 1", "Card 3"]);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Explore More");
  });

  it("renders nothing when empty or all disabled", () => {
    const { container, unmount } = view({ title: "Explore More", items: [] });
    expect(container).toBeEmptyDOMElement();
    unmount();
    const second = view({ title: "Explore More", items: [card(1, { enabled: false })] });
    expect(second.container).toBeEmptyDOMElement();
  });

  it("links relative paths with the router and external URLs as anchors, never unsafe schemes", () => {
    view({ items: [card(1, { url: "/offers?tab=whats-new" }), card(2, { url: "https://example.com/x" }), card(3, { url: "javascript:alert(1)" })] });
    const cards = screen.getAllByTestId("explore-card");
    expect(cards[0]).toHaveAttribute("href", "/offers?tab=whats-new");
    expect(cards[1]).toHaveAttribute("href", "https://example.com/x");
    expect(cards[2]).not.toHaveAttribute("href");
  });

  it("uses the image when set and the icon otherwise", () => {
    view({ items: [card(1, { image: "/a.jpg", imageAlt: "Alt" }), card(2)] });
    expect(screen.getByAltText("Alt")).toHaveAttribute("src", "http://api.test/a.jpg");
    expect(screen.getAllByTestId("explore-card")[1].querySelector("svg")).not.toBeNull();
  });

  it("is rendered by the homepage renderer from an EXPLORE_MORE section", () => {
    render(<MemoryRouter><HomepageRenderer sections={[{ id: "s1", type: "EXPLORE_MORE", settings: { title: "Explore More", items: [card(1)] } }]} /></MemoryRouter>);
    expect(screen.getByTestId("explore-more")).toBeInTheDocument();
  });
});

describe("ExploreMore admin fields", () => {
  it("moveExploreItem swaps and renumbers", () => {
    const out = moveExploreItem([card(1), card(2), card(3)], 2, -1);
    expect(out.map((c) => c.id)).toEqual(["c1", "c3", "c2"]);
    expect(out.map((c) => c.sortOrder)).toEqual([1, 2, 3]);
    expect(moveExploreItem([card(1)], 0, -1)).toHaveLength(1);
  });

  it("adds, edits, reorders and removes cards", () => {
    const onChange = vi.fn();
    render(<HomepageSectionFields type="EXPLORE_MORE" value={{ title: "Explore More", items: [card(1), card(2)] }} onChange={onChange} />);
    fireEvent.click(screen.getByText("+ Add"));
    expect(onChange.mock.calls.at(-1)[0].items).toHaveLength(3);
    fireEvent.click(screen.getAllByLabelText("Move card down")[0]);
    expect(onChange.mock.calls.at(-1)[0].items.map((c) => c.id)).toEqual(["c2", "c1"]);
    fireEvent.change(screen.getAllByLabelText("Card link")[0], { target: { value: "/gifting" } });
    expect(onChange.mock.calls.at(-1)[0].items[0].url).toBe("/gifting");
    fireEvent.click(screen.getAllByText("Delete")[1]);
    expect(onChange.mock.calls.at(-1)[0].items.map((c) => c.id)).toEqual(["c1"]);
  });

  it("warns on an unsafe link", () => {
    render(<HomepageSectionFields type="EXPLORE_MORE" value={{ items: [card(1, { url: "javascript:x" })] }} onChange={() => {}} />);
    expect(screen.getByText(/Link must start with/)).toBeInTheDocument();
  });
});
