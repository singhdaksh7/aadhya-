import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import TrustBanner from "../src/components/TrustBanner";
import HomepageRenderer from "../src/components/HomepageRenderer";
import HomepageSectionFields from "../src/components/admin/HomepageSectionFields";
import { hasUnresolvedPlaceholder, commercialContext } from "../src/lib/commercialText";

let mockSettings;
vi.mock("../src/hooks/useSiteSettings", () => ({ useSiteSettings: () => mockSettings }));
vi.mock("../src/components/HeroBannerCarousel", () => ({ default: () => <div data-testid="hero" /> }));
vi.mock("../src/components/PromoStrip", () => ({ default: () => <div /> }));
vi.mock("../src/components/ProductCard", () => ({ default: () => <div /> }));
vi.mock("../src/components/admin/ImagePickerInput", () => ({
  default: ({ label, value, onChange }) => (<label>{label}<input aria-label={label} value={value || ""} onChange={(e) => onChange(e.target.value)} /></label>),
}));
vi.mock("../src/lib/api", async (importOriginal) => ({ ...(await importOriginal()), resolveMediaUrl: (url) => (url ? `http://api.test${url}` : null) }));

const settings = (over = {}) => ({
  shipping: { freeShippingThreshold: 2499, dispatchEstimate: "1-2 business days" },
  returns: { enabled: true, windowDays: 10 },
  ...over,
});
const item = (id, over = {}) => ({ id, title: `Title ${id}`, description: `Desc ${id}`, icon: "truck", enabled: true, sortOrder: Number(id.replace(/\D/g, "")) || 1, ...over });
const view = (config) => render(<BrowserRouter><TrustBanner config={config} /></BrowserRouter>);

beforeEach(() => { mockSettings = settings(); });

