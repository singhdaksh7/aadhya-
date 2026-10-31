import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdminShipping from "../src/pages/admin/AdminShipping";

const api = vi.hoisted(() => ({
  adminGetShippingBusiness: vi.fn(),
  adminSaveShippingBusiness: vi.fn(),
  adminGetIntegrationStatus: vi.fn(),
  adminTestIntegration: vi.fn(),
  adminListPackagePresets: vi.fn(),
  adminSavePackagePreset: vi.fn(),
  adminDeletePackagePreset: vi.fn(),
}));
vi.mock("../src/lib/api", () => api);
vi.mock("../src/context/AdminAuthContext", () => ({ useAdminAuth: () => ({ admin: { role: "SUPER_ADMIN" } }) }));

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.adminGetShippingBusiness.mockResolvedValue({ data: { provider: "SHIPROCKET", environment: "TEST", autoCreateShipment: false } });
  api.adminGetIntegrationStatus.mockResolvedValue({ data: { credentials: [] } });
  api.adminListPackagePresets.mockResolvedValue({ data: [] });
  api.adminSaveShippingBusiness.mockResolvedValue({ data: {} });
});

const open = () => render(<MemoryRouter><AdminShipping /></MemoryRouter>);

describe("Admin shipping: auto-ship single-item orders", () => {
  it("is off by default, explains itself and warns about wallet cost", async () => {
    open();
    const sw = await screen.findByRole("switch", { name: "Automatically ship single-item orders" });
    expect(sw).not.toBeChecked();
    expect(screen.getByText(/exactly one product \(quantity 1\) with complete package data/)).toBeInTheDocument();
    expect(screen.getByText(/lowest-cost courier/)).toBeInTheDocument();
    expect(screen.getByText("This uses your Shiprocket wallet for every qualifying order.")).toBeInTheDocument();
  });

  it("is saved with the rest of the shipping settings", async () => {
    open();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("switch", { name: "Automatically ship single-item orders" }));
    await user.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(api.adminSaveShippingBusiness).toHaveBeenCalled());
    expect(api.adminSaveShippingBusiness.mock.calls[0][0]).toMatchObject({ autoFulfilSingleItem: true, provider: "SHIPROCKET" });
  });

  it("sends false when left off and reflects a stored true", async () => {
    api.adminGetShippingBusiness.mockResolvedValue({ data: { provider: "SHIPROCKET", autoFulfilSingleItem: true } });
    open();
    expect(await screen.findByRole("switch", { name: "Automatically ship single-item orders" })).toBeChecked();
  });
});
