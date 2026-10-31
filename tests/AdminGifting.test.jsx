import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, within, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdminGifting from "../src/pages/admin/AdminGifting";
import { adminNavGroups, pageTitleFromPath } from "../src/components/admin/navConfig";

const api = vi.hoisted(() => ({
  adminFetchGiftingPage: vi.fn(),
  adminCreateGiftingSection: vi.fn(),
  adminRestoreGiftingDefaults: vi.fn(),
  adminPublishPage: vi.fn(),
  adminUpdatePage: vi.fn(),
  adminUpdatePageSection: vi.fn(),
  adminDeletePageSection: vi.fn(),
  adminDuplicatePageSection: vi.fn(),
  adminReorderPageSections: vi.fn(),
  adminReorderGiftingSections: vi.fn(),
  adminListCollections: vi.fn(),
  adminListCategories: vi.fn(),
  adminListPages: vi.fn(),
  adminListProducts: vi.fn(),
}));
vi.mock("../src/lib/api", () => api);
vi.mock("../src/components/admin/ImagePickerInput", () => ({
  default: ({ value, onChange }) => <input aria-label="image picker" value={value || ""} onChange={(e) => onChange(e.target.value)} />,
}));

const sections = () => [
  { id: "s1", type: "GIFTING_HERO", name: "Gifting Hero", isEnabled: true, sortOrder: 1, settings: { title: "Hero" } },
  { id: "s2", type: "GIFTS_BY_OCCASION", name: "Gifts by Occasion", isEnabled: false, sortOrder: 2, settings: { heading: "Occ", eyebrow: "Celebrate Milestones", items: [] } },
  { id: "s3", type: "GIFTING_FAQ", name: "Gifting FAQ", isEnabled: true, sortOrder: 3, settings: { heading: "FAQ", items: [] } },
];
const pageFixture = () => ({ id: "p1", slug: "gifting", name: "Artisan Gifting", status: "PUBLISHED", seoTitle: "Old title", seoDescription: "Old desc", featuredImage: "", sections: sections() });

