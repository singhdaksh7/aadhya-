import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { buildNavModel, buildCategoryTree, resolveSecondaryRow } from "../src/lib/navModel";
import { commercialContext, interpolateCommercial, cartPolicyNote, shippingInfoText, returnWindowLabel } from "../src/lib/commercialText";
import { interpolateText } from "../src/lib/headerCmsHelpers";

let mockSettings;
const mockFetchPage = vi.fn();
const mockFetchFaqs = vi.fn();
vi.mock("../src/hooks/useSiteSettings", () => ({ useSiteSettings: () => mockSettings }));
vi.mock("../src/lib/api", () => ({
  fetchPageBySlug: (...a) => mockFetchPage(...a),
  fetchFaqs: (...a) => mockFetchFaqs(...a),
  fetchPromos: vi.fn(() => Promise.resolve({ data: [] })),
  resolveProductImageUrl: (u) => u || null,
  resolveMediaUrl: (u) => u || null,
}));

const SystemPage = (await import("../src/pages/SystemPage")).default;
const FAQ = (await import("../src/pages/FAQ")).default;
const TopUtilityBar = (await import("../src/components/TopUtilityBar")).default;

const baseSettings = (over = {}) => ({
  general: { storeName: "Aadya" },
  shipping: { freeShippingThreshold: 2499, standardShippingAmount: 150, dispatchEstimate: "1-2 business days", deliveryEstimate: "3-7 business days" },
  returns: { enabled: true, windowDays: 7 },
  checkout: { pricesIncludeTax: true },
  header: { showUtilityBar: true },
  ...over,
});
beforeEach(() => { mockSettings = baseSettings(); mockFetchPage.mockReset(); mockFetchFaqs.mockReset(); });

const cat = (id, name, slug, parentId = null, extra = {}) => ({ id, name, slug, parentId, isActive: true, sortOrder: 0, ...extra });
const tree = (cats) => buildCategoryTree(cats);
const CATS = [cat("books", "Books", "books"), cat("slow", "Slow Living", "books-slow-living", "books"), cat("jg", "Journals", "books-journals-and-guides", "books")];

describe("Books secondary row (admin-configured)", () => {
  const row = (items, extra = {}) => ({ enabled: true, items, ...extra });
  const it1 = (o) => ({ enabled: true, showDesktop: true, ...o });

  it("loads labels and destinations from config, ordered by sortOrder", () => {
    const links = resolveSecondaryRow(tree(CATS), row([
      it1({ id: "b", label: "Slow Living", destinationType: "CATEGORY", categorySlug: "books-slow-living", sortOrder: 2 }),
      it1({ id: "a", label: "New Releases", destinationType: "CUSTOM_URL", destination: "/shop/books#new-releases", sortOrder: 1 }),
    ]));
    expect(links.map((l) => l.label)).toEqual(["New Releases", "Slow Living"]);
    expect(links.map((l) => l.to)).toEqual(["/shop/books#new-releases", "/shop/category/books-slow-living"]);
  });

  it("supports rename, reorder, add and remove purely through config", () => {
    const before = resolveSecondaryRow(tree(CATS), row([it1({ id: "a", label: "New Releases", destinationType: "CUSTOM_URL", destination: "/books", sortOrder: 1 })]));
    const after = resolveSecondaryRow(tree(CATS), row([
      it1({ id: "z", label: "Staff Picks", destinationType: "CUSTOM_URL", destination: "/best-sellers", sortOrder: 1 }),
      it1({ id: "a", label: "Fresh Arrivals", destinationType: "CUSTOM_URL", destination: "/books", sortOrder: 2 }),
    ]));
    expect(before.map((l) => l.label)).toEqual(["New Releases"]);
    expect(after.map((l) => l.label)).toEqual(["Staff Picks", "Fresh Arrivals"]);
  });

  it("hides disabled items and the whole row when disabled", () => {
    const items = [it1({ id: "a", label: "A", destinationType: "CUSTOM_URL", destination: "/a", sortOrder: 1 }), it1({ id: "b", label: "B", destinationType: "CUSTOM_URL", destination: "/b", sortOrder: 2, enabled: false })];
    expect(resolveSecondaryRow(tree(CATS), row(items)).map((l) => l.label)).toEqual(["A"]);
    expect(resolveSecondaryRow(tree(CATS), row(items, { enabled: false }))).toEqual([]);
  });

  it("never produces a dead link: inactive/missing categories, blank and unsafe URLs are dropped", () => {
    const inactive = [...CATS.slice(0, 2), cat("jg", "Journals", "books-journals-and-guides", "books", { isActive: false })];
    const links = resolveSecondaryRow(tree(inactive), row([
      it1({ id: "1", label: "Journals", destinationType: "CATEGORY", categorySlug: "books-journals-and-guides", sortOrder: 1 }),
      it1({ id: "2", label: "Ghost", destinationType: "CATEGORY", categorySlug: "nope", sortOrder: 2 }),
      it1({ id: "3", label: "Blank", destinationType: "CUSTOM_URL", destination: "  ", sortOrder: 3 }),
      it1({ id: "4", label: "Evil", destinationType: "CUSTOM_URL", destination: "javascript:alert(1)", sortOrder: 4 }),
      it1({ id: "5", label: "Slow", destinationType: "CATEGORY", categorySlug: "books-slow-living", sortOrder: 5 }),
    ]));
    expect(links.map((l) => l.label)).toEqual(["Slow"]);
  });

  it("missing config falls back to the built-in default row; config overrides it", () => {
    const booksItem = { id: "n", label: "Books", enabled: true, destinationType: "BOOKS", destination: "/books", megaMenuMode: "MANUAL", manualColumns: [{ id: "c", enabled: true, links: [{ id: "l", label: "All", destination: "/books", enabled: true }] }] };
    const build = (item) => buildNavModel({ cms: { primaryNav: { mode: "MANUAL", items: [item] } }, categories: CATS, navigation: [] })[0];
    expect(resolveSecondaryRow(tree(CATS), undefined)).toBeNull();
    expect(build(booksItem).secondaryLinks.map((l) => l.label)).toEqual(["New Releases", "Editor’s Picks", "Slow Living", "Journals & Guides"]);
    const custom = build({ ...booksItem, secondaryRow: row([it1({ id: "x", label: "Only One", destinationType: "CUSTOM_URL", destination: "/books", sortOrder: 1 })]) });
    expect(custom.secondaryLinks.map((l) => l.label)).toEqual(["Only One"]);
    expect(build({ ...booksItem, secondaryRow: row([], { enabled: false }) }).secondaryLinks).toEqual([]);
  });
});

