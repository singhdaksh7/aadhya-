import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import ProductSpecifications from "../src/components/shop/ProductSpecifications";
import SpecificationsEditor, { moveRow } from "../src/components/admin/SpecificationsEditor";
import { normalizeSpecifications, productSpecRows } from "../src/lib/specifications";

const rows = [
  { label: "Materials", value: "Kilim (flat-woven textile)" },
  { label: "Dimensions", value: "28 cm (H) × 23 cm (W) / approx. 11 in × 9 in" },
  { label: "Weight", value: "N/A" },
];

describe("ProductSpecifications (product page)", () => {
  it("renders rows in the saved order as a label/value list", () => {
    render(<ProductSpecifications product={{ specifications: rows }} />);
    expect(screen.getByRole("heading", { name: "Product Details" })).toBeInTheDocument();
    const items = screen.getAllByTestId("spec-item");
    expect(items.map((i) => i.querySelector("dt").textContent)).toEqual(["Materials", "Dimensions", "Weight"]);
    expect(items[1].querySelector("dd").textContent).toContain("28 cm (H) × 23 cm (W)");
  });

  it("wraps very long labels and values without overflow and stacks on mobile", () => {
    const long = "x".repeat(300);
    render(<ProductSpecifications product={{ specifications: [{ label: long, value: long }] }} />);
    const item = screen.getByTestId("spec-item");
    expect(item.className).toContain("grid-cols-1");
    expect(item.className).toContain("sm:grid-cols-");
    expect(item.querySelector("dt").className).toContain("break-words");
    expect(item.querySelector("dd").className).toContain("break-words");
    expect(item.querySelector("dd").className).toContain("min-w-0");
  });

  it("is hidden when there are no specifications", () => {
    const { container } = render(<ProductSpecifications product={{ specifications: [] }} />);
    expect(container).toBeEmptyDOMElement();
    const none = render(<ProductSpecifications product={{ name: "Old product" }} />);
    expect(none.container).toBeEmptyDOMElement();
  });

  it("falls back to filled legacy fields only, never placeholders", () => {
    expect(productSpecRows({ materials: "Brass", dimensions: "", weight: null })).toEqual([{ label: "Materials", value: "Brass" }]);
    const { container } = render(<ProductSpecifications product={{ materials: "", dimensions: "" }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("reads the legacy object shape and drops blank rows", () => {
    expect(normalizeSpecifications({ Fabric: "Cotton", Empty: " " })).toEqual([{ label: "Fabric", value: "Cotton" }]);
    expect(normalizeSpecifications([{ label: "A", value: "" }, null, { label: " B ", value: " 2 " }])).toEqual([{ label: "B", value: "2" }]);
  });
});

function Harness({ initial = [] }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SpecificationsEditor rows={value} onChange={setValue} />
      <pre data-testid="out">{JSON.stringify(value)}</pre>
    </>
  );
}
const out = () => JSON.parse(screen.getByTestId("out").textContent);

describe("SpecificationsEditor (admin)", () => {
  it("adds a row, edits label and value, and accepts any label", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add specification" }));
    fireEvent.change(screen.getByLabelText("Specification label 1"), { target: { value: "Warranty" } });
    fireEvent.change(screen.getByLabelText("Specification value 1"), { target: { value: "1 year" } });
    expect(out()).toEqual([{ label: "Warranty", value: "1 year" }]);
  });

  it("deletes a row", () => {
    render(<Harness initial={rows} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete specification 2" }));
    expect(out().map((r) => r.label)).toEqual(["Materials", "Weight"]);
  });

  it("reorders rows and preserves the order", () => {
    render(<Harness initial={rows} />);
    fireEvent.click(screen.getByRole("button", { name: "Move specification 3 up" }));
    expect(out().map((r) => r.label)).toEqual(["Materials", "Weight", "Dimensions"]);
    fireEvent.click(screen.getByRole("button", { name: "Move specification 1 down" }));
    expect(out().map((r) => r.label)).toEqual(["Weight", "Materials", "Dimensions"]);
    expect(screen.getByRole("button", { name: "Move specification 1 up" })).toBeDisabled();
    expect(within(screen.getByTestId("spec-editor")).getAllByTestId("spec-row")).toHaveLength(3);
  });

  it("moveRow ignores out-of-range moves", () => {
    expect(moveRow(rows, 0, -1)).toBe(rows);
    expect(moveRow(rows, 2, 3)).toBe(rows);
  });
});
