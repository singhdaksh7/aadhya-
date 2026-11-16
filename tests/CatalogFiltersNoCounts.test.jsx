import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CatalogFilters from "../src/components/shop/CatalogFilters";

const group = (over) => ({ defaultOpen: true, showDesktop: true, showMobile: true, enabled: true, ...over });
const groups = [
  group({ id: "cat", type: "CATEGORY", label: "Category" }),
  group({ id: "mat", type: "ATTRIBUTE", label: "Material", selection: "MULTI" }),
  group({ id: "col", type: "ATTRIBUTE", label: "Color", selection: "SINGLE" }),
];
const props = (device, over = {}) => ({
  groups, device,
  categoryOptions: [{ id: "c1", slug: "cushions", name: "Cushion Covers", depth: 0, count: 12 }],
  showAllCategories: true, selectedCategory: "all", onSelectCategory: vi.fn(),
  facetOptions: {
    mat: [{ value: "Cotton", label: "Cotton", count: 5 }],
    col: [{ value: "Blue", label: "Blue", count: 8 }],
  },
  facetSelections: {}, onToggleFacet: vi.fn(), onReset: vi.fn(), maxPrice: 1000, priceMax: 1000, ...over,
});

describe.each(["desktop", "mobile"])("CatalogFilters (%s) renders no item counts", (device) => {
  it("category, multi-select and single-select options show labels only", () => {
    render(<CatalogFilters {...props(device)} />);
    expect(screen.getByRole("button", { name: "Cushion Covers" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Cotton" }).closest("label").textContent.trim()).toBe("Cotton");
    expect(screen.getByRole("button", { name: "Blue" })).toBeInTheDocument();
    const text = screen.getByTestId("catalog-filters").textContent;
    ["12", "5", "8"].forEach((n) => expect(text).not.toContain(n));
  });

  it("options still call their handlers", () => {
    const p = props(device);
    render(<CatalogFilters {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Cushion Covers" }));
    expect(p.onSelectCategory).toHaveBeenCalledWith("cushions");
    fireEvent.click(screen.getByRole("checkbox", { name: "Cotton" }));
    expect(p.onToggleFacet).toHaveBeenCalledWith(expect.objectContaining({ id: "mat" }), "Cotton");
    fireEvent.click(screen.getByRole("button", { name: "Blue" }));
    expect(p.onToggleFacet).toHaveBeenCalledWith(expect.objectContaining({ id: "col" }), "Blue");
    fireEvent.click(screen.getByRole("button", { name: "Reset All" }));
    expect(p.onReset).toHaveBeenCalled();
  });
});