function renderScreen() {
  return render(<MemoryRouter><AdminGifting /></MemoryRouter>);
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.adminFetchGiftingPage.mockResolvedValue(pageFixture());
  api.adminCreateGiftingSection.mockResolvedValue({});
  api.adminRestoreGiftingDefaults.mockResolvedValue({ restoredTypes: ["GIFTS_BY_CRAFT"] });
  api.adminPublishPage.mockResolvedValue({});
  api.adminUpdatePage.mockResolvedValue({});
  api.adminUpdatePageSection.mockResolvedValue({});
  api.adminDeletePageSection.mockResolvedValue({});
  api.adminDuplicatePageSection.mockResolvedValue({});
  api.adminReorderPageSections.mockResolvedValue({});
  api.adminReorderGiftingSections.mockResolvedValue({});
  api.adminListCollections.mockResolvedValue([]);
  api.adminListCategories.mockResolvedValue([]);
  api.adminListPages.mockResolvedValue({ items: [] });
  api.adminListProducts.mockResolvedValue({ items: [] });
  vi.spyOn(window, "alert").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Admin Gifting screen", () => {
  it("is reachable from the Marketing nav group and has a breadcrumb title", () => {
    const marketing = adminNavGroups.find((g) => g.title === "Marketing");
    expect(marketing.items.some((i) => i.to === "/admin/gifting" && i.label === "Gifting")).toBe(true);
    expect(pageTitleFromPath("/admin/gifting")).toBe("Gifting");
  });

  it("lists every section including disabled ones, with a View page link", async () => {
    renderScreen();
    expect(await screen.findByRole("heading", { name: "Gifting" })).toBeInTheDocument();
    expect(screen.getAllByTestId(/^section-row-/)).toHaveLength(3);
    const disabledRow = screen.getByTestId("section-row-1");
    expect(within(disabledRow).getAllByText("Disabled").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "View page" })).toHaveAttribute("href", "/gifting");
  });

  it("offers only gifting section types when adding, and creates through the gifting endpoint", async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByTestId("section-row-0");
    await user.click(screen.getByRole("button", { name: "+ Add Section" }));
    const select = screen.getByRole("combobox");
    const values = [...select.querySelectorAll("option")].map((o) => o.value);
    expect(values).toHaveLength(10);
    expect(values).toContain("GIFTING_FAQ");
    expect(values).not.toContain("HERO");
    await user.selectOptions(select, "GIFTS_BY_CRAFT");
    await user.click(screen.getByRole("button", { name: "Add Section" }));
    await waitFor(() => expect(api.adminCreateGiftingSection).toHaveBeenCalledWith(expect.objectContaining({ type: "GIFTS_BY_CRAFT", isEnabled: true })));
  });

  it("toggles, reorders, duplicates and deletes sections", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderScreen();
    await screen.findByTestId("section-row-0");

    await user.click(within(screen.getByTestId("section-row-1")).getByRole("button", { name: "Disabled" }));
    await waitFor(() => expect(api.adminUpdatePageSection).toHaveBeenCalledWith("s2", { isEnabled: true }));

    await user.click(within(screen.getByTestId("section-row-2")).getByTitle("Move Up"));
    await waitFor(() => { expect(api.adminReorderGiftingSections).toHaveBeenCalledWith(["s1", "s3", "s2"]); expect(api.adminReorderPageSections).not.toHaveBeenCalled(); });

    await user.click(within(screen.getByTestId("section-row-0")).getByRole("button", { name: "Duplicate" }));
    await waitFor(() => expect(api.adminDuplicatePageSection).toHaveBeenCalledWith("s1"));

    await user.click(within(screen.getByTestId("section-row-0")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(api.adminDeletePageSection).toHaveBeenCalledWith("s1"));
  });

  it("does not delete when the confirm dialog is cancelled", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderScreen();
    await screen.findByTestId("section-row-0");
    await user.click(within(screen.getByTestId("section-row-0")).getByRole("button", { name: "Delete" }));
    expect(api.adminDeletePageSection).not.toHaveBeenCalled();
  });

  it("edits a section eyebrow and heading and saves the section settings", async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByTestId("section-row-1");
    await user.click(within(screen.getByTestId("section-row-1")).getByRole("button", { name: "Edit" }));
    const eyebrow = screen.getByLabelText(/^Eyebrow \(small label/);
    expect(eyebrow).toHaveValue("Celebrate Milestones");
    await user.clear(eyebrow);
    await user.type(eyebrow, "Gift moments");
    const heading = screen.getByLabelText("Section Heading");
    await user.clear(heading);
    await user.type(heading, "Occasions");
    await user.click(screen.getByRole("button", { name: "Save Section Changes" }));
    await waitFor(() => expect(api.adminUpdatePageSection).toHaveBeenCalledWith("s2", expect.objectContaining({
      settings: expect.objectContaining({ eyebrow: "Gift moments", heading: "Occasions" }),
    })));
  });

  it("saves page name, SEO title, SEO description and share image via the page endpoint", async () => {
    const user = userEvent.setup({ delay: null });
    renderScreen();
    const form = await screen.findByTestId("gifting-page-settings");
    const title = within(form).getByLabelText(/SEO title/);
    await user.clear(title);
    await user.type(title, "New SEO title");
    const desc = within(form).getByLabelText("SEO description");
    await user.clear(desc);
    await user.type(desc, "New description");
    await user.type(within(form).getByLabelText("image picker"), "/uploads/og.png");
    await user.click(within(form).getByRole("button", { name: "Save page settings" }));
    await waitFor(() => expect(api.adminUpdatePage).toHaveBeenCalledWith("p1", {
      name: "Artisan Gifting",
      seoTitle: "New SEO title",
      seoDescription: "New description",
      featuredImage: "/uploads/og.png",
    }), { timeout: 5000 });
    expect(await within(form).findByRole("status")).toHaveTextContent("saved");
  });

  it("publishes the gifting page by id", async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByTestId("section-row-0");
    await user.click(screen.getByRole("button", { name: "Publish Gifting Page" }));
    await waitFor(() => expect(api.adminPublishPage).toHaveBeenCalledWith("p1", "PUBLISHED"));
  });

  it("restores default layout only after confirmation", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderScreen();
    await screen.findByTestId("section-row-0");
    const btn = screen.getByRole("button", { name: "Restore default gifting layout" });
    await user.click(btn);
    expect(api.adminRestoreGiftingDefaults).not.toHaveBeenCalled();
    await user.click(btn);
    await waitFor(() => expect(api.adminRestoreGiftingDefaults).toHaveBeenCalledTimes(1));
    expect(confirmSpy.mock.calls[0][0]).toMatch(/NOT changed or removed/);
    await waitFor(() => expect(api.adminFetchGiftingPage).toHaveBeenCalledTimes(2));
  });

  it("still works when the page has no sections yet", async () => {
    api.adminFetchGiftingPage.mockResolvedValue({ ...pageFixture(), sections: [] });
    renderScreen();
    expect(await screen.findByText(/No sections defined/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore default gifting layout" })).toBeInTheDocument();
  });
});