describe("commercial text: one setting drives every message", () => {
  it("renders {freeShippingThreshold} in both brace styles, formatted as currency", () => {
    const ctx = commercialContext(baseSettings());
    expect(interpolateCommercial("Free shipping on orders {freeShippingThreshold}+", ctx)).toBe("Free shipping on orders ₹2,499+");
    expect(interpolateCommercial("Above {{freeShippingThreshold}}", ctx)).toBe("Above ₹2,499");
  });

  it("changing the threshold changes every rendered message", () => {
    const text = "Free shipping on orders {freeShippingThreshold}+";
    const a = interpolateCommercial(text, commercialContext(baseSettings()));
    const b = interpolateCommercial(text, commercialContext(baseSettings({ shipping: { freeShippingThreshold: 1999 } })));
    expect(a).toContain("2,499");
    expect(b).toContain("1,999");
    expect(b).not.toContain("2,499");
    expect(interpolateText(text, commercialContext(baseSettings({ shipping: { freeShippingThreshold: 999 } })))).toBe("Free shipping on orders ₹999+");
  });

  it("fills return window, dispatch and delivery placeholders; leaves unknown tokens alone", () => {
    const ctx = commercialContext(baseSettings({ returns: { enabled: true, windowDays: 14 } }));
    expect(interpolateCommercial("{returnWindowDays} days; dispatch {dispatchEstimate}; delivery {deliveryEstimate}; {unknownThing}", ctx)).toBe("14 days; dispatch 1-2 business days; delivery 3-7 business days; {unknownThing}");
  });

  it("cart policy note reflects tax and return settings and never over-promises", () => {
    expect(cartPolicyNote(commercialContext(baseSettings()))).toBe("Taxes included. 7-day returns.");
    expect(cartPolicyNote(commercialContext(baseSettings({ returns: { enabled: false, windowDays: 7 } })))).toBe("Taxes included.");
    expect(cartPolicyNote(commercialContext(baseSettings({ returns: { enabled: true, windowDays: 30 } })))).toBe("Taxes included. 30-day returns.");
    expect(cartPolicyNote(commercialContext(baseSettings({ checkout: { pricesIncludeTax: false }, returns: { enabled: false } })))).toBe("");
    expect(returnWindowLabel(commercialContext(baseSettings({ returns: { enabled: true, windowDays: 0 } })))).toBe("");
  });

  it("product shipping fallback is built only from configured values", () => {
    expect(shippingInfoText(commercialContext(baseSettings()))).toBe("Dispatched within 1-2 business days. Estimated delivery in 3-7 business days. Free shipping on orders above ₹2,499.");
    expect(shippingInfoText(commercialContext({ shipping: { freeShippingThreshold: 1500 } }))).toBe("Free shipping on orders above ₹1,500.");
    expect(shippingInfoText(commercialContext({}))).toBe("");
  });
});

