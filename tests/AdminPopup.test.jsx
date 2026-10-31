import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminPopup, { parseRoutes, isoToLocalInput, localInputToIso, popupFormError, EMPTY_POPUP } from "../src/pages/admin/AdminPopup";
import { adminGetPromoPopup, adminUpdatePromoPopup } from "../src/lib/api";

vi.mock("../src/lib/api", () => ({
  adminGetPromoPopup: vi.fn(),
  adminUpdatePromoPopup: vi.fn(),
}));
vi.mock("../src/components/admin/ImagePickerInput", () => ({
  default: ({ value, onChange }) => <input aria-label="image" value={value || ""} onChange={(e) => onChange(e.target.value)} />,
}));

describe("AdminPopup helpers", () => {
  it("parseRoutes trims, de-duplicates and forces a leading slash", () => {
    expect(parseRoutes(" /gifting \n shop,/gifting\n\n")).toEqual(["/gifting", "/shop"]);
  });
  it("round-trips datetime-local values", () => {
    const iso = "2030-01-02T03:04:00.000Z";
    expect(localInputToIso(isoToLocalInput(iso))).toBe(iso);
    expect(localInputToIso("")).toBe("");
    expect(isoToLocalInput("garbage")).toBe("");
  });
  it("popupFormError mirrors the server rules", () => {
    expect(popupFormError({ ...EMPTY_POPUP, enabled: true, title: " " })).toMatch(/Title/);
    expect(popupFormError({ ...EMPTY_POPUP, ctaLabel: "Go" })).toMatch(/CTA URL/);
    expect(popupFormError({ ...EMPTY_POPUP, targeting: "SELECTED" })).toMatch(/at least one page/);
    expect(popupFormError({ ...EMPTY_POPUP, startDate: "2030-02-01T00:00:00Z", endDate: "2030-01-01T00:00:00Z" })).toMatch(/End date/);
    expect(popupFormError({ ...EMPTY_POPUP, enabled: true, title: "Hi" })).toBe("");
  });
});

describe("AdminPopup page", () => {
  beforeEach(() => {
    vi.mocked(adminGetPromoPopup).mockReset();
    vi.mocked(adminUpdatePromoPopup).mockReset();
  });

  it("loads, edits and saves the popup", async () => {
    vi.mocked(adminGetPromoPopup).mockResolvedValue({ data: { ...EMPTY_POPUP, title: "Old" } });
    vi.mocked(adminUpdatePromoPopup).mockImplementation((body) => Promise.resolve({ data: body }));
    const user = userEvent.setup();
    render(<AdminPopup />);
    const title = await screen.findByLabelText("Title");
    expect(title).toHaveValue("Old");
    await user.clear(title);
    await user.type(title, "Gifting season");
    await user.click(screen.getByLabelText("Popup enabled"));
    await user.selectOptions(screen.getByLabelText("Targeting"), "SELECTED");
    await user.type(screen.getByLabelText(/Pages \(one path per line/), "/gifting");
    await user.selectOptions(screen.getByLabelText("Show again"), "EVERY_X_DAYS");
    await user.click(screen.getByRole("button", { name: "Save popup" }));
    await waitFor(() => expect(adminUpdatePromoPopup).toHaveBeenCalled());
    expect(adminUpdatePromoPopup.mock.calls[0][0]).toMatchObject({ enabled: true, title: "Gifting season", targeting: "SELECTED", routes: ["/gifting"], frequency: "EVERY_X_DAYS" });
    expect(await screen.findByRole("status")).toHaveTextContent("Popup saved");
  });

  it("blocks saving an invalid popup without calling the API", async () => {
    vi.mocked(adminGetPromoPopup).mockResolvedValue({ data: { ...EMPTY_POPUP } });
    const user = userEvent.setup();
    render(<AdminPopup />);
    await user.click(await screen.findByLabelText("Popup enabled"));
    await user.click(screen.getByRole("button", { name: "Save popup" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Title is required/);
    expect(adminUpdatePromoPopup).not.toHaveBeenCalled();
  });
});