describe("TrustBanner storefront rendering", () => {
  it("renders the review summary and repeatable items in sort order", () => {
    view({ summaryTitle: "Loved here", reviewScore: 4.8, reviewCount: 1234, reviewSource: "Verified reviews", items: [item("b2", { sortOrder: 2 }), item("a1", { sortOrder: 1 }), item("c3", { sortOrder: 3 })] });
    expect(screen.getByText("Loved here")).toBeInTheDocument();
    expect(screen.getByTestId("trust-banner-score")).toHaveTextContent("4.8");
    expect(screen.getByTestId("trust-banner-count")).toHaveTextContent("(1,234 reviews)");
    expect(screen.getByText("Verified reviews")).toBeInTheDocument();
    expect(screen.getAllByTestId("trust-banner-item").map((n) => within(n).getByRole("heading").textContent)).toEqual(["Title a1", "Title b2", "Title c3"]);
  });

  it("does not cap the number of items", () => {
    view({ items: Array.from({ length: 9 }, (_, i) => item(`i${i + 1}`)) });
    expect(screen.getAllByTestId("trust-banner-item")).toHaveLength(9);
  });

  it("skips disabled items and items hidden on both devices", () => {
    view({ items: [item("a1"), item("b2", { enabled: false }), item("c3", { showOnDesktop: false, showOnMobile: false })] });
    expect(screen.getAllByTestId("trust-banner-item")).toHaveLength(1);
  });

  it("applies per-device visibility classes", () => {
    view({ items: [item("a1", { showOnMobile: false }), item("b2", { showOnDesktop: false }), item("c3")] });
    const [desktopOnly, mobileOnly, both] = screen.getAllByTestId("trust-banner-item");
    expect(desktopOnly).toHaveClass("hidden", "sm:flex");
    expect(mobileOnly).toHaveClass("flex", "sm:hidden");
    expect(both).toHaveClass("flex");
    expect(both).not.toHaveClass("hidden");
  });

  it("resolves settings placeholders from Store Settings", () => {
    view({ items: [item("a1", { description: "Free above {freeShippingThreshold}" }), item("b2", { description: "{returnWindowDays}-day returns" }), item("c3", { description: "Ships in {dispatchEstimate}" })] });
    expect(screen.getByText("Free above ₹2,499")).toBeInTheDocument();
    expect(screen.getByText("10-day returns")).toBeInTheDocument();
    expect(screen.getByText("Ships in 1-2 business days")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it("follows a changed setting without any code change", () => {
    mockSettings = settings({ shipping: { freeShippingThreshold: 999, dispatchEstimate: "same day" } });
    view({ items: [item("a1", { description: "Free above {freeShippingThreshold}" })] });
    expect(screen.getByText("Free above ₹999")).toBeInTheDocument();
  });

  it("hides an item whose placeholder has no configured value, or returns are off", () => {
    mockSettings = settings({ shipping: { freeShippingThreshold: 2499 }, returns: { enabled: false, windowDays: 10 } });
    view({ items: [item("a1", { description: "Ships in {dispatchEstimate}" }), item("b2", { description: "{returnWindowDays}-day returns" }), item("c3", { description: "Plain" })] });
    expect(screen.getAllByTestId("trust-banner-item")).toHaveLength(1);
    expect(screen.getByText("Plain")).toBeInTheDocument();
  });

  it("hides score and count when blank so no review claim is invented", () => {
    view({ summaryTitle: "Shop with confidence", reviewScore: null, reviewCount: null, items: [item("a1")] });
    expect(screen.queryByTestId("trust-banner-score")).toBeNull();
    expect(screen.queryByTestId("trust-banner-count")).toBeNull();
  });

  it("renders nothing without a summary or visible items, and honours showSummary=false", () => {
    const { container } = view({ showSummary: false, summaryTitle: "Hidden", items: [] });
    expect(container).toBeEmptyDOMElement();
  });

  it("can be summary-only", () => {
    view({ summaryTitle: "Only summary", items: [] });
    expect(screen.getByText("Only summary")).toBeInTheDocument();
    expect(screen.queryByTestId("trust-banner-items")).toBeNull();
  });

  it("applies colour, radius and padding settings and flips text on dark backgrounds", () => {
    view({ backgroundColor: "#112233", borderRadius: 12, paddingDesktop: 50, paddingMobile: 18, items: [item("a1")] });
    const box = screen.getByTestId("trust-banner").firstChild;
    expect(box).toHaveStyle({ backgroundColor: "#112233", borderRadius: "12px" });
    expect(box.style.getPropertyValue("--tb-pad-d")).toBe("50px");
    expect(box.style.getPropertyValue("--tb-pad-m")).toBe("18px");
    expect(box).toHaveClass("text-white");
  });

  it("falls back to the ivory default for an invalid colour", () => {
    view({ backgroundColor: "red", items: [item("a1")] });
    expect(screen.getByTestId("trust-banner").firstChild).toHaveStyle({ backgroundColor: "#F6EFE3" });
  });

  it("supports a stacked mobile layout", () => {
    view({ mobileLayout: "STACKED", items: [item("a1")] });
    expect(screen.getByTestId("trust-banner-items")).toHaveClass("grid", "grid-cols-1");
  });

  it("uses uploaded icons and falls back to the glyph when one fails to load", () => {
    view({ backgroundImage: "/media/tex.jpg", items: [item("a1", { iconImage: "/media/i.png" })] });
    const imgs = document.querySelectorAll("img");
    expect(imgs.length).toBe(2);
    imgs.forEach((img) => fireEvent.error(img));
    expect(document.querySelectorAll("img").length).toBe(0);
    expect(screen.getByTestId("trust-banner-item").querySelector("svg")).not.toBeNull();
  });
});

describe("TrustBanner image-only items", () => {
  it("renders an item that has only an uploaded image", () => {
    view({ showSummary: false, items: [item("a1", { title: "", description: "", iconImage: "/media/badge.png" })] });
    const li = screen.getByTestId("trust-banner-item");
    expect(li).toHaveAttribute("data-image-only", "true");
    expect(li.querySelector("img")).toHaveAttribute("src", "http://api.test/media/badge.png");
    expect(within(li).queryByRole("heading")).toBeNull();
  });

  it("drops an image-only item whose image fails to load", () => {
    view({ summaryTitle: "Keep", items: [item("a1", { title: "", description: "", iconImage: "/media/bad.png" })] });
    fireEvent.error(screen.getByTestId("trust-banner-item").querySelector("img"));
    expect(screen.queryByTestId("trust-banner-item")).toBeNull();
  });

  it("still hides an item with no title, description or image", () => {
    view({ summaryTitle: "Keep", items: [item("a1", { title: "", description: "" })] });
    expect(screen.queryByTestId("trust-banner-item")).toBeNull();
  });

  it("mixes image-only and text items", () => {
    view({ showSummary: false, items: [item("a1"), item("b2", { title: "", description: "", iconImage: "/media/b.png" })] });
    expect(screen.getAllByTestId("trust-banner-item")).toHaveLength(2);
  });
});

describe("TrustBanner image-only mode", () => {
  const base = { imageOnly: true, bannerImage: "/media/hero-strip.jpg", summaryTitle: "Hidden", reviewScore: 4.8, items: [item("a1")] };
  it("shows only the uploaded image, never the summary or items", () => {
    view(base);
    const banner = screen.getByTestId("trust-banner");
    expect(banner).toHaveAttribute("data-image-only", "true");
    expect(banner.querySelector("img")).toHaveAttribute("src", "http://api.test/media/hero-strip.jpg");
    expect(screen.queryByTestId("trust-banner-items")).toBeNull();
    expect(screen.queryByTestId("trust-banner-summary")).toBeNull();
    expect(banner.textContent).toBe("");
  });

  it("uses the mobile image for small screens and the radius and alt text settings", () => {
    view({ ...base, bannerMobileImage: "/media/hero-strip-m.jpg", bannerAlt: "Free shipping offer", borderRadius: 10 });
    const banner = screen.getByTestId("trust-banner");
    expect(banner.querySelector("source")).toHaveAttribute("srcset", "http://api.test/media/hero-strip-m.jpg");
    expect(banner.querySelector("source")).toHaveAttribute("media", "(max-width: 639px)");
    expect(screen.getByAltText("Free shipping offer")).toHaveStyle({ borderRadius: "10px" });
  });

  it("renders nothing without an image or when the image fails to load", () => {
    const empty = view({ ...base, bannerImage: "" });
    expect(empty.container).toBeEmptyDOMElement();
    empty.unmount();
    const broken = view(base);
    fireEvent.error(screen.getByTestId("trust-banner").querySelector("img"));
    expect(broken.container).toBeEmptyDOMElement();
  });

  it("keeps a compact fixed height and crops the picture instead of growing", () => {
    view({ ...base, bannerHeightDesktop: 150, bannerHeightMobile: 90 });
    const img = screen.getByTestId("trust-banner").querySelector("img");
    expect(img).toHaveClass("object-cover", "h-[var(--tb-img-m)]", "sm:h-[var(--tb-img-d)]");
    expect(img.style.getPropertyValue("--tb-img-d")).toBe("150px");
    expect(img.style.getPropertyValue("--tb-img-m")).toBe("90px");
  });

  it("defaults to a compact 140px desktop / 110px mobile frame", () => {
    view(base);
    const img = screen.getByTestId("trust-banner").querySelector("img");
    expect(img.style.getPropertyValue("--tb-img-d")).toBe("140px");
    expect(img.style.getPropertyValue("--tb-img-m")).toBe("110px");
  });

  it("is off by default so the content banner is unchanged", () => {
    view({ bannerImage: "/media/x.jpg", items: [item("a1")] });
    expect(screen.getByTestId("trust-banner-items")).toBeInTheDocument();
    expect(screen.queryByTestId("trust-banner")).not.toHaveAttribute("data-image-only");
  });
});

describe("hasUnresolvedPlaceholder", () => {
  it("flags blank settings and leaves unknown tokens alone", () => {
    const ctx = commercialContext(settings({ shipping: { freeShippingThreshold: 2499 } }));
    expect(hasUnresolvedPlaceholder("In {dispatchEstimate}", ctx)).toBe(true);
    expect(hasUnresolvedPlaceholder("Above {freeShippingThreshold}", ctx)).toBe(false);
    expect(hasUnresolvedPlaceholder("{notAKey}", ctx)).toBe(false);
    expect(hasUnresolvedPlaceholder("plain", ctx)).toBe(false);
  });
});

describe("TrustBanner placement in HomepageRenderer", () => {
  const sec = (id, type, sortOrder, s = {}) => ({ id, type, isEnabled: true, sortOrder, settings: s });
  it("sits immediately after the hero, ahead of body sections, even if saved out of order", () => {
    render(<BrowserRouter><HomepageRenderer sections={[sec("n", "NEWSLETTER", 1), sec("tb", "TRUST_BANNER", 2, { items: [item("a1")] }), sec("h", "HERO_CAROUSEL", 3)]} /></BrowserRouter>);
    const hero = screen.getByTestId("hero");
    const banner = screen.getByTestId("trust-banner");
    expect(hero.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hero.parentElement).toBe(banner.parentElement);
    expect(banner.nextElementSibling.className).toMatch(/space-y-12/);
  });
});

describe("TrustBanner admin fields", () => {
  const mount = (value) => {
    const onChange = vi.fn();
    render(<HomepageSectionFields type="TRUST_BANNER" value={value} onChange={onChange} />);
    return onChange;
  };

  it("edits summary, appearance and colour", () => {
    const onChange = mount({ items: [], reviewCount: 5 });
    fireEvent.change(screen.getByRole("textbox", { name: "Background colour" }), { target: { value: "#FFFFFF" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ backgroundColor: "#FFFFFF" }));
    fireEvent.change(screen.getByLabelText(/Review score/), { target: { value: "4.6" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reviewScore: 4.6 }));
    fireEvent.change(screen.getByLabelText(/Review count/), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reviewCount: null }));
    fireEvent.change(screen.getByLabelText(/Corner radius/), { target: { value: "16" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ borderRadius: 16 }));
  });

  it("adds, edits and removes repeatable items", () => {
    const onChange = mount({ items: [item("a1")] });
    fireEvent.click(screen.getByText("+ Add"));
    const added = onChange.mock.calls.at(-1)[0].items;
    expect(added).toHaveLength(2);
    expect(added[1]).toMatchObject({ enabled: true, showOnDesktop: true, showOnMobile: true, sortOrder: 2 });
    fireEvent.change(screen.getByLabelText("Trust item title"), { target: { value: "New title" } });
    expect(onChange.mock.calls.at(-1)[0].items[0].title).toBe("New title");
    fireEvent.click(screen.getByLabelText(/Show on mobile/));
    expect(onChange.mock.calls.at(-1)[0].items[0].showOnMobile).toBe(false);
    fireEvent.click(screen.getByText("Delete"));
    expect(onChange.mock.calls.at(-1)[0].items).toEqual([]);
  });
});

describe("TrustBanner admin image-only toggle", () => {
  it("shows only the image controls (no items list) when image-only is on", () => {
    const onChange = vi.fn();
    const { rerender } = render(<HomepageSectionFields type="TRUST_BANNER" value={{ items: [item("a1")] }} onChange={onChange} />);
    expect(screen.getByText("+ Add")).toBeInTheDocument();
    expect(screen.queryByLabelText("Banner image (desktop)")).toBeNull();
    fireEvent.click(screen.getByLabelText("Image only"));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ imageOnly: true }));
    rerender(<HomepageSectionFields type="TRUST_BANNER" value={{ imageOnly: true, items: [item("a1")] }} onChange={onChange} />);
    expect(screen.getByLabelText("Banner image (desktop)")).toBeInTheDocument();
    expect(screen.getByLabelText("Banner image (mobile, optional)")).toBeInTheDocument();
    expect(screen.queryByText("+ Add")).toBeNull();
    expect(screen.queryByLabelText(/Review score/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Banner image (desktop)"), { target: { value: "/media/new.jpg" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ bannerImage: "/media/new.jpg" }));
  });
});
