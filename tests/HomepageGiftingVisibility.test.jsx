import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import fs from "node:fs";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({ settings: {}, server: { showGiftingOnHomepage: undefined } }));
vi.mock("../src/hooks/useSiteSettings", async (orig) => ({
  ...(await orig()),
  useSiteSettings: () => state.settings,
  refreshSiteSettings: vi.fn(),
}));
const api = vi.hoisted(() => ({ adminFetchSiteSettings: vi.fn(), adminUpdateSiteSettings: vi.fn() }));
vi.mock("../src/lib/api", async (orig) => ({ ...(await orig()), ...api }));
vi.mock("../src/components/PromoStrip", () => ({ default: () => null }));
vi.mock("../src/context/CartContext", () => ({ useCart: () => ({ items: [], addItem: vi.fn() }) }));
vi.mock("../src/context/WishlistContext", () => ({ useWishlist: () => ({ isInWishlist: () => false, toggleWishlist: vi.fn() }) }));

import HomepageRenderer from "../src/components/HomepageRenderer";
import GiftingHomepageSwitch from "../src/components/admin/GiftingHomepageSwitch";
import { DEFAULT_SITE_SETTINGS } from "../src/hooks/useSiteSettings";
import { applyGiftingVisibility, showGiftingOnHomepage } from "../src/lib/homeGifting";

const sections = () => [
  { id: "explore", type: "EXPLORE_MORE", isEnabled: true, sortOrder: 1, settings: { title: "Explore More", items: [
    { id: "e1", title: "Offers", url: "/offers", enabled: true, sortOrder: 1 },
    { id: "e2", title: "Gifting", url: "/gifting", enabled: true, sortOrder: 2, image: "/uploads/products/gift-explore.png" },
  ] } },
  { id: "promo", type: "PROMO_BANNERS_2UP", isEnabled: true, sortOrder: 2, settings: { layout: "FULL", items: [
    { id: "p2", title: "Gift Edit", ctaUrl: "/shop/category/handcrafted-dolls", enabled: true, image: "/uploads/products/gift-promo.jpg" },
  ] } },
  { id: "news", type: "NEWSLETTER", isEnabled: true, sortOrder: 3, settings: {} },
];
const renderHome = (secs = sections()) => render(<MemoryRouter><HomepageRenderer sections={secs} /></MemoryRouter>);

describe("showGiftingOnHomepage on the storefront", () => {
  it("defaults to OFF: absent, false or non-boolean values all hide gifting", () => {
    expect(DEFAULT_SITE_SETTINGS.showGiftingOnHomepage).toBe(false);
    for (const v of [undefined, false, "true", 1, null]) expect(showGiftingOnHomepage({ showGiftingOnHomepage: v })).toBe(false);
    expect(showGiftingOnHomepage({ showGiftingOnHomepage: true })).toBe(true);
  });

  it("OFF: no gifting card, no gifting images, no empty wrapper; other cards stay", () => {
    state.settings = { showGiftingOnHomepage: false };
    const { container } = renderHome();
    expect(screen.getByText("Offers")).toBeInTheDocument();
    expect(screen.queryByText("Gifting")).toBeNull();
    expect(screen.queryByText("Gift Edit")).toBeNull();
    expect(container.querySelector('a[href="/gifting"]')).toBeNull();
    expect(container.innerHTML).not.toMatch(/gift-explore|gift-promo/);
    // a section made only of gifting cards is dropped entirely, and does NOT fall back to default promo cards
    expect(screen.queryByTestId("promo-banners")).toBeNull();
    expect(container.querySelectorAll("section").length).toBe(2); // explore-more + newsletter, nothing empty
    container.querySelectorAll("section, div").forEach((el) => { if (el !== container.firstChild) expect(el.children.length + (el.textContent || "").trim().length).toBeGreaterThan(0); });
  });

  it("OFF with an absent setting behaves the same (current production state)", () => {
    state.settings = {};
    renderHome();
    expect(screen.queryByText("Gifting")).toBeNull();
    expect(screen.queryByTestId("promo-banners")).toBeNull();
  });

  it("ON: existing gifting content returns from the CMS config unchanged", () => {
    state.settings = { showGiftingOnHomepage: true };
    const { container } = renderHome();
    expect(screen.getByText("Gifting")).toBeInTheDocument();
    expect(container.querySelector('a[href="/gifting"]')).toBeInTheDocument();
    expect(screen.getByText("Gift Edit")).toBeInTheDocument();
    expect(screen.getByTestId("promo-banners")).toBeInTheDocument();
  });

  it("never mutates the stored CMS sections", () => {
    const secs = sections();
    const before = JSON.stringify(secs);
    applyGiftingVisibility(secs, false);
    expect(JSON.stringify(secs)).toBe(before);
    expect(applyGiftingVisibility(secs, true)).toBe(secs);
  });

  it("the /gifting page, header, footer, popup and bulk inquiry code never read the setting", () => {
    const files = ["src/pages/GiftingPage.jsx", "src/components/Navbar.jsx", "src/components/PrimaryNav.jsx", "src/components/Footer.jsx", "src/components/PromoPopup.jsx", "src/components/gifting/GiftingSections.jsx"];
    for (const f of files) if (fs.existsSync(f)) expect(fs.readFileSync(f, "utf8")).not.toMatch(/showGiftingOnHomepage|homeGifting/);
  });
});

