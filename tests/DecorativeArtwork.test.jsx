import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SiteDecorations, DecorationLayer } from "../src/components/DecorationLayer";
import HomepageRenderer from "../src/components/HomepageRenderer";
import AdminDecorations from "../src/pages/admin/AdminDecorations";
import { normalizeDecorations, matchesRoute, expandBothSides, wrapperStyle, normalizeDecoration } from "../src/lib/decorations";

let mockSettings;
const api = vi.hoisted(() => ({
  adminFetchSiteSettings: vi.fn(), adminUpdateSiteSettings: vi.fn(), adminListCategories: vi.fn(), adminListPages: vi.fn(), adminFetchHomepage: vi.fn(),
}));
vi.mock("../src/hooks/useSiteSettings", () => ({ useSiteSettings: () => mockSettings, refreshSiteSettings: vi.fn(() => Promise.resolve()) }));
vi.mock("../src/components/HeroBannerCarousel", () => ({ default: () => <div data-testid="hero" /> }));
vi.mock("../src/components/PromoStrip", () => ({ default: () => <div /> }));
vi.mock("../src/components/admin/ImagePickerInput", () => ({
  default: ({ label, value, onChange }) => (<label>{label}<input aria-label={label} value={value || ""} onChange={(e) => onChange(e.target.value)} /></label>),
}));
vi.mock("../src/lib/api", async (importOriginal) => ({ ...(await importOriginal()), resolveMediaUrl: (u) => (u ? `http://api.test${u}` : null), ...api }));

const deco = (over = {}) => ({ id: "d1", enabled: true, name: "Tree", image: "/art/tree.png", alt: "", scope: "SITE", targetId: "", side: "LEFT", vertical: "CENTER", width: 260, offsetX: -40, offsetY: 0, opacity: 1, rotation: 0, showDesktop: true, showTablet: true, showMobile: false, ...over });
const set = (...items) => { mockSettings = { decorations: { items } }; };
const at = (path, ui = <SiteDecorations />) => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
const arts = () => screen.queryAllByTestId("decoration");

beforeEach(() => { mockSettings = { decorations: { items: [] } }; Object.values(api).forEach((f) => f.mockReset()); });

