import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({
  adminGetAdminNotifications: vi.fn(),
  adminSaveAdminNotificationEvents: vi.fn(),
  adminAddAdminNotificationRecipient: vi.fn(),
  adminSetAdminNotificationRecipientEnabled: vi.fn(),
  adminRemoveAdminNotificationRecipient: vi.fn(),
}));
vi.mock("../src/lib/api", () => api);

const AdminEmailNotifications = (await import("../src/pages/admin/AdminEmailNotifications")).default;

const state = (over = {}) => ({
  data: {
    smtpConfigured: true,
    recipients: [{ id: "r1", email: "owner@shop.test", enabled: true }],
    events: [
      { key: "NEW_ORDER", label: "New order", help: "Every new order.", enabled: true },
      { key: "ORDER_SHIPPED", label: "Order shipped", help: "Shipped.", enabled: false },
    ],
    ...over,
  },
});
const view = () => render(<MemoryRouter><AdminEmailNotifications /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  api.adminGetAdminNotifications.mockResolvedValue(state());
});

describe("Admin → Admin Email Alerts", () => {
  it("shows recipients and the alert toggles with their current state", async () => {
    view();
    expect(await screen.findByText("owner@shop.test")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "New order" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Order shipped" })).not.toBeChecked();
  });

  it("validates the address before calling the API, then adds a valid recipient", async () => {
    const user = userEvent.setup();
    api.adminAddAdminNotificationRecipient.mockResolvedValue(state({ recipients: [{ id: "r1", email: "owner@shop.test", enabled: true }, { id: "r2", email: "orders@shop.test", enabled: true }] }));
    view();
    await screen.findByText("owner@shop.test");
    await user.type(screen.getByLabelText("Email address"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Add recipient" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("valid email");
    expect(api.adminAddAdminNotificationRecipient).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Email address"));
    await user.type(screen.getByLabelText("Email address"), "orders@shop.test");
    await user.click(screen.getByRole("button", { name: "Add recipient" }));
    await waitFor(() => expect(api.adminAddAdminNotificationRecipient).toHaveBeenCalledWith("orders@shop.test"));
    expect(await screen.findByText("orders@shop.test")).toBeInTheDocument();
  });

  it("saves a toggle and pauses a recipient", async () => {
    const user = userEvent.setup();
    api.adminSaveAdminNotificationEvents.mockResolvedValue(state());
    api.adminSetAdminNotificationRecipientEnabled.mockResolvedValue(state());
    view();
    await user.click(await screen.findByRole("switch", { name: "Order shipped" }));
    await waitFor(() => expect(api.adminSaveAdminNotificationEvents).toHaveBeenCalledWith({ ORDER_SHIPPED: true }));
    await user.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(api.adminSetAdminNotificationRecipientEnabled).toHaveBeenCalledWith("r1", false));
  });

  it("warns when email sending is not configured", async () => {
    api.adminGetAdminNotifications.mockResolvedValue(state({ smtpConfigured: false, recipients: [] }));
    view();
    expect(await screen.findByText(/Email sending is not set up yet/)).toBeInTheDocument();
    expect(screen.getByText(/No recipients yet/)).toBeInTheDocument();
  });
});
