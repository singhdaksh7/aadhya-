import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminFilters from "../src/pages/admin/AdminFilters";

const saved = { current: { categories: [] } };
const update = vi.fn(async (payload) => ({ data: { catalogFilters: payload.catalogFilters } }));
vi.mock("../src/lib/api", () => ({
  fetchCategories: vi.fn(async () => ({ data: [
    { id: "books", name: "Books", slug: "books", parentId: null, sortOrder: 0 },
    { id: "b-slow", name: "Slow Living", slug: "books-slow-living", parentId: "books", sortOrder: 0 },
    { id: "li", name: "Lighting", slug: "lighting", parentId: null, sortOrder: 1 },
  ] })),
  adminFetchSiteSettings: vi.fn(async () => ({ data: { catalogFilters: saved.current } })),
  adminUpdateSiteSettings: (...args) => update(...args),
}));
vi.mock("../src/hooks/useSiteSettings", () => ({ refreshSiteSettings: vi.fn(async () => {}) }));

const renderPage = () => render(<MemoryRouter><AdminFilters /></MemoryRouter>);

beforeEach(() => { saved.current = { categories: [] }; update.mockClear(); });

describe("admin storefront filter configuration", () => {
  it("categories without a setup show the default-filters notice; presets create a config", async () => {
    renderPage();
    await screen.findByText(/uses the default filters/i);
    fireEvent.click(screen.getByRole("button", { name: /Preset: Books/ }));
    expect(screen.getAllByTestId("filter-group-row").length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByText(/uses the default filters/i)).toBeNull();
  });

  it("saves label, order, selection mode, open state and device flags exactly as edited", async () => {
    renderPage();
    await screen.findByText(/uses the default filters/i);
    fireEvent.click(screen.getByRole("button", { name: /Customise default set/ }));
    fireEvent.change(screen.getByLabelText("Label 1"), { target: { value: "Theme" } });
    fireEvent.change(screen.getByLabelText("Selection 3"), { target: { value: "MULTI" } });
    fireEvent.click(screen.getByLabelText("Move filter 2 up")); // collection <-> category swap
    fireEvent.change(screen.getByLabelText("New filter type"), { target: { value: "ATTRIBUTE" } });
    fireEvent.click(screen.getByRole("button", { name: /\+ Add filter/ }));
    fireEvent.change(screen.getByLabelText("Attribute key 5"), { target: { value: "Material" } });
    fireEvent.click(screen.getByRole("button", { name: /Save filter settings/ }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    const groups = update.mock.calls[0][0].catalogFilters.categories[0].groups;
    expect(update.mock.calls[0][0].catalogFilters.categories[0].categoryId).toBe("books");
    expect(groups.map((g) => g.type)).toEqual(["COLLECTION", "CATEGORY", "PRICE", "AVAILABILITY", "ATTRIBUTE"]);
    expect(groups.map((g) => g.order)).toEqual([0, 1, 2, 3, 4]);
    expect(groups[1].label).toBe("Theme");
    expect(groups[2].selection).toBe("MULTI");
    expect(groups[4]).toMatchObject({ attributeKey: "Material", showDesktop: true, showMobile: true });
    await screen.findByText(/Filter settings saved/);
  });

  it("reads an existing config back, can delete a filter, and reset returns the category to defaults", async () => {
    saved.current = { categories: [{ categoryId: "books", applyToSubcategories: true, groups: [{ id: "a", type: "BOOK_AUTHOR", label: "Writer", order: 0 }, { id: "p", type: "PRICE", order: 1 }] }] };
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId("filter-group-row")).toHaveLength(2));
    expect(screen.getByLabelText("Label 1").value).toBe("Writer");
    fireEvent.click(screen.getByLabelText("Delete filter 2"));
    expect(screen.getAllByTestId("filter-group-row")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Reset this category to default filters/ }));
    expect(await screen.findByText(/uses the default filters/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Save filter settings/ }));
    await waitFor(() => expect(update.mock.calls[0][0].catalogFilters.categories).toEqual([]));
  });

  it("surfaces a server validation error instead of failing silently", async () => {
    update.mockRejectedValueOnce(new Error("catalogFilters.categories.0.groups.0.type: Invalid enum value"));
    renderPage();
    await screen.findByText(/uses the default filters/i);
    fireEvent.click(screen.getByRole("button", { name: /Customise default set/ }));
    fireEvent.click(screen.getByRole("button", { name: /Save filter settings/ }));
    await screen.findByText(/Invalid enum value/);
  });
});
