import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ShoppableReels from "../src/components/ShoppableReels";
import HomepageRenderer from "../src/components/HomepageRenderer";
import HomepageSectionFields from "../src/components/admin/HomepageSectionFields";

vi.mock("../src/components/HeroBannerCarousel", () => ({ default: () => <div /> }));
vi.mock("../src/components/PromoStrip", () => ({ default: () => <div /> }));
vi.mock("../src/components/admin/ImagePickerInput", () => ({ default: ({ label, value, onChange }) => <label>{label}<input aria-label={label} value={value || ""} onChange={(e) => onChange(e.target.value)} /></label> }));
vi.mock("../src/lib/api", async (importOriginal) => ({ ...(await importOriginal()), resolveMediaUrl: (u) => (u ? `http://api.test${u}` : null), adminUploadMedia: vi.fn() }));

const P1 = { id: "p1", name: "Clay Vessel", slug: "clay-vessel", price: 1200, image: "/p1.jpg" };
const P2 = { id: "p2", name: "Linen Runner", slug: "linen", price: 800, image: "" };
const reel = (id, over = {}) => ({ id, title: `Reel ${id}`, videoUrl: `/v/${id}.mp4`, coverImage: `/c/${id}.jpg`, ctaLabel: "", products: [], ...over });
const section = (reels, settings = {}) => ({ id: "s", type: "SHOPPABLE_REELS", settings: { title: "Shop Our Reels", reels, ...settings } });
const view = (reels, settings) => render(<MemoryRouter><ShoppableReels section={section(reels, settings)} /></MemoryRouter>);

