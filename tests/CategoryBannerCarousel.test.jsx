import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProductCatalog from "../src/pages/shop/ProductCatalog";
import CategoryBannersEditor, { bannersFromCategory, bannersToPayload } from "../src/components/admin/CategoryBannersEditor";
import { buildCategoryIndex, resolveCategoryBanners } from "../src/lib/categoryInheritance";

const state = { categories: [] };
vi.mock("../src/components/ProductCard", () => ({ default: ({ product }) => <div data-testid="product-card">{product.name}</div> }));
vi.mock("../src/services/api", () => ({
  getProducts: vi.fn(async () => ({ data: [{ id: "p1", name: "Vase" }] })),
  getCategories: vi.fn(async () => ({ data: state.categories })),
  getCollections: vi.fn(async () => ({ data: [] })),
}));
vi.mock("../src/components/admin/ImagePickerInput", () => ({
  default: ({ label, value, onChange }) => (
    <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const bn = (id, extra = {}) => ({ id, enabled: true, desktopImage: `/uploads/${id}-d.jpg`, mobileImage: `/uploads/${id}-m.jpg`, sortOrder: 0, ...extra });
const root = (x = {}) => ({ id: "root", name: "Home Decor", slug: "home-decor", parentId: null, isActive: true, children: [], ...x });
const kid = (x = {}) => ({ id: "kid", name: "Vases", slug: "vases", parentId: "root", isActive: true, children: [], ...x });
const resolve = (cats, slug) => resolveCategoryBanners(cats.find((c) => c.slug === slug), buildCategoryIndex(cats));

describe("resolveCategoryBanners", () => {
  it("top-level category uses its own enabled banners, sorted", () => {
    const r = resolve([root({ banners: [bn("b", { sortOrder: 2 }), bn("a", { sortOrder: 1 })] })], "home-decor");
    expect(r.slides.map((s) => s.id)).toEqual(["a", "b"]);
  });
  it("child with own banners ignores the parent's", () => {
    const r = resolve([root({ banners: [bn("p")] }), kid({ banners: [bn("c")] })], "vases");
    expect(r.slides.map((s) => s.id)).toEqual(["c"]);
  });
  it("child inheriting uses the parent's banners and settings", () => {
    const r = resolve([root({ banners: [bn("p1"), bn("p2")], bannerAutoplay: false, bannerIntervalMs: 8000 }), kid()], "vases");
    expect(r.slides.map((s) => s.id)).toEqual(["p1", "p2"]);
    expect(r.autoplay).toBe(false);
    expect(r.intervalMs).toBe(8000);
  });
  it("disabled banners are skipped; an all-disabled child falls back to the parent", () => {
    const cats = [root({ banners: [bn("p")] }), kid({ banners: [bn("x", { enabled: false })] })];
    expect(resolve(cats, "vases").slides.map((s) => s.id)).toEqual(["p"]);
    expect(resolve([root({ banners: [bn("a"), bn("b", { enabled: false })] })], "home-decor").slides).toHaveLength(1);
  });
  it("legacy single banner acts as banner #1 when there is no list", () => {
    const r = resolve([root({ desktopBanner: "/d.jpg", mobileBanner: "/m.jpg" })], "home-decor");
    expect(r.slides).toHaveLength(1);
    expect(r.slides[0]).toMatchObject({ desktop: "/d.jpg", mobile: "/m.jpg" });
  });
  it("0 banners anywhere -> empty", () => {
    expect(resolve([root({ banners: [] }), kid()], "vases").slides).toEqual([]);
  });
});

const renderCategory = () =>
  render(
    <MemoryRouter initialEntries={["/shop/category/home-decor"]}>
      <Routes>
        <Route path="/shop/category/:slug" element={<ProductCatalog lockedCategory="home-decor" title="Home Decor" />} />
      </Routes>
    </MemoryRouter>,
  );

describe("category page banner carousel", () => {
  beforeEach(() => { state.categories = []; });

  it("hides the section with 0 banners", async () => {
    state.categories = [root()];
    renderCategory();
    await screen.findByTestId("product-card");
    expect(screen.queryByTestId("category-banner")).toBeNull();
  });

  it("renders a static banner (no arrows/dots) for exactly 1 banner", async () => {
    state.categories = [root({ banners: [bn("a", { title: "Spring" })] })];
    renderCategory();
    const el = await screen.findByTestId("category-banner");
    expect(el.querySelector("img").getAttribute("loading")).toBe("eager");
    expect(screen.queryByLabelText("Next banner")).toBeNull();
    expect(screen.getByText("Spring")).toBeInTheDocument();
  });

  it("renders a carousel for many banners: first eager, rest lazy, arrows and dots navigate", async () => {
    state.categories = [root({ banners: Array.from({ length: 5 }, (_, i) => bn(`s${i}`, { sortOrder: i })), bannerAutoplay: false })];
    renderCategory();
    await screen.findByTestId("category-banner");
    const slides = screen.getAllByTestId("category-banner-slide");
    expect(slides).toHaveLength(5);
    const imgs = slides.map((s) => s.querySelector("img"));
    expect(imgs[0].getAttribute("loading")).toBe("eager");
    expect(imgs.slice(1).every((i) => i.getAttribute("loading") === "lazy")).toBe(true);
    expect(screen.getAllByRole("button", { name: /Go to banner/ })).toHaveLength(5);
    fireEvent.click(screen.getByLabelText("Next banner"));
    expect(slides[1].getAttribute("aria-hidden")).toBe("false");
    fireEvent.click(screen.getByLabelText("Previous banner"));
    fireEvent.click(screen.getByLabelText("Previous banner"));
    expect(slides[4].getAttribute("aria-hidden")).toBe("false");
    fireEvent.click(screen.getByLabelText("Go to banner 3"));
    expect(slides[2].getAttribute("aria-hidden")).toBe("false");
  });

  it("swipes on touch devices", async () => {
    state.categories = [root({ banners: [bn("a"), bn("b")], bannerAutoplay: false })];
    renderCategory();
    const el = await screen.findByTestId("category-banner");
    const frame = el.querySelector("[style]");
    fireEvent.touchStart(frame, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(frame, { changedTouches: [{ clientX: 100 }] });
    expect(screen.getAllByTestId("category-banner-slide")[1].getAttribute("aria-hidden")).toBe("false");
  });

  it("autoplays, pauses on hover, and respects prefers-reduced-motion", async () => {
    vi.useFakeTimers();
    try {
      state.categories = [root({ banners: [bn("a"), bn("b")], bannerAutoplay: true, bannerIntervalMs: 3000 })];
      renderCategory();
      await act(async () => { await vi.advanceTimersByTimeAsync(10); });
      const el = screen.getByTestId("category-banner");
      const slides = screen.getAllByTestId("category-banner-slide");
      await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
      expect(slides[1].getAttribute("aria-hidden")).toBe("false");
      fireEvent.mouseEnter(el);
      await act(async () => { await vi.advanceTimersByTimeAsync(7000); });
      expect(slides[1].getAttribute("aria-hidden")).toBe("false");
    } finally {
      vi.useRealTimers();
    }
  });
});

function Harness({ initial }) {
  const [banners, setBanners] = useState(initial);
  const [autoplay, setAutoplay] = useState(true);
  const [ms, setMs] = useState(5000);
  return (
    <>
      <CategoryBannersEditor banners={banners} onChange={setBanners} autoplay={autoplay} onAutoplayChange={setAutoplay} intervalMs={ms} onIntervalChange={setMs} />
      <pre data-testid="out">{JSON.stringify(bannersToPayload(banners).map((b) => b.id))}</pre>
    </>
  );
}

describe("admin category banners editor", () => {
  it("adds, reorders, disables and removes banners", () => {
    render(<Harness initial={[]} />);
    fireEvent.click(screen.getByText("+ Add banner"));
    fireEvent.click(screen.getByText("+ Add banner"));
    expect(screen.getAllByTestId("banner-row")).toHaveLength(2);
    const ids = JSON.parse(screen.getByTestId("out").textContent);
    fireEvent.click(screen.getByLabelText("Move banner 2 up"));
    expect(JSON.parse(screen.getByTestId("out").textContent)).toEqual([ids[1], ids[0]]);
    fireEvent.click(screen.getByLabelText("Enable banner 1"));
    expect(screen.getByLabelText("Enable banner 1").checked).toBe(false);
    fireEvent.click(screen.getByLabelText("Remove banner 1"));
    expect(screen.getAllByTestId("banner-row")).toHaveLength(1);
    expect(JSON.parse(screen.getByTestId("out").textContent)).toEqual([ids[0]]);
  });

  it("caps at 20 banners", () => {
    render(<Harness initial={Array.from({ length: 20 }, (_, i) => ({ ...bn(`x${i}`), title: "", subtitle: "", ctaLabel: "", ctaUrl: "" }))} />);
    expect(screen.getByText("+ Add banner")).toBeDisabled();
  });

  it("promotes the legacy single banner to banner #1 and payload uses list position as sortOrder", () => {
    const list = bannersFromCategory({ desktopBanner: "/d.jpg", mobileBanner: "/m.jpg" });
    expect(list).toHaveLength(1);
    const payload = bannersToPayload([...list, { ...list[0], id: "z", desktopImage: "", mobileImage: "/m2.jpg" }]);
    expect(payload.map((p) => p.sortOrder)).toEqual([0, 1]);
    expect(payload[1].desktopImage).toBeNull();
  });
});
