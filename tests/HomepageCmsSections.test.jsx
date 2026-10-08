import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import HomepageRenderer from "../src/components/HomepageRenderer";
import TrustServiceStrip from "../src/components/TrustServiceStrip";
import PromoBanners2Up from "../src/components/PromoBanners2Up";
import ReviewsSection, { resolveReviewSummary } from "../src/components/ReviewsSection";
import BlogPreviewSection from "../src/components/BlogPreviewSection";
import MegaMenu from "../src/components/MegaMenu";
import HomepageSectionFields from "../src/components/admin/HomepageSectionFields";
import CategoryStrip from "../src/components/CircularCategoryNav";
import { normalizeHeaderSettings } from "../src/lib/headerCmsHelpers";
import { buildNavModel } from "../src/lib/navModel";
import { spacingClass } from "../src/lib/homepageConfig";

vi.mock("../src/components/ProductCard", () => ({ default: ({ product }) => <div data-testid="product-card">{product.name}</div> }));
vi.mock("../src/components/HeroBannerCarousel", () => ({ default: () => <div /> }));
vi.mock("../src/components/PromoStrip", () => ({ default: () => <div /> }));
vi.mock("../src/components/admin/ImagePickerInput", () => ({
  default: ({ label, value, onChange }) => (
    <label>
      {label}
      <input aria-label={label} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  ),
}));
vi.mock("../src/lib/api", async (importOriginal) => ({
  ...(await importOriginal()),
  resolveMediaUrl: (url) => (url ? `http://api.test${url}` : null),
  fetchCategories: vi.fn(() => Promise.resolve({ data: [] })),
}));

const wrap = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);
const products = [
  { id: "p1", name: "Clay Vessel", slug: "clay" },
  { id: "p2", name: "Linen Runner", slug: "linen" },
];

describe("feature strip (TRUST_STRIP) config", () => {
  const items = [
    { id: "a", title: "Second", description: "d2", icon: "leaf", sortOrder: 2 },
    { id: "b", title: "First", description: "d1", icon: "shield", sortOrder: 1 },
    { id: "c", title: "Hidden", description: "d3", icon: "home", enabled: false, sortOrder: 3 },
  ];

  it("shows enabled items in sort order and hides disabled ones", () => {
    wrap(<TrustServiceStrip items={items} config={{}} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["First", "Second"]);
  });

  it("is a true full-width band with no separators, even when legacy showDividers is saved", () => {
    wrap(<TrustServiceStrip items={items} config={{ showDividers: true }} />);
    const strip = screen.getByTestId("trust-strip");
    expect(strip.className).toContain("w-full");
    expect(strip.className).not.toContain("border-y");
    expect(strip.className).not.toContain("border-b");
    expect(screen.getByTestId("trust-grid").className).not.toMatch(/max-w-|divide-|mx-auto/);
    screen.getAllByTestId("trust-item").forEach((cell) => expect(cell.className).not.toMatch(/border-|divide-/));
  });

  it("applies desktop columns, mobile layout and background", () => {
    wrap(<TrustServiceStrip items={items} config={{ desktopColumns: 3, mobileLayout: "SCROLL", background: "PLAIN" }} />);
    const strip = screen.getByTestId("trust-strip");
    expect(strip.className).toContain("store-bg");
    expect(strip.className).not.toContain("store-surface");
    expect(screen.getByTestId("trust-grid").className).toContain("lg:grid-cols-3");
    expect(screen.getByTestId("trust-grid").className).toContain("overflow-x-auto");
  });
});