describe("Decorative artwork rendering", () => {
  it("1. renders nothing when nothing is configured", () => {
    const { container } = at("/");
    expect(container).toBeEmptyDOMElement();
    mockSettings = {};
    const second = at("/");
    expect(second.container).toBeEmptyDOMElement();
  });

  it("2. hides a disabled item", () => {
    set(deco({ enabled: false }));
    const { container } = at("/");
    expect(container).toBeEmptyDOMElement();
  });

  it("3. homepage scope shows on / only", () => {
    set(deco({ scope: "HOME" }));
    const home = at("/"); expect(arts()).toHaveLength(1); home.unmount();
    at("/blog"); expect(arts()).toHaveLength(0);
  });

  it("4. entire-site scope shows on every route, once", () => {
    set(deco({ scope: "SITE" }));
    for (const path of ["/", "/shop/category/lighting", "/products/x", "/about", "/blog/post"]) {
      const view = at(path);
      expect(arts()).toHaveLength(1);
      view.unmount();
    }
  });

  it("5. category scope: all categories, or one specific category by slug", () => {
    set(deco({ id: "all", scope: "CATEGORIES" }), deco({ id: "one", scope: "CATEGORY", targetId: "home-decor" }));
    const lighting = at("/shop/category/lighting");
    expect(arts().map((a) => a.dataset.decorationId)).toEqual(["all"]); lighting.unmount();
    const decor = at("/shop/category/home-decor");
    expect(arts().map((a) => a.dataset.decorationId)).toEqual(["all", "one"]); decor.unmount();
    at("/"); expect(arts()).toHaveLength(0);
  });

  it("6. CMS page scope matches the page slug", () => {
    set(deco({ scope: "PAGE", targetId: "about" }));
    const about = at("/about"); expect(arts()).toHaveLength(1); about.unmount();
    const cms = at("/pages/about"); expect(arts()).toHaveLength(1); cms.unmount();
    at("/contact"); expect(arts()).toHaveLength(0);
  });

  it("product, books and blog scopes match their routes", () => {
    set(deco({ id: "p", scope: "PRODUCTS" }), deco({ id: "b", scope: "BOOKS" }), deco({ id: "g", scope: "BLOG" }));
    const prod = at("/products/clay-vessel"); expect(arts().map((a) => a.dataset.decorationId)).toEqual(["p"]); prod.unmount();
    const books = at("/shop/books"); expect(arts().map((a) => a.dataset.decorationId)).toEqual(["b"]); books.unmount();
    at("/blog"); expect(arts().map((a) => a.dataset.decorationId)).toEqual(["g"]);
  });

  it("7. homepage-section scope renders inside that section only, by stable id", () => {
    set(deco({ scope: "HOME_SECTION", targetId: "sec-2" }));
    const sections = [
      { id: "sec-1", type: "TRUST_BANNER", isEnabled: true, sortOrder: 1, settings: { summaryTitle: "One", items: [] } },
      { id: "sec-2", type: "TRUST_BANNER", isEnabled: true, sortOrder: 2, settings: { summaryTitle: "Two", items: [] } },
    ];
    at("/", <HomepageRenderer sections={sections} />);
    const wrappers = screen.getAllByTestId("decorated-section");
    expect(wrappers).toHaveLength(1);
    expect(within(wrappers[0]).getByText("Two")).toBeInTheDocument();
    expect(arts()).toHaveLength(1);
    expect(screen.queryByTestId("decoration-layer")).not.toBeNull();
    // never from the route-level layer
    const { container } = at("/", <SiteDecorations />);
    expect(container).toBeEmptyDOMElement();
  });

  it("8/9. left and right alignment use the matching edge", () => {
    set(deco({ id: "l", side: "LEFT", offsetX: 12 }), deco({ id: "r", side: "RIGHT", offsetX: 30 }));
    at("/");
    const [left, right] = arts();
    expect(left.style.left).toBe("12px"); expect(left.style.right).toBe("");
    expect(right.style.right).toBe("30px"); expect(right.style.left).toBe("");
  });

  it("10. negative offsets are kept so artwork can sit partly off-screen, inside a clipped layer", () => {
    set(deco({ offsetX: -90 }));
    at("/");
    expect(arts()[0].style.left).toBe("-90px");
    const layer = screen.getByTestId("decoration-layer");
    expect(layer).toHaveClass("overflow-hidden", "absolute", "inset-0");
  });

  it("11/12. opacity and rotation (and flip) are applied", () => {
    set(deco({ opacity: 0.4, rotation: 25, flipH: true }));
    at("/");
    const el = arts()[0];
    expect(el.style.opacity).toBe("0.4");
    expect(el.style.transform).toContain("rotate(25deg)");
    expect(el.style.transform).toContain("scale(-1, 1)");
  });

  it("13. device visibility: mobile is off by default, each device can be toggled", () => {
    set(deco({ id: "default" }), deco({ id: "phone", showMobile: true, showDesktop: false }));
    at("/");
    const [def, phone] = arts();
    expect(def.className).toContain("hidden sm:block lg:block");
    expect(phone.className).toContain("block sm:block lg:hidden");
  });

  it("per-device widths: tablet/mobile derive from desktop unless overridden", () => {
    set(deco({ width: 400 }), deco({ id: "o", width: 400, widthTablet: 300, widthMobile: 90 }));
    at("/");
    const [auto, over] = arts();
    expect(auto.style.getPropertyValue("--deco-w-d")).toBe("400px");
    expect(auto.style.getPropertyValue("--deco-w-t")).toBe("280px");
    expect(auto.style.getPropertyValue("--deco-w-m")).toBe("140px");
    expect(over.style.getPropertyValue("--deco-w-t")).toBe("300px");
    expect(over.style.getPropertyValue("--deco-w-m")).toBe("90px");
  });

  it("14. never intercepts pointer events", () => {
    set(deco(), deco({ id: "fixed", positionMode: "FIXED" }));
    at("/");
    expect(screen.getByTestId("decoration-layer")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("decoration-layer-fixed")).toHaveClass("pointer-events-none");
    arts().forEach((a) => expect(a).toHaveClass("pointer-events-none"));
  });

  it("15. invalid items are safely ignored without throwing", () => {
    set(
      deco({ id: "no-image", image: "" }),
      deco({ id: "bad-url", image: "javascript:alert(1)" }),
      deco({ id: "bad-scope", scope: "NOPE" }),
      deco({ id: "no-target", scope: "CATEGORY", targetId: "" }),
      deco({ id: "nan", width: "wide", opacity: "x", rotation: 9999 }),
      null, "junk",
      deco({ id: "ok" }),
    );
    expect(() => at("/")).not.toThrow();
    const ids = arts().map((a) => a.dataset.decorationId);
    expect(ids).toContain("ok");
    expect(ids).toContain("nan");
    expect(ids).not.toContain("no-image");
    expect(ids).not.toContain("bad-url");
    expect(ids).not.toContain("bad-scope");
    expect(ids).not.toContain("no-target");
    const nan = normalizeDecoration(deco({ width: "wide", opacity: "x", rotation: 9999 }));
    expect(nan).toMatchObject({ width: 260, opacity: 1, rotation: 180 });
  });

  it("16. multiple decorations render independently, with duplicate ids dropped", () => {
    set(deco({ id: "a", scope: "HOME", side: "LEFT" }), deco({ id: "b", scope: "HOME", side: "RIGHT" }), deco({ id: "c", scope: "BOOKS" }), deco({ id: "a", scope: "HOME" }));
    const view = at("/");
    expect(arts().map((x) => x.dataset.decorationId)).toEqual(["a", "b"]);
    view.unmount();
    at("/books");
    expect(arts().map((x) => x.dataset.decorationId)).toEqual(["c"]);
  });

  it("both edges renders a mirrored pair, or an unmirrored pair when mirroring is off", () => {
    set(deco({ id: "pair", side: "BOTH", rotation: 20, offsetX: -30 }));
    const view = at("/");
    let [l, r] = arts();
    expect([l.dataset.side, r.dataset.side]).toEqual(["LEFT", "RIGHT"]);
    expect(l.style.left).toBe("-30px"); expect(r.style.right).toBe("-30px");
    expect(l.style.transform).toContain("rotate(20deg)"); expect(l.style.transform).not.toContain("scale(-1");
    expect(r.style.transform).toContain("rotate(-20deg)"); expect(r.style.transform).toContain("scale(-1, 1)");
    view.unmount();
    set(deco({ id: "pair", side: "BOTH", rotation: 20, mirrorBoth: false }));
    at("/");
    [l, r] = arts();
    expect(r.style.transform).toContain("rotate(20deg)"); expect(r.style.transform ?? "").not.toContain("scale(-1");
  });

  it("anchors: top, centre and bottom, and non-destructive crop settings", () => {
    const top = normalizeDecoration(deco({ vertical: "TOP", offsetY: 12 }));
    const bottom = normalizeDecoration(deco({ vertical: "BOTTOM", offsetY: 5 }));
    const center = normalizeDecoration(deco({ vertical: "CENTER", offsetY: 10 }));
    expect(wrapperStyle(top).top).toBe("12px");
    expect(wrapperStyle(bottom).bottom).toBe("5px");
    expect(wrapperStyle(center).top).toBe("calc(50% + 10px)");
    expect(wrapperStyle(center).transform).toContain("translateY(-50%)");
    set(deco({ focalX: 20, focalY: 80, zoom: 1.5, frameAspect: 0.5 }));
    at("/");
    const img = arts()[0].querySelector("img");
    expect(img.style.objectPosition).toBe("20% 80%");
    expect(img.style.transform).toBe("scale(1.5)");
    expect(arts()[0].firstChild.style.aspectRatio).toMatch(/^0.5/);
    expect(img).toHaveAttribute("src", "http://api.test/art/tree.png");
  });

  it("drops an image that fails to load instead of showing a broken icon", () => {
    set(deco());
    at("/");
    fireEvent.error(arts()[0].querySelector("img"));
    expect(arts()).toHaveLength(0);
  });

  it("route matching helper", () => {
    const item = normalizeDecoration(deco({ scope: "CATEGORY", targetId: "books" }));
    expect(matchesRoute(item, "/shop/category/books/")).toBe(true);
    expect(matchesRoute(item, "/shop/category/lighting")).toBe(false);
    expect(expandBothSides(normalizeDecorations({ decorations: { items: [deco({ side: "BOTH" })] } }))).toHaveLength(2);
  });

  it("DecorationLayer renders nothing for an empty list", () => {
    const { container } = render(<DecorationLayer items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Decorative artwork admin page", () => {
  const saved = [deco({ id: "a", name: "Left tree" }), deco({ id: "b", name: "Right tree", side: "RIGHT" })];
  const mountAdmin = async () => {
    api.adminFetchSiteSettings.mockResolvedValue({ data: { decorations: { items: saved } } });
    api.adminListCategories.mockResolvedValue({ items: [{ id: "c1", slug: "home-decor", name: "Home Decor" }] });
    api.adminListPages.mockResolvedValue({ items: [{ id: "p1", slug: "about", name: "About" }] });
    api.adminFetchHomepage.mockResolvedValue({ sections: [{ id: "sec-9", type: "BLOG_PREVIEW", name: "Stories" }] });
    api.adminUpdateSiteSettings.mockResolvedValue({});
    render(<MemoryRouter><AdminDecorations /></MemoryRouter>);
    await screen.findByText("Left tree");
  };

  it("lists decorations, adds, duplicates, reorders, deletes and saves them", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await mountAdmin();
    fireEvent.click(screen.getByRole("button", { name: "+ Add Decoration" }));
    expect(screen.getByLabelText("Admin label")).toHaveValue("New decoration");
    fireEvent.change(screen.getByLabelText("Artwork image (PNG / WebP with transparency works best)"), { target: { value: "/art/new.png" } });
    fireEvent.click(screen.getByRole("button", { name: "Duplicate Right tree" }));
    expect(screen.getAllByText(/\(copy\)/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Move Right tree down" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Left tree" }));
    expect(screen.queryByText("Left tree")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.adminUpdateSiteSettings).toHaveBeenCalled());
    const payload = api.adminUpdateSiteSettings.mock.calls[0][0].decorations.items;
    expect(payload.map((i) => i.name)).toEqual(["Right tree (copy)", "Right tree", "New decoration"]);
    expect(payload.map((i) => i.sortOrder)).toEqual([1, 2, 3]);
    expect(new Set(payload.map((i) => i.id)).size).toBe(3);
  });

  it("edits placement, target, side, offsets, opacity, rotation, flip, crop and devices", async () => {
    await mountAdmin();
    fireEvent.change(screen.getByLabelText("Placement"), { target: { value: "CATEGORY" } });
    fireEvent.change(screen.getByLabelText("Target"), { target: { value: "home-decor" } });
    fireEvent.change(screen.getByLabelText("Side"), { target: { value: "BOTH" } });
    expect(screen.getByLabelText("Mirror the right-hand copy")).toBeChecked();
    fireEvent.change(screen.getByLabelText("X offset (px, negative pushes it off the edge)"), { target: { value: "-60" } });
    fireEvent.change(screen.getByLabelText("Opacity (0.1 – 1)"), { target: { value: "0.5" } });
    fireEvent.change(screen.getByLabelText("Rotation (degrees, -180 to 180)"), { target: { value: "-15" } });
    fireEvent.click(screen.getByLabelText("Flip vertically"));
    fireEvent.change(screen.getByLabelText("Zoom (0.5 – 3)"), { target: { value: "1.4" } });
    fireEvent.click(screen.getByLabelText("Show on mobile"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.adminUpdateSiteSettings).toHaveBeenCalled());
    const first = api.adminUpdateSiteSettings.mock.calls[0][0].decorations.items[0];
    expect(first).toMatchObject({ scope: "CATEGORY", targetId: "home-decor", side: "BOTH", offsetX: -60, opacity: 0.5, rotation: -15, flipV: true, zoom: 1.4, showMobile: true });
  });

  it("offers real homepage sections, pages and categories as targets", async () => {
    await mountAdmin();
    fireEvent.change(screen.getByLabelText("Placement"), { target: { value: "HOME_SECTION" } });
    expect(within(screen.getByLabelText("Target")).getByText("Stories (BLOG_PREVIEW)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Placement"), { target: { value: "PAGE" } });
    expect(within(screen.getByLabelText("Target")).getByText("About")).toBeInTheDocument();
    expect(screen.getByText(/Choose a target/)).toBeInTheDocument();
  });

  it("shows a preview that reflects the settings and hides on a disabled device", async () => {
    await mountAdmin();
    const img = () => screen.getByTestId("decoration-preview").querySelector("img");
    expect(img()).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "mobile" }));
    expect(img()).toBeNull();
    expect(screen.getByText("Hidden on mobile")).toBeInTheDocument();
  });
});