describe("TopUtilityBar placeholder", () => {
  const renderBar = () => render(<MemoryRouter><TopUtilityBar /></MemoryRouter>);
  const withUtility = (threshold) => baseSettings({
    shipping: { freeShippingThreshold: threshold },
    header: { utilityBar: { enabled: true, centerMessage: "Free shipping on orders {freeShippingThreshold}+", items: [{ id: "ub-1", enabled: true, label: "Free shipping {freeShippingThreshold}+", url: "/shipping" }] } },
  });

  it("renders the configured threshold and follows changes to it", () => {
    mockSettings = withUtility(2499);
    const { unmount } = renderBar();
    expect(screen.getAllByText(/₹2,499\+/).length).toBeGreaterThan(0);
    unmount();
    mockSettings = withUtility(1800);
    renderBar();
    expect(screen.getAllByText(/₹1,800\+/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/2,499/)).toBeNull();
  });
});

describe("system pages (About / Shipping / Returns / Privacy / Terms) load from the CMS", () => {
  const renderPage = (slug) => render(<MemoryRouter><SystemPage slug={slug} fallbackTitle={slug} /></MemoryRouter>);
  const page = (slug, name, content, extra = {}) => ({ data: { slug, name, content, excerpt: "", featuredImage: null, ...extra } });

  it.each([
    ["about", "About Aadya", "<p>Aadya is a home and lifestyle store.</p>"],
    ["shipping", "Shipping & Delivery", "<p>We dispatch orders in time.</p>"],
    ["returns", "Returns & Exchanges", "<p>Contact us to start a return.</p>"],
    ["privacy", "Privacy Policy", "<p>We collect only what an order needs.</p>"],
    ["terms", "Terms of Service", "<p>By ordering you agree to these terms.</p>"],
  ])("%s renders the CMS title and body and requests its own slug", async (slug, name, body) => {
    mockFetchPage.mockResolvedValue(page(slug, name, body));
    renderPage(slug);
    expect(await screen.findByRole("heading", { level: 1, name })).toBeInTheDocument();
    expect(screen.getByText(body.replace(/<[^>]+>/g, ""))).toBeInTheDocument();
    expect(mockFetchPage).toHaveBeenCalledWith(slug);
  });

  it("fills commercial placeholders from Store Settings (shipping threshold, return window)", async () => {
    mockFetchPage.mockResolvedValue(page("shipping", "Shipping", "<p>Free shipping above {{freeShippingThreshold}}. Returns within {{returnWindowDays}} days.</p>"));
    mockSettings = baseSettings({ shipping: { freeShippingThreshold: 3000 }, returns: { enabled: true, windowDays: 10 } });
    renderPage("shipping");
    expect(await screen.findByText("Free shipping above ₹3,000. Returns within 10 days.")).toBeInTheDocument();
  });

  it("uses a safe, promise-free fallback when the page record is missing", async () => {
    mockFetchPage.mockRejectedValue(Object.assign(new Error("nf"), { status: 404 }));
    renderPage("returns");
    expect(await screen.findByTestId("system-page-fallback")).toBeInTheDocument();
    expect(screen.getByText(/being updated/i)).toBeInTheDocument();
    expect(screen.queryByText(/\d+-day|₹/)).toBeNull();
  });
});

describe("FAQ page", () => {
  const cats = [
    { id: "c1", name: "Shipping", items: [{ id: "q1", question: "When is shipping free?", answer: "<p>Free on orders above {freeShippingThreshold}.</p>" }, { id: "q2", question: "How long does it take?", answer: "<p>Delivery in {deliveryEstimate}.</p>" }] },
    { id: "c2", name: "Returns", items: [{ id: "q3", question: "Can I return an item?", answer: "<p>Within {returnWindowDays} days.</p>" }] },
  ];

  it("renders populated entries, filters by category and expands an answer with live values", async () => {
    mockFetchFaqs.mockResolvedValue({ data: cats });
    render(<MemoryRouter><FAQ /></MemoryRouter>);
    expect(await screen.findByText("When is shipping free?")).toBeInTheDocument();
    expect(screen.getByText("Can I return an item?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("When is shipping free?"));
    expect(await screen.findByText("Free on orders above ₹2,499.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Returns" }));
    await waitFor(() => expect(screen.queryByText("When is shipping free?")).toBeNull());
    expect(screen.getByText("Can I return an item?")).toBeInTheDocument();
  });

  it("shows no entries (and no crash) when there are none", async () => {
    mockFetchFaqs.mockResolvedValue({ data: [] });
    render(<MemoryRouter><FAQ /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText("When is shipping free?")).toBeNull());
  });
});
