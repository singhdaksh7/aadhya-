import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import InvoiceTaxReadiness, { getTaxIssues } from "../src/components/admin/InvoiceTaxReadiness";

const apply = vi.fn();
vi.mock("../src/lib/api", () => ({ adminApplyProductGstDefaults: (...a) => apply(...a) }));

const ok = { gstEnabled: true, gstin: "29ABCDE1234F1Z5", state: "Karnataka", defaultTaxRate: "18" };
const wrap = (props) => render(<MemoryRouter><InvoiceTaxReadiness {...props} /></MemoryRouter>);

beforeEach(() => apply.mockReset());

describe("getTaxIssues", () => {
  it("is empty when fully configured", () => {
    expect(getTaxIssues(ok, { missingRate: 0, missingHsn: 0 })).toEqual([]);
  });
  it("flags every missing piece", () => {
    const codes = getTaxIssues({ gstEnabled: false, gstin: "", state: "", defaultTaxRate: "0" }, { missingRate: 3, missingHsn: 2 }).map((i) => i.code);
    expect(codes).toEqual(["GST_DISABLED", "GSTIN_MISSING", "STATE_MISSING", "DEFAULT_RATE_MISSING", "PRODUCTS_MISSING_RATE", "PRODUCTS_MISSING_HSN"]);
  });
  it("flags an invalid GSTIN", () => {
    expect(getTaxIssues({ ...ok, gstin: "BAD" }, null).map((i) => i.code)).toContain("GSTIN_INVALID");
  });
});

describe("InvoiceTaxReadiness", () => {
  it("shows warnings and a link to products", () => {
    wrap({ settings: { gstEnabled: false, gstin: "", state: "", defaultTaxRate: "0" }, counts: { missingRate: 4, missingHsn: 4 } });
    expect(screen.getByText(/GST is switched off/)).toBeInTheDocument();
    expect(screen.getByText(/GSTIN is missing/)).toBeInTheDocument();
    expect(screen.getByText(/Company state is missing/)).toBeInTheDocument();
    expect(screen.getByText(/4 active product\(s\) have no GST rate/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Review products" })[0]).toHaveAttribute("href", "/admin/products");
  });

  it("shows the all-clear when configured", () => {
    wrap({ settings: ok, counts: { missingRate: 0, missingHsn: 0 } });
    expect(screen.getByText(/fully configured/)).toBeInTheDocument();
    expect(screen.queryByText(/Apply a default/)).not.toBeInTheDocument();
  });

  it("requires a preview and explicit confirmation before applying defaults", async () => {
    apply.mockResolvedValueOnce({ data: { dryRun: true, wouldUpdateGstRate: 4, wouldUpdateHsn: 0 } });
    apply.mockResolvedValueOnce({ data: { dryRun: false, gstRateUpdated: 4, hsnUpdated: 0 } });
    const onApplied = vi.fn();
    wrap({ settings: ok, counts: { missingRate: 4, missingHsn: 0 }, onApplied });
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Preview changes" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Default GST rate for products"), "12");
    await user.click(screen.getByRole("button", { name: "Preview changes" }));
    expect(apply).toHaveBeenLastCalledWith({ confirm: false, gstRate: 12 });
    expect(await screen.findByText(/set the GST rate on 4 product/)).toBeInTheDocument();
    expect(apply).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Confirm and apply" }));
    await waitFor(() => expect(apply).toHaveBeenLastCalledWith({ confirm: true, gstRate: 12 }));
    expect(await screen.findByText(/Updated 4 product/)).toBeInTheDocument();
    expect(onApplied).toHaveBeenCalled();
  });
});
