import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import AdminHeaderSettings from "../src/pages/admin/AdminHeaderSettings";
import { DEFAULT_HEADER_CMS_SETTINGS, normalizeHeaderSettings } from "../src/lib/headerCmsHelpers";
import { refreshSiteSettings } from "../src/hooks/useSiteSettings";

const mocks = vi.hoisted(() => ({
  fetchSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("../src/hooks/useSiteSettings", () => ({
  useSiteSettings: () => ({ general: { storeName: "Aadya" }, branding: {}, header: {}, shipping: { freeShippingThreshold: 2499 } }),
  refreshSiteSettings: vi.fn(() => Promise.resolve()),
  applyThemeVariables: vi.fn(),
}));

vi.mock("../src/context/CartContext", () => ({ useCart: () => ({ count: 0, setIsOpen: vi.fn() }) }));
vi.mock("../src/context/CustomerAuthContext", () => ({ useCustomerAuth: () => ({ user: null }) }));

vi.mock("../src/lib/api", () => ({
  fetchCategories: vi.fn(() => Promise.resolve({ data: [] })),
  fetchNavigation: vi.fn(() => Promise.resolve({ data: { items: [] } })),
  fetchPromos: vi.fn(() => Promise.resolve({ data: [] })),
  adminFetchSiteSettings: (...a) => mocks.fetchSettings(...a),
  adminUpdateSiteSettings: (...a) => mocks.updateSettings(...a),
  adminListCategories: vi.fn(() => Promise.resolve({ data: [] })),
  resolveMediaUrl: (url) => url || null,
  resolveProductImageUrl: (url) => url || null,
}));

// Settings as GET /admin/settings returns them: header is a LEGACY shape (no `utilityBar`,
// `utilityBarItems` use `title`/`link`) and many unrelated keys are present.
const buildServerSettings = () => ({
  general: { storeName: "Aadya", supportEmail: "" },
  appearance: { colors: { primary: "#B8674A" } },
  shipping: { freeShippingThreshold: 2499, standardShippingAmount: 150 },
  footer: { brandDescription: "Footer text" },
  payments: { razorpayEnabled: true },
  heroBanners: [{ id: "legacy", desktopImage: "" }],
  header: {
    showUtilityBar: true,
    utilityBarItems: [{ id: "ub-1", enabled: true, title: "Free Shipping", icon: "refresh", link: "/shipping" }],
    stickyHeader: false,
  },
});

function renderPage() {
  return render(
    <BrowserRouter>
      <AdminHeaderSettings />
    </BrowserRouter>
  );
}

async function openTab(label) {
  await waitFor(() => expect(screen.getByText("Header & Navigation CMS")).toBeInTheDocument());
  fireEvent.click(screen.getByText(label));
}

const save = () => fireEvent.click(screen.getByText("Save Changes"));
const lastHeaderPayload = () => mocks.updateSettings.mock.calls.at(-1)[0].header;

describe("Admin Header CMS save flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchSettings.mockImplementation(() => Promise.resolve({ data: buildServerSettings() }));
    // Echo what a real backend returns: the full merged settings with the new header applied.
    mocks.updateSettings.mockImplementation((body) => Promise.resolve({ data: { ...buildServerSettings(), ...body } }));
  });

  it("1 & 2. sends only { header } and never resends unrelated settings", async () => {
    renderPage();
    await openTab("Utility Bar");
    fireEvent.change(screen.getByPlaceholderText(/Free Shipping above/), { target: { value: "New center text" } });
    save();
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledTimes(1));
    const body = mocks.updateSettings.mock.calls[0][0];
    expect(Object.keys(body)).toEqual(["header"]);
    for (const key of ["appearance", "shipping", "footer", "payments", "general", "heroBanners"]) {
      expect(body).not.toHaveProperty(key);
    }
  });

  it("3. a legacy header saves with required fields populated (utility items get a `label`)", async () => {
    renderPage();
    await openTab("General Header");
    // dirty the form through another tab so Save is meaningful
    fireEvent.click(screen.getByText("Main Header"));
    fireEvent.change(screen.getByDisplayValue("Search products..."), { target: { value: "Find decor" } });
    save();
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalled());
    const items = lastHeaderPayload().utilityBar.items;
    expect(items[0].label).toBe("Free Shipping");
    expect(items[0].url).toBe("/shipping");
    expect(items[0].icon).toBe("returns");
  });

  it("4. Utility Bar settings save", async () => {
    renderPage();
    await openTab("Utility Bar");
    fireEvent.change(screen.getByDisplayValue("Free Shipping"), { target: { value: "Fast Delivery" } });
    save();
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalled());
    expect(lastHeaderPayload().utilityBar.items[0].label).toBe("Fast Delivery");
  });

  it("5. Announcement Ticker saves (and clamps an out-of-range speed)", async () => {
    renderPage();
    await openTab("Announcement Ticker");
    fireEvent.change(screen.getByPlaceholderText(/Crafted by Master/), { target: { value: "Ticker fallback" } });
    fireEvent.change(screen.getByDisplayValue("90"), { target: { value: "" } });
    save();
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalled());
    expect(lastHeaderPayload().promoTicker.fallbackMessage).toBe("Ticker fallback");
    const speed = lastHeaderPayload().promoTicker.speed;
    expect(speed).toBeGreaterThanOrEqual(10);
    expect(speed).toBeLessThanOrEqual(300);
  });

  it("6. Main Header saves", async () => {
    renderPage();
    await openTab("Main Header");
    fireEvent.change(screen.getByDisplayValue("Search products..."), { target: { value: "Search lamps" } });
    save();
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalled());
    expect(lastHeaderPayload().mainHeader.searchPlaceholder).toBe("Search lamps");
  });

  it("7. Primary Navigation saves, including a manual item", async () => {
    renderPage();
    await openTab("Primary Navigation");
    fireEvent.change(screen.getByDisplayValue(/AUTO \(Category/), { target: { value: "MANUAL" } });
    fireEvent.click(screen.getByText("+ Add Navigation Item"));
    save();
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalled());
    const nav = lastHeaderPayload().primaryNav;
    expect(nav.mode).toBe("MANUAL");
    expect(nav.items).toHaveLength(1);
    expect(nav.items[0].label).toBe("New Collection");
  });

  it("8. Mega Menu saves (columns and promo card)", async () => {
    renderPage();
    await openTab("Mega Menu");
    fireEvent.change(screen.getByDisplayValue("4"), { target: { value: "3" } });
    fireEvent.change(screen.getByPlaceholderText("Artisan Craftsmanship"), { target: { value: "Crafted edit" } });
    save();
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalled());
    expect(lastHeaderPayload().megaMenu.columns).toBe(3);
    expect(lastHeaderPayload().megaMenu.promoCard.title).toBe("Crafted edit");
  });

  it("9. Mobile settings save", async () => {
    renderPage();
    await openTab("Mobile Navigation");
    fireEvent.change(screen.getByDisplayValue("Menu"), { target: { value: "Browse" } });
    save();
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalled());
    expect(lastHeaderPayload().mobile.drawerTitle).toBe("Browse");
  });

  it("10. shows the backend validation message instead of a bare status", async () => {
    mocks.updateSettings.mockRejectedValueOnce(
      Object.assign(new Error("header.primaryNav.items.0.destination: Unsafe URL"), { status: 400 })
    );
    renderPage();
    await openTab("Main Header");
    fireEvent.change(screen.getByDisplayValue("Search products..."), { target: { value: "x" } });
    save();
    expect(await screen.findByText("header.primaryNav.items.0.destination: Unsafe URL")).toBeInTheDocument();
    expect(screen.queryByText(/Request failed with status/)).not.toBeInTheDocument();
  });

  it("11. a successful save clears the dirty state and refreshes site settings", async () => {
    renderPage();
    await openTab("Main Header");
    fireEvent.change(screen.getByDisplayValue("Search products..."), { target: { value: "Find decor" } });
    expect(screen.getByText(/unsaved changes/)).toBeInTheDocument();
    save();
    await waitFor(() => expect(screen.getByText(/successfully saved/)).toBeInTheDocument());
    expect(screen.queryByText(/unsaved changes/)).not.toBeInTheDocument();
    expect(screen.queryByText("Reset Unsaved")).not.toBeInTheDocument();
    expect(refreshSiteSettings).toHaveBeenCalled();
  });

  it("11b. a save with an unchanged form does not leave a false dirty state", async () => {
    renderPage();
    await openTab("General Header");
    save();
    await waitFor(() => expect(screen.getByText(/successfully saved/)).toBeInTheDocument());
    expect(screen.queryByText(/unsaved changes/)).not.toBeInTheDocument();
  });

  it("12. Reset Unsaved restores the loaded values", async () => {
    renderPage();
    await openTab("Main Header");
    const input = screen.getByDisplayValue("Search products...");
    fireEvent.change(input, { target: { value: "Changed" } });
    fireEvent.click(screen.getByText("Reset Unsaved"));
    expect(screen.getByDisplayValue("Search products...")).toBeInTheDocument();
    expect(screen.queryByText(/unsaved changes/)).not.toBeInTheDocument();
  });

  it("13. Defaults resets to Aadya defaults after confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    await openTab("Main Header");
    fireEvent.change(screen.getByDisplayValue("Search products..."), { target: { value: "Changed" } });
    fireEvent.click(screen.getByText("Defaults"));
    expect(screen.getByDisplayValue(DEFAULT_HEADER_CMS_SETTINGS.mainHeader.searchPlaceholder)).toBeInTheDocument();
  });

  it("14. sticky is read-only: no selectable sticky options, payload is always non-sticky", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("1. General Header Settings")).toBeInTheDocument());
    expect(screen.getByText("Header is configured as non-sticky for the storefront")).toBeInTheDocument();
    expect(screen.queryByText(/Always Sticky/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sticky after scrolling/)).not.toBeInTheDocument();
    // controls the storefront ignores are disabled, not silently editable
    expect(screen.getByLabelText("Header Background Mode")).toBeDisabled();
    expect(screen.getByLabelText(/Bottom divider line/)).toBeDisabled();

    fireEvent.click(screen.getByText("Main Header"));
    fireEvent.change(screen.getByDisplayValue("Search products..."), { target: { value: "x" } });
    save();
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalled());
    expect(lastHeaderPayload().stickyMode).toBe("none");
  });

  it("15. category strip tab: off by default, toggle and shape are editable and save", async () => {
    renderPage();
    await openTab("Category Scroller Strip");
    expect(screen.getByTestId("strip-off-notice")).toBeInTheDocument();
    expect(screen.getByLabelText("Enable Category Strip")).not.toBeChecked();
    fireEvent.click(screen.getByLabelText("Enable Category Strip"));
    fireEvent.change(screen.getByLabelText("Item Shape"), { target: { value: "RECTANGLE" } });
    save();
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalled());
    expect(lastHeaderPayload().circularCategories).toMatchObject({ enabled: true, shape: "RECTANGLE" });
    expect(Object.keys(mocks.updateSettings.mock.calls[0][0])).toEqual(["header"]);
  });

  it("16. normalization keeps stickyMode none and maps legacy utility items", () => {
    const n = normalizeHeaderSettings({ stickyMode: "always", stickyHeader: true, utilityBarItems: [{ id: "a", enabled: true, title: "T", link: "/x" }] });
    expect(n.stickyMode).toBe("none");
    expect(n.utilityBar.items[0]).toMatchObject({ label: "T", url: "/x" });
  });
});

describe("api error surfacing", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.resetModules();
  });

  async function failWith(body, status = 400) {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false, status, json: () => Promise.resolve(body) }));
    vi.doUnmock("../src/lib/api");
    const real = await vi.importActual("../src/lib/api");
    return real.api.put("/admin/settings", {}, { auth: "admin" }).catch((e) => e);
  }

  it("uses the string `error` returned by PUT /admin/settings", async () => {
    const err = await failWith({ error: "header.primaryNav.items.0.destination: Unsafe URL", details: [] });
    expect(err.message).toBe("header.primaryNav.items.0.destination: Unsafe URL");
    expect(err.status).toBe(400);
  });

  it("falls back to the first zod detail when no message is present", async () => {
    const err = await failWith({ details: [{ path: ["header", "utilityBar", "items", 0, "label"], message: "Required" }] });
    expect(err.message).toBe("header.utilityBar.items.0.label: Required");
  });

  it("still supports the { error: { message } } shape and the generic fallback", async () => {
    expect((await failWith({ error: { message: "Nope" } })).message).toBe("Nope");
    expect((await failWith(null, 400)).message).toBe("Request failed with status 400");
  });
});