// Controllable IntersectionObserver: tests decide which reel cards are on screen.
let observers = [];
class FakeIO { constructor(cb) { this.cb = cb; this.el = null; observers.push(this); } observe(el) { this.el = el; } disconnect() { observers = observers.filter((o) => o !== this); } unobserve() {} }
const setVisible = (el, ratio) => act(() => { observers.filter((o) => o.el === el).forEach((o) => o.cb([{ isIntersecting: ratio > 0, intersectionRatio: ratio }])); });
let playSpy; let pauseSpy;
beforeEach(() => {
  observers = [];
  vi.stubGlobal("IntersectionObserver", FakeIO);
  playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("ShoppableReels storefront", () => {
  it("renders nothing for zero reels or when none are live", () => {
    const { container } = view([]);
    expect(container).toBeEmptyDOMElement();
    const second = view([reel("a", { published: false }), reel("b", { enabled: false })]);
    expect(second.container).toBeEmptyDOMElement();
  });

  it("renders one reel, and many reels, without hardcoded count", () => {
    const one = view([reel("a")]);
    expect(screen.getAllByTestId("reel-card")).toHaveLength(1);
    one.unmount();
    view(Array.from({ length: 12 }, (_, i) => reel(`r${i}`)));
    expect(screen.getAllByTestId("reel-card")).toHaveLength(12);
  });

  it("hides unpublished reels", () => {
    view([reel("a"), reel("b", { published: false })]);
    expect(screen.getAllByTestId("reel-card")).toHaveLength(1);
    expect(screen.queryByText("Reel b")).toBeNull();
  });

  it("loads no video until a reel scrolls into view, then autoplays it muted and looping", () => {
    const { container } = view([reel("a"), reel("b")]);
    expect(container.querySelector("video")).toBeNull();
    expect(container.innerHTML).not.toContain("/v/a.mp4");
    const [cardA, cardB] = screen.getAllByTestId("reel-card");
    setVisible(cardA, 0.8);
    let videos = container.querySelectorAll("video");
    expect(videos).toHaveLength(1);
    expect(videos[0].getAttribute("src")).toBe("http://api.test/v/a.mp4");
    expect(videos[0].muted).toBe(true);
    expect(videos[0].loop).toBe(true);
    expect(playSpy).toHaveBeenCalled();
    expect(container.innerHTML).not.toContain("/v/b.mp4");
    setVisible(cardB, 0.8);
    expect(container.querySelectorAll("video")).toHaveLength(2);
  });

  it("plays every visible reel at once, all muted, and pauses one that leaves the screen", () => {
    const { container } = view([reel("a"), reel("b")]);
    const [cardA, cardB] = screen.getAllByTestId("reel-card");
    setVisible(cardA, 1); setVisible(cardB, 1);
    container.querySelectorAll("video").forEach((v) => expect(v.muted).toBe(true));
    pauseSpy.mockClear();
    setVisible(cardA, 0);
    expect(pauseSpy).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Play Reel a" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause Reel b" })).toBeInTheDocument();
  });

  it("ignores a card that is barely visible", () => {
    const { container } = view([reel("a")]);
    setVisible(screen.getByTestId("reel-card"), 0.2);
    expect(container.querySelector("video")).toBeNull();
  });

  it("lets the visitor pause and resume, and unmute only one reel at a time", () => {
    const { container } = view([reel("a"), reel("b")]);
    const [cardA, cardB] = screen.getAllByTestId("reel-card");
    setVisible(cardA, 1); setVisible(cardB, 1);
    fireEvent.click(screen.getByRole("button", { name: "Pause Reel a" }));
    expect(screen.getByRole("button", { name: "Play Reel a" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play Reel a" }));
    expect(screen.getByRole("button", { name: "Pause Reel a" })).toBeInTheDocument();
    const sound = screen.getAllByRole("button", { name: "Turn sound on" });
    fireEvent.click(sound[0]);
    let vids = [...container.querySelectorAll("video")];
    expect(vids.map((v) => v.muted)).toEqual([false, true]);
    fireEvent.click(screen.getAllByRole("button", { name: /Turn sound (on|off)/ })[1]);
    vids = [...container.querySelectorAll("video")];
    expect(vids.map((v) => v.muted)).toEqual([true, false]);
  });

  it("waits for a tap when the visitor prefers reduced motion", () => {
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    view([reel("a")]);
    setVisible(screen.getByTestId("reel-card"), 1);
    expect(playSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Play Reel a" }));
    expect(playSpy).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Pause Reel a" })).toBeInTheDocument();
  });

  it("shows the play button when the browser refuses autoplay", async () => {
    playSpy.mockImplementation(() => Promise.reject(new Error("NotAllowedError")));
    view([reel("a")]);
    setVisible(screen.getByTestId("reel-card"), 1);
    expect(await screen.findByRole("button", { name: "Play Reel a" })).toBeInTheDocument();
  });

  it("falls back to a neutral tile when the cover is missing", () => {
    view([reel("a", { coverImage: "" })]);
    expect(screen.getByTestId("reel-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("reel-card").querySelector("img")).toBeNull();
  });

  it("one linked product: Shop Now links to the product page", () => {
    view([reel("a", { products: [P1] })]);
    expect(screen.getByRole("link", { name: "Shop Now" })).toHaveAttribute("href", "/products/clay-vessel");
  });

  it("shows the title and Shop Now on top of the reel, not below it", () => {
    view([reel("a", { products: [P1] })]);
    const frame = screen.getByTestId("reel-card").firstElementChild;
    expect(within(frame).getByText("Reel a")).toBeInTheDocument();
    const cta = within(frame).getByRole("link", { name: "Shop Now" });
    expect(cta).toHaveClass("pointer-events-auto");
    expect(cta.parentElement).toHaveClass("pointer-events-none", "absolute", "bottom-0");
    expect(screen.getByTestId("reel-card").lastElementChild).toBe(frame);
  });

  it("no linked products: no CTA", () => {
    view([reel("a")]);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button", { name: "Shop Now" })).toBeNull();
  });

  it("multiple products open an accessible tray that closes on Escape and returns focus", () => {
    view([reel("a", { products: [P1, P2], ctaLabel: "Shop the look" })]);
    const trigger = screen.getByRole("button", { name: "Shop the look" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Shop this reel" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const links = within(dialog).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/products/clay-vessel", "/products/linen"]);
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("arrows scroll the carousel and can be hidden", () => {
    const scrollBy = vi.fn();
    Element.prototype.scrollBy = scrollBy;
    const first = view([reel("a")]);
    fireEvent.click(screen.getByRole("button", { name: "Next reels" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous reels" }));
    expect(scrollBy).toHaveBeenCalledTimes(2);
    first.unmount();
    view([reel("a")], { showArrows: false });
    expect(screen.queryByRole("button", { name: "Next reels" })).toBeNull();
  });

  it("renders through HomepageRenderer", () => {
    render(<MemoryRouter><HomepageRenderer sections={[section([reel("a")])]} /></MemoryRouter>);
    expect(screen.getByTestId("shoppable-reels")).toBeInTheDocument();
  });
});

describe("ShoppableReels admin editor", () => {
  const products = [{ id: "p1", name: "Clay Vessel", isActive: true }, { id: "p2", name: "Old", isActive: false }];
  function Harness({ onValue }) {
    const [value, setValue] = useState({ reels: [] });
    return <HomepageSectionFields type="SHOPPABLE_REELS" value={value} onChange={(v) => { setValue(v); onValue(v); }} products={products} />;
  }
  it("adds, edits, reorders, publishes and removes reels", () => {
    let latest;
    render(<Harness onValue={(v) => { latest = v; }} />);
    fireEvent.click(screen.getByRole("button", { name: "Add reel" }));
    fireEvent.click(screen.getByRole("button", { name: "Add reel" }));
    expect(latest.reels).toHaveLength(2);
    expect(latest.reels[0].published).toBe(false);
    fireEvent.change(screen.getByLabelText("Reel 1 title"), { target: { value: "First" } });
    fireEvent.change(screen.getByLabelText("Reel 2 title"), { target: { value: "Second" } });
    fireEvent.click(screen.getByLabelText("Reel 2 published"));
    expect(latest.reels[1].published).toBe(true);
    fireEvent.click(screen.getByLabelText("Reel 1 enabled"));
    expect(latest.reels[0].enabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Reel 1 add product"), { target: { value: "p1" } });
    expect(latest.reels[0].productIds).toEqual(["p1"]);
    fireEvent.click(screen.getByRole("button", { name: "Move reel 2 up" }));
    expect(latest.reels.map((r) => r.title)).toEqual(["Second", "First"]);
    expect(latest.reels.map((r) => r.sortOrder)).toEqual([1, 2]);
    fireEvent.click(screen.getByRole("button", { name: "Remove reel 1" }));
    expect(latest.reels.map((r) => r.title)).toEqual(["First"]);
  });
});