describe("editorial banners (PROMO_BANNERS_2UP)", () => {
  const banners = [
    { id: "1", title: "Right", image: "/a.jpg", mobileImage: "/a-m.jpg", textAlign: "RIGHT", overlayStrength: "STRONG", sortOrder: 2, ctaUrl: "/a" },
    { id: "2", title: "Left", image: "/b.jpg", sortOrder: 1, ctaUrl: "/b" },
    { id: "3", title: "Off", image: "/c.jpg", enabled: false, ctaUrl: "/c" },
  ];

  it("renders multiple banners, ordered, skipping disabled ones, as full-width stacked banners by default", () => {
    wrap(<PromoBanners2Up promoCards={banners} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Left", "Right"]);
    expect(screen.getByTestId("promo-banners")).toHaveAttribute("data-layout", "FULL");
    expect(document.querySelector(".grid").className).toContain("grid-cols-1");
    expect(document.querySelector(".grid").className).not.toContain("md:grid-cols-2");
  });

  it("SPLIT layout places banners edge-to-edge side by side", () => {
    wrap(<PromoBanners2Up promoCards={banners} layout="SPLIT" />);
    expect(screen.getByTestId("promo-banners")).toHaveAttribute("data-layout", "SPLIT");
    expect(document.querySelector(".grid").className).toContain("md:grid-cols-2");
  });

  it("keeps every piece of copy and the CTA on top of the image, with subtitles opt-in", () => {
    const { unmount } = wrap(<PromoBanners2Up promoCards={[{ id: "1", title: "Gift Edit", subtitle: "Heritage objects", image: "/a.jpg", ctaLabel: "Explore", ctaUrl: "/g" }]} />);
    const card = screen.getByTestId("promo-banner");
    const overlay = screen.getByTestId("promo-banner-overlay");
    expect(overlay.className).toContain("absolute inset-0");
    expect(overlay.contains(screen.getByRole("heading", { level: 3 }))).toBe(true);
    expect(overlay.contains(screen.getByTestId("promo-banner-cta"))).toBe(true);
    // nothing but the image wrapper and the overlay lives inside the banner (no block below the image)
    expect(Array.from(card.children).map((c) => c.tagName)).toEqual(["PICTURE", "DIV"]);
    expect(screen.queryByTestId("promo-banner-subtitle")).toBeNull();
    unmount();
    wrap(<PromoBanners2Up showSubtitle promoCards={[{ id: "1", title: "Gift Edit", subtitle: "Heritage objects", image: "/a.jpg" }]} />);
    expect(screen.getByTestId("promo-banner-subtitle").textContent).toBe("Heritage objects");
  });

  it("applies per-banner alignment, overlay strength and the mobile image source", () => {
    wrap(<PromoBanners2Up promoCards={banners} />);
    const overlays = screen.getAllByTestId("promo-banner-overlay");
    expect(overlays[1].className).toContain("text-right");
    expect(overlays[1].className).toContain("from-charcoal/70");
    expect(overlays[0].className).toContain("text-left");
    expect(overlays[0].className).toContain("from-charcoal/55"); // MEDIUM default (lightened so photography stays visible)
    expect(document.querySelector("source[media='(max-width: 767px)']").getAttribute("srcset")).toBe("http://api.test/a-m.jpg");
  });
});

describe("section spacing", () => {
  it("maps COMPACT / NORMAL / SPACIOUS and ignores unknown values", () => {
    expect(spacingClass("NORMAL")).toBe("");
    expect(spacingClass("COMPACT")).not.toBe(spacingClass("SPACIOUS"));
    expect(spacingClass("COMPACT")).not.toBe("");
    expect(spacingClass("SPACIOUS")).not.toBe("");
    expect(spacingClass("HUGE")).toBe("");
    expect(spacingClass(undefined)).toBe("");
  });

  it("wraps a section only when spacing is non-NORMAL", () => {
    const section = (id, spacing) => ({ id, type: "TRUST_STRIP", isEnabled: true, settings: { spacing, items: [{ id: "i", title: id, description: "d", icon: "leaf" }] } });
    wrap(<HomepageRenderer sections={[section("compact", "COMPACT"), section("normal", "NORMAL"), section("roomy", "SPACIOUS")]} />);
    const wrapped = [...document.querySelectorAll("[data-spacing]")].map((n) => n.getAttribute("data-spacing"));
    expect(wrapped).toEqual(["COMPACT", "SPACIOUS"]);
  });
});

describe("new arrivals controls", () => {
  const section = (settings) => ({ id: "na", type: "NEW_ARRIVALS", isEnabled: true, settings, products });

  it("renders subtitle and CTA by default", () => {
    wrap(<HomepageRenderer sections={[section({ subtitle: "Just landed", ctaLabel: "See all", ctaUrl: "/new-arrivals" })]} />);
    expect(screen.getByText("Just landed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /See all/ })).toHaveAttribute("href", "/new-arrivals");
    expect(screen.queryByTestId("product-scroller")).toBeNull();
  });

  it("hides the CTA when showCta is false and shows arrows when showArrows is true", () => {
    wrap(<HomepageRenderer sections={[section({ ctaLabel: "See all", showCta: false, showArrows: true })]} />);
    expect(screen.queryByRole("link", { name: /See all/ })).toBeNull();
    expect(screen.getByTestId("product-scroller")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scroll left" })).toBeInTheDocument();
    expect(screen.getAllByTestId("product-card")).toHaveLength(2);
  });

  it("respects the maximum products limit", () => {
    wrap(<HomepageRenderer sections={[section({ limit: 1 })]} />);
    expect(screen.getAllByTestId("product-card")).toHaveLength(1);
  });
});

describe("reviews section", () => {
  const reviews = [
    { id: "r1", rating: 5, title: "Lovely", comment: "Beautiful lamp", customerName: "Priya S.", isVerifiedPurchase: true },
    { id: "r2", rating: 4, comment: "Good quality", customerName: "Ann K.", isVerifiedPurchase: false },
  ];
  const section = (settings, extra = {}) => ({ id: "rv", type: "TESTIMONIALS", settings, reviews, reviewSummary: { averageRating: 4.5, reviewCount: 2 }, ...extra });

  it("shows real approved-review data and the real aggregate", () => {
    wrap(<ReviewsSection section={section({})} />);
    expect(screen.getAllByTestId("review-card")).toHaveLength(2);
    expect(screen.getByTestId("reviews-summary").textContent).toContain("4.5");
    expect(screen.getByTestId("reviews-summary").textContent).toContain("2 reviews");
  });

  it("admin average rating / count override the real aggregate", () => {
    expect(resolveReviewSummary({ averageRating: 4.9, reviewCount: 500 }, { averageRating: 4.5, reviewCount: 2 })).toEqual({ averageRating: 4.9, reviewCount: 500 });
    expect(resolveReviewSummary({ averageRating: null, reviewCount: null }, { averageRating: 4.5, reviewCount: 2 })).toEqual({ averageRating: 4.5, reviewCount: 2 });
  });

  it("verified badge is only shown for verified reviews and can be turned off", () => {
    const { unmount } = wrap(<ReviewsSection section={section({})} />);
    expect(screen.getAllByText("Verified")).toHaveLength(1);
    unmount();
    wrap(<ReviewsSection section={section({ showVerifiedBadge: false })} />);
    expect(screen.queryByText("Verified")).toBeNull();
  });

  it.each([["STATIC", 2], ["SLIDER", 2]])("%s motion renders %i cards", (motion, count) => {
    wrap(<ReviewsSection section={section({ motion })} />);
    expect(screen.getByTestId("reviews-section")).toHaveAttribute("data-motion", motion);
    expect(screen.getAllByTestId("review-card")).toHaveLength(count);
  });

  describe("marquee", () => {
    const many = Array.from({ length: 4 }, (_, i) => ({ id: `m${i}`, rating: 5, comment: `Comment ${i}`, customerName: `Cust ${i}.` }));
    const marquee = (settings, list = many) => ({ id: "rv", type: "TESTIMONIALS", settings, reviews: list, reviewSummary: { averageRating: 5, reviewCount: list.length } });

    it("loops two identical halves built only from the real reviews; the duplicate half is aria-hidden", () => {
      wrap(<ReviewsSection section={marquee({ motion: "MARQUEE" })} />);
      expect(screen.getByTestId("reviews-section")).toHaveAttribute("data-motion", "MARQUEE");
      const cards = screen.getAllByTestId("review-card");
      expect(cards).toHaveLength(16); // 4 real reviews repeated to 8 per half, two halves
      const names = new Set(cards.map((c) => c.querySelector("figcaption").textContent));
      expect([...names].sort()).toEqual(["Cust 0.", "Cust 1.", "Cust 2.", "Cust 3."]);
      const wrappers = screen.getByTestId("reviews-marquee").children;
      expect(wrappers[0]).not.toHaveAttribute("aria-hidden", "true");
      expect(wrappers[wrappers.length - 1]).toHaveAttribute("aria-hidden", "true");
    });

    it("is slow by default, honours the configured speed and uses the reduced-motion-aware class", () => {
      const { unmount } = wrap(<ReviewsSection section={marquee({ motion: "MARQUEE" })} />);
      const track = screen.getByTestId("reviews-marquee");
      expect(track.className).toContain("reviews-marquee-track");
      expect(parseFloat(track.style.getPropertyValue("--reviews-duration"))).toBeGreaterThanOrEqual(90);
      unmount();
      wrap(<ReviewsSection section={marquee({ motion: "MARQUEE", speed: 120 })} />);
      expect(parseFloat(screen.getByTestId("reviews-marquee").style.getPropertyValue("--reviews-duration"))).toBeGreaterThanOrEqual(120);
    });

    it("falls back to a calm static row when there are too few real reviews to loop", () => {
      wrap(<ReviewsSection section={marquee({ motion: "MARQUEE" }, many.slice(0, 2))} />);
      expect(screen.getByTestId("reviews-section")).toHaveAttribute("data-motion", "STATIC");
      expect(screen.queryByTestId("reviews-marquee")).toBeNull();
      expect(screen.getAllByTestId("review-card")).toHaveLength(2);
    });
  });

  it("renders nothing when there are no approved reviews", () => {
    wrap(<ReviewsSection section={section({}, { reviews: [] })} />);
    expect(screen.queryByTestId("reviews-section")).toBeNull();
  });
});

describe("blog section", () => {
  const posts = [
    { id: "b1", slug: "craft", title: "On Craft", excerpt: "Slow making", author: "Aadya Editorial", publishDate: "2026-09-01T00:00:00Z", readingMinutes: 4, featuredImage: "/blog.jpg" },
    { id: "b2", slug: "light", title: "On Light", excerpt: "Warm glow", author: "Aadya Editorial", publishDate: "2026-08-01T00:00:00Z", readingMinutes: 2 },
  ];
  const section = (settings) => ({ id: "bl", type: "BLOG_PREVIEW", settings, posts });

  it("renders posts with every meta field on by default and a View All link", () => {
    wrap(<BlogPreviewSection section={section({ viewAllUrl: "/blog" })} />);
    expect(screen.getAllByTestId("blog-card")).toHaveLength(2);
    expect(screen.getByText("Slow making")).toBeInTheDocument();
    expect(screen.getAllByText(/By Aadya Editorial/)).toHaveLength(2);
    expect(screen.getByText("4 min read")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View All/ })).toHaveAttribute("href", "/blog");
  });

  it("honours the display toggles and the maximum posts", () => {
    wrap(<BlogPreviewSection section={section({ limit: 1, showExcerpt: false, showAuthor: false, showReadingTime: false, showViewAll: false })} />);
    expect(screen.getAllByTestId("blog-card")).toHaveLength(1);
    expect(screen.queryByText("Slow making")).toBeNull();
    expect(screen.queryByText(/By Aadya/)).toBeNull();
    expect(screen.queryByText(/min read/)).toBeNull();
    expect(screen.queryByRole("link", { name: /View All/ })).toBeNull();
  });

  it("falls back to /blog for an unsafe View All URL", () => {
    wrap(<BlogPreviewSection section={section({ viewAllUrl: "javascript:alert(1)" })} />);
    expect(screen.getByRole("link", { name: /View All/ })).toHaveAttribute("href", "/blog");
  });

  it("renders nothing without published posts", () => {
    wrap(<BlogPreviewSection section={{ id: "bl", settings: {}, posts: [] }} />);
    expect(screen.queryByTestId("blog-section")).toBeNull();
  });
});

describe("mega menu promo banner", () => {
  const cms = (promoCard) => normalizeHeaderSettings({
    primaryNav: { enabled: true, mode: "MANUAL", items: [{ id: "n", label: "Books", enabled: true, destinationType: "BOOKS", destination: "/books", megaMenuMode: "MANUAL", manualColumns: [{ id: "c", heading: "Browse", enabled: true, links: [{ id: "l", label: "Fiction", destination: "/fiction", enabled: true }] }], promoCard }] },
  });

  it("carries every promo field, including the mobile image, from config to the rendered card", () => {
    const [item] = buildNavModel({ cms: cms({ enabled: true, image: "/p.jpg", mobileImage: "/p-m.jpg", eyebrow: "Edit", title: "Reading", description: "Quiet picks", ctaLabel: "Read", ctaUrl: "/books", altText: "Books promo" }), categories: [] });
    expect(item.promo).toMatchObject({ image: "/p.jpg", mobileImage: "/p-m.jpg", eyebrow: "Edit", title: "Reading", description: "Quiet picks", ctaLabel: "Read", ctaUrl: "/books", altText: "Books promo" });
    wrap(<MegaMenu item={item} isOpen onClose={() => {}} id="m" />);
    const promo = screen.getByTestId("mega-promo");
    expect(within(promo).getByText("Reading")).toBeInTheDocument();
    expect(within(promo).getByAltText("Books promo")).toBeInTheDocument();
    expect(promo.querySelector("source").getAttribute("srcset")).toBe("http://api.test/p-m.jpg");
  });

  it("is absent when the promo card is disabled", () => {
    const [item] = buildNavModel({ cms: cms({ enabled: false, image: "/p.jpg", title: "Reading" }), categories: [] });
    expect(item.promo).toBeNull();
  });
});

describe("category strip separators", () => {
  const categories = [{ id: "c1", name: "Books", slug: "books", isActive: true, parentId: null, image: "/b.jpg" }];
  const strip = (circularCategories) => normalizeHeaderSettings({ circularCategories: { enabled: true, ...circularCategories } });
  const render_ = (cfg) => wrap(<CategoryStrip categories={categories} cms={strip(cfg)} />);

  it("renders top and bottom separators using theme border tokens (no hard-coded colours)", () => {
    render_({});
    const el = screen.getByTestId("category-strip");
    expect(el.className).toContain("border-t store-border");
    expect(el.className).toContain("border-b store-border");
    expect(el.className).not.toMatch(/border-(black|gray|stone|neutral)/);
  });

  it("legacy showDividers:false still removes only the bottom separator", () => {
    render_({ showDividers: false });
    const cfg = strip({ showDividers: false }).circularCategories;
    expect(cfg.showBottomSeparator).toBe(false);
    expect(cfg.showTopSeparator).toBe(true);
    expect(screen.getByTestId("category-strip").className).not.toContain("border-b");
  });

  it("renders nothing, with no separators, when the strip is off", () => {
    wrap(<CategoryStrip categories={categories} cms={normalizeHeaderSettings({ circularCategories: { enabled: false, showTopSeparator: true, showBottomSeparator: true } })} />);
    expect(screen.queryByTestId("category-strip")).toBeNull();
    expect(document.body.querySelector(".border-t, .border-b")).toBeNull();
  });

  it("legacy showCategoryCircles flags never enable the strip", () => {
    expect(normalizeHeaderSettings({ showCategoryCircles: true, showCircularCategories: true }).circularCategories.enabled).toBe(false);
  });
});

describe("homepage admin editor emits the new config", () => {
  const edit = (type, value = {}) => {
    const onChange = vi.fn();
    render(<HomepageSectionFields type={type} value={value} onChange={onChange} />);
    return onChange;
  };

  it("every section type exposes the shared spacing control", () => {
    for (const type of ["TRUST_STRIP", "NEW_ARRIVALS", "PROMO_BANNERS_2UP", "TESTIMONIALS", "BLOG_PREVIEW"]) {
      const { unmount } = render(<HomepageSectionFields type={type} value={{}} onChange={() => {}} />);
      expect(screen.getByLabelText("Section spacing")).toBeInTheDocument();
      unmount();
    }
  });

  it("writes standardized spacing values", () => {
    const onChange = edit("NEW_ARRIVALS", { title: "x" });
    fireEvent.change(screen.getByLabelText("Section spacing"), { target: { value: "SPACIOUS" } });
    expect(onChange).toHaveBeenCalledWith({ title: "x", spacing: "SPACIOUS" });
  });

  it("feature strip: section-level options", () => {
    const onChange = edit("TRUST_STRIP", { items: [] });
    fireEvent.change(screen.getByLabelText("Desktop columns"), { target: { value: "3" } });
    expect(onChange).toHaveBeenLastCalledWith({ items: [], desktopColumns: 3 });
    fireEvent.change(screen.getByLabelText("Mobile layout"), { target: { value: "SCROLL" } });
    expect(onChange).toHaveBeenLastCalledWith({ items: [], mobileLayout: "SCROLL" });
    expect(screen.queryByLabelText("Show dividers")).toBeNull(); // the strip never draws separators
  });

  it("banners: mobile image, alignment, overlay and sort order are editable per banner", () => {
    const onChange = edit("PROMO_BANNERS_2UP", { items: [{ id: "b1", title: "One", enabled: true }] });
    fireEvent.change(screen.getByLabelText("Mobile image (optional)"), { target: { value: "/m.jpg" } });
    expect(onChange.mock.lastCall[0].items[0].mobileImage).toBe("/m.jpg");
    fireEvent.change(screen.getByLabelText("Text alignment"), { target: { value: "CENTER" } });
    expect(onChange.mock.lastCall[0].items[0].textAlign).toBe("CENTER");
    fireEvent.change(screen.getByLabelText("Overlay strength"), { target: { value: "LIGHT" } });
    expect(onChange.mock.lastCall[0].items[0].overlayStrength).toBe("LIGHT");
    fireEvent.change(screen.getByLabelText("Sort order"), { target: { value: "5" } });
    expect(onChange.mock.lastCall[0].items[0].sortOrder).toBe(5);
  });

  it("reviews: motion and a cleared override is stored as null (use real data)", () => {
    const onChange = edit("TESTIMONIALS", { averageRating: 4.8 });
    fireEvent.change(screen.getByLabelText("Motion"), { target: { value: "MARQUEE" } });
    expect(onChange).toHaveBeenLastCalledWith({ averageRating: 4.8, motion: "MARQUEE" });
    fireEvent.change(screen.getByLabelText(/Average rating override/), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith({ averageRating: null });
  });

  it("new arrivals: subtitle, CTA and arrows controls", () => {
    const onChange = edit("NEW_ARRIVALS", {});
    fireEvent.change(screen.getByLabelText("Subtitle"), { target: { value: "Fresh" } });
    expect(onChange).toHaveBeenLastCalledWith({ subtitle: "Fresh" });
    fireEvent.click(screen.getByLabelText("Show CTA"));
    expect(onChange).toHaveBeenLastCalledWith({ showCta: false });
    fireEvent.click(screen.getByLabelText("Show arrows (scroll row)"));
    expect(onChange).toHaveBeenLastCalledWith({ showArrows: true });
  });

  it("blog: display toggles", () => {
    const onChange = edit("BLOG_PREVIEW", {});
    fireEvent.click(screen.getByLabelText("Show reading time"));
    expect(onChange).toHaveBeenLastCalledWith({ showReadingTime: false });
    fireEvent.click(screen.getByLabelText("Show View All"));
    expect(onChange).toHaveBeenLastCalledWith({ showViewAll: false });
  });
});
