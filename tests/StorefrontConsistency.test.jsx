import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

function viewport(width) {
  window.matchMedia = vi.fn((q) => {
    const max = /max-width:\s*([\d.]+)px/.exec(q);
    return { matches: max ? width <= Number(max[1]) : false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  });
}
afterEach(() => { delete window.matchMedia; cleanup(); vi.resetModules(); vi.doUnmock("../src/lib/api"); vi.doUnmock("../src/context/WishlistContext"); vi.doUnmock("../src/context/CartContext"); vi.doUnmock("../src/hooks/useSiteSettings"); vi.doUnmock("../src/components/PromoStrip"); });

// ---------------------------------------------------------------------------------------------------------
describe("footer Gifting link", () => {
  // Shape copied from the live footer settings (fc-1 "Shop") with the additive Gifting link appended.
  const footer = {
    socialHeading: "Connect With Us",
    footerColumns: [
      { id: "fc-1", title: "Shop", enabled: true, sortOrder: 1, links: [
        { label: "Multipurpose Bags", type: "CATEGORY", url: "/shop/category/multipurpose-bags", targetId: "x" },
        { label: "Table Mats", type: "CATEGORY", url: "/shop/category/table-mats", targetId: "y" },
        { label: "Gifting", type: "GIFTING", url: "/gifting" },
      ] },
      { id: "fc-2", title: "Customer Care", enabled: true, sortOrder: 3, links: [{ label: "Contact Us", type: "CUSTOM_URL", url: "/contact" }, { label: "Shipping Policy", type: "CUSTOM_URL", url: "/shipping" }] },
    ],
    artwork: { enabled: true, desktopImage: "/art.jpg", alt: "Artwork" },
  };
  async function renderFooter(f) {
    vi.resetModules();
    vi.doMock("../src/hooks/useSiteSettings", () => ({ useSiteSettings: () => ({ footer: f, social: {}, branding: {}, general: {} }) }));
    const { default: Footer } = await import("../src/components/Footer");
    return render(<MemoryRouter><Footer /></MemoryRouter>);
  }

  it("renders Gifting from the dynamic footer config and keeps every existing link", async () => {
    await renderFooter(footer);
    const link = screen.getByRole("link", { name: "Gifting" });
    expect(link).toHaveAttribute("href", "/gifting");
    for (const [name, href] of [["Multipurpose Bags", "/shop/category/multipurpose-bags"], ["Table Mats", "/shop/category/table-mats"], ["Contact Us", "/contact"], ["Shipping Policy", "/shipping"]]) {
      expect(screen.getAllByRole("link", { name }).some((a) => a.getAttribute("href") === href)).toBe(true);
    }
  });

  it("is fully admin-controlled: renamed, retargeted, or removed links follow the config", async () => {
    const edited = JSON.parse(JSON.stringify(footer));
    edited.footerColumns[0].links[2] = { label: "Gift Shop", type: "CUSTOM_URL", url: "/collections/gifts" };
    await renderFooter(edited);
    expect(screen.queryByRole("link", { name: "Gifting" })).toBeNull();
    expect(screen.getByRole("link", { name: "Gift Shop" })).toHaveAttribute("href", "/collections/gifts");
    cleanup();
    const removed = JSON.parse(JSON.stringify(footer));
    removed.footerColumns[0].links.pop();
    await renderFooter(removed);
    expect(screen.queryByRole("link", { name: /gift/i })).toBeNull();
  });

  it("a GIFTING-type link with no stored url still resolves to /gifting", async () => {
    const f = JSON.parse(JSON.stringify(footer));
    delete f.footerColumns[0].links[2].url;
    await renderFooter(f);
    expect(screen.getByRole("link", { name: "Gifting" })).toHaveAttribute("href", "/gifting");
  });

  it("footer artwork still renders alongside the new link", async () => {
    const { container } = await renderFooter(footer);
    expect(container.querySelector('img[src*="art.jpg"]')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------------------------------
describe("wishlist product links follow the mobile new-tab rule", () => {
  const removeFromWishlist = vi.fn();
  const addItem = vi.fn();
  const product = { id: "p1", slug: "vase", name: "Clay Vase", price: 1000, images: ["/v.jpg"], inStock: true, stockQuantity: 5 };
  async function renderWishlist() {
    vi.resetModules();
    vi.doMock("../src/context/WishlistContext", () => ({ useWishlist: () => ({ wishlist: [{ id: "w1", productId: "p1", product }], loading: false, removeFromWishlist }) }));
    vi.doMock("../src/context/CartContext", () => ({ useCart: () => ({ addItem, items: [] }) }));
    const { AccountWishlist } = await import("../src/pages/account/AccountPages");
    return render(<MemoryRouter><AccountWishlist /></MemoryRouter>);
  }
  const productLinks = () => screen.getAllByRole("link").filter((a) => a.getAttribute("href") === "/shop/vase");
  beforeEach(() => { removeFromWishlist.mockClear(); addItem.mockClear(); });

  it.each([390, 767])("%ipx: image and name links open in a new tab", async (w) => {
    viewport(w);
    await renderWishlist();
    expect(productLinks()).toHaveLength(2);
    productLinks().forEach((a) => { expect(a).toHaveAttribute("target", "_blank"); expect(a).toHaveAttribute("rel", "noopener noreferrer"); });
  });

  it.each([768, 1280])("%ipx: stays in the same tab", async (w) => {
    viewport(w);
    await renderWishlist();
    productLinks().forEach((a) => { expect(a).not.toHaveAttribute("target"); expect(a).not.toHaveAttribute("rel"); });
  });

  it("remove and add-to-cart are plain buttons: no link, no target, no navigation", async () => {
    viewport(390);
    await renderWishlist();
    const remove = screen.getAllByRole("button").find((b) => /remove/i.test(b.getAttribute("aria-label") || b.textContent));
    const move = screen.getByRole("button", { name: /Move to Cart/i });
    for (const b of [remove, move]) { expect(b.tagName).toBe("BUTTON"); expect(b.closest("a")).toBeNull(); expect(b).not.toHaveAttribute("target"); }
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    fireEvent.click(remove);
    fireEvent.click(move);
    expect(open).not.toHaveBeenCalled();
    expect(removeFromWishlist).toHaveBeenCalled();
    expect(addItem).toHaveBeenCalled();
    open.mockRestore();
  });
});

// ---------------------------------------------------------------------------------------------------------
describe("homepage settings hydration (no gifting flash)", () => {
  const sections = [
    { id: "explore", type: "EXPLORE_MORE", isEnabled: true, sortOrder: 1, settings: { title: "Explore More", items: [
      { id: "e1", title: "Offers", url: "/offers", enabled: true, sortOrder: 1 },
      { id: "e2", kind: "GIFTING", title: "Gifting", url: "/gifting", enabled: true, sortOrder: 2 },
    ] } },
  ];

  async function setup(showGifting, { settingsDelay = 30 } = {}) {
    vi.resetModules();
    const fetchSiteSettings = vi.fn(() => new Promise((r) => setTimeout(() => r({ data: { showGiftingOnHomepage: showGifting } }), settingsDelay)));
    // Homepage content arrives BEFORE settings: the worst case for a flash.
    const fetchHomepage = vi.fn(() => Promise.resolve({ sections }));
    vi.doMock("../src/lib/api", async (orig) => ({ ...(await orig()), fetchSiteSettings, fetchHomepage }));
    vi.doMock("../src/components/PromoStrip", () => ({ default: () => null }));
    vi.doMock("../src/context/CartContext", () => ({ useCart: () => ({ items: [], addItem: vi.fn() }) }));
    vi.doMock("../src/context/WishlistContext", () => ({ useWishlist: () => ({ isInWishlist: () => false, toggleWishlist: vi.fn() }) }));
    const { default: Home } = await import("../src/pages/Home");
    const { useSiteSettings } = await import("../src/hooks/useSiteSettings");
    // Stand-ins for Navbar/Footer, which also read the shared settings at app start.
    const Other = () => { useSiteSettings(); return null; };
    // Records, on every DOM mutation, what the homepage discovery area looks like.
    const frames = [];
    const snap = () => frames.push({ explore: !!document.querySelector('[data-testid="explore-more"]'), gifting: !!screen.queryByText("Gifting"), spinner: /Loading Tushaqsa/.test(document.body.textContent) });
    const mo = new MutationObserver(snap);
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    render(<MemoryRouter><Other /><Other /><Home /></MemoryRouter>);
    return { fetchSiteSettings, fetchHomepage, frames, stop: () => mo.disconnect() };
  }

  it("setting TRUE: Explore More first appears already containing Gifting (never without, never added later)", async () => {
    const { frames, stop } = await setup(true);
    await screen.findByTestId("explore-more");
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    stop();
    const withSection = frames.filter((f) => f.explore);
    expect(withSection.length).toBeGreaterThan(0);
    expect(withSection.every((f) => f.gifting)).toBe(true);
    expect(screen.getByText("Gifting")).toBeInTheDocument();
  });

  it("setting FALSE: gifting is never rendered at any point", async () => {
    const { frames, stop } = await setup(false);
    await screen.findByTestId("explore-more");
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    stop();
    expect(frames.some((f) => f.gifting)).toBe(false);
    expect(screen.getByText("Offers")).toBeInTheDocument();
  });

  it("waits on a stable loading state until settings settle, with no extra fetch", async () => {
    const { fetchSiteSettings, fetchHomepage } = await setup(true, { settingsDelay: 150 });
    await waitFor(() => expect(fetchHomepage).toHaveBeenCalled());
    await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
    // homepage data is back but settings are not: still the loading state, no content yet
    expect(screen.queryByTestId("explore-more")).toBeNull();
    expect(screen.getByText(/Loading Tushaqsa/)).toBeInTheDocument();
    await screen.findByTestId("explore-more");
    // three components (two stand-ins + Home) share a single settings request
    expect(fetchSiteSettings).toHaveBeenCalledTimes(1);
  });

  it("fail-safe: if settings cannot be fetched the homepage still renders, gifting OFF", async () => {
    vi.resetModules();
    vi.doMock("../src/lib/api", async (orig) => ({ ...(await orig()), fetchSiteSettings: vi.fn(() => Promise.reject(new Error("down"))), fetchHomepage: vi.fn(() => Promise.resolve({ sections })) }));
    vi.doMock("../src/components/PromoStrip", () => ({ default: () => null }));
    vi.doMock("../src/context/CartContext", () => ({ useCart: () => ({ items: [], addItem: vi.fn() }) }));
    vi.doMock("../src/context/WishlistContext", () => ({ useWishlist: () => ({ isInWishlist: () => false, toggleWishlist: vi.fn() }) }));
    const { default: Home } = await import("../src/pages/Home");
    render(<MemoryRouter><Home /></MemoryRouter>);
    await screen.findByTestId("explore-more");
    expect(screen.queryByText("Gifting")).toBeNull();
    expect(screen.getByText("Offers")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------------------------------
describe("Homepage Builder: explicit Gifting card marker", () => {
  it("marks / unmarks a card via the 'Gifting card' checkbox and leaves other cards alone", async () => {
    const { default: Fields } = await import("../src/components/admin/HomepageSectionFields");
    const onChange = vi.fn();
    const value = { items: [{ id: "a", title: "Offers", url: "/offers", enabled: true }, { id: "b", title: "Perfect Gift Ideas", url: "/shop", enabled: true }] };
    render(<Fields type="EXPLORE_MORE" value={value} onChange={onChange} />);
    const boxes = screen.getAllByRole("checkbox", { name: "Gifting card" });
    expect(boxes).toHaveLength(2);
    expect(boxes[0]).not.toBeChecked();
    fireEvent.click(boxes[1]);
    const next = onChange.mock.calls[0][0];
    expect(next.items[1].kind).toBe("GIFTING");
    expect(next.items[0].kind).toBeUndefined();
    cleanup();
    onChange.mockClear();
    render(<Fields type="PROMO_BANNERS_2UP" value={{ items: [{ id: "p", title: "Gift Edit", kind: "GIFTING", enabled: true }] }} onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: "Gifting card" });
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(onChange.mock.calls[0][0].items[0].kind).toBeUndefined();
  });

  it("other section types do not show the control", async () => {
    const { default: Fields } = await import("../src/components/admin/HomepageSectionFields");
    render(<Fields type="HOW_WE_WORK" value={{ items: [{ id: "h", title: "x", enabled: true }] }} onChange={() => {}} />);
    expect(screen.queryByRole("checkbox", { name: "Gifting card" })).toBeNull();
  });
});