describe("admin controls share one setting", () => {
  beforeEach(() => {
    state.server.showGiftingOnHomepage = false;
    api.adminFetchSiteSettings.mockReset().mockImplementation(async () => ({ data: { showGiftingOnHomepage: state.server.showGiftingOnHomepage } }));
    api.adminUpdateSiteSettings.mockReset().mockImplementation(async (d) => { Object.assign(state.server, d); return {}; });
  });
  afterEach(cleanup);

  it("Builder and Gifting page switches have the right labels and reflect the server value", async () => {
    state.server.showGiftingOnHomepage = true;
    render(<><GiftingHomepageSwitch variant="builder" /><GiftingHomepageSwitch variant="page" /></>);
    const builder = await screen.findByRole("switch", { name: "Show on Homepage" });
    const page = await screen.findByRole("switch", { name: "Show Gifting section on Homepage" });
    await waitFor(() => { expect(builder).toBeChecked(); expect(page).toBeChecked(); });
    expect(screen.getByText("Gifting Section")).toBeInTheDocument();
  });

  it("toggling one writes the single key and updates the other immediately", async () => {
    render(<><GiftingHomepageSwitch variant="builder" /><GiftingHomepageSwitch variant="page" /></>);
    const builder = await screen.findByRole("switch", { name: "Show on Homepage" });
    const page = await screen.findByRole("switch", { name: "Show Gifting section on Homepage" });
    await waitFor(() => expect(builder).not.toBeDisabled());
    await userEvent.click(builder);
    expect(api.adminUpdateSiteSettings).toHaveBeenCalledWith({ showGiftingOnHomepage: true });
    await waitFor(() => expect(page).toBeChecked());
    await userEvent.click(page);
    expect(api.adminUpdateSiteSettings).toHaveBeenLastCalledWith({ showGiftingOnHomepage: false });
    await waitFor(() => expect(builder).not.toBeChecked());
    expect(api.adminUpdateSiteSettings).toHaveBeenCalledTimes(2);
  });

  it("a control mounted later (other admin screen) reads the saved value", async () => {
    const first = render(<GiftingHomepageSwitch variant="builder" />);
    const sw = await screen.findByRole("switch");
    await waitFor(() => expect(sw).not.toBeDisabled());
    await userEvent.click(sw);
    first.unmount();
    render(<GiftingHomepageSwitch variant="page" />);
    await waitFor(() => expect(screen.getByRole("switch", { name: "Show Gifting section on Homepage" })).toBeChecked());
  });

  it("a failed save reverts and shows an error", async () => {
    api.adminUpdateSiteSettings.mockRejectedValueOnce(new Error("boom"));
    render(<GiftingHomepageSwitch variant="builder" />);
    const sw = await screen.findByRole("switch");
    await waitFor(() => expect(sw).not.toBeDisabled());
    const before = sw.checked;
    await userEvent.click(sw);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    expect(sw.checked).toBe(before);
  });
});
