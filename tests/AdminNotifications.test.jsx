import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdminNotifications from "../src/pages/admin/AdminNotifications";

const adminListNotifications = vi.fn();
const adminMarkNotificationRead = vi.fn();
const adminMarkAllNotificationsRead = vi.fn();

vi.mock("../src/lib/api", () => ({
  adminListNotifications: (...a) => adminListNotifications(...a),
  adminMarkNotificationRead: (...a) => adminMarkNotificationRead(...a),
  adminMarkAllNotificationsRead: (...a) => adminMarkAllNotificationsRead(...a),
}));

const SAMPLE = [
  {
    id: "n1",
    type: "LOW_STOCK",
    title: "Low stock: Ceramic Vase",
    message: "Only 2 left in stock.",
    severity: "WARNING",
    entityType: "Product",
    entityId: "p1",
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "n2",
    type: "PAYMENT_FAILED",
    title: "Payment failed for order #1002",
    message: "Card declined.",
    severity: "CRITICAL",
    entityType: "Order",
    entityId: "o2",
    isRead: true,
    createdAt: new Date().toISOString(),
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminNotifications />
    </MemoryRouter>
  );
}

describe("AdminNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminListNotifications.mockResolvedValue({ data: SAMPLE, meta: { unreadCount: 1 } });
    adminMarkNotificationRead.mockResolvedValue({ data: { ...SAMPLE[0], isRead: true } });
    adminMarkAllNotificationsRead.mockResolvedValue({ data: { count: 1 } });
  });

  it("renders the notification list", async () => {
    renderPage();
    await screen.findByText("Low stock: Ceramic Vase");
    expect(screen.getByText("Payment failed for order #1002")).toBeInTheDocument();
    expect(adminListNotifications).toHaveBeenCalled();
  });

  it("filters by unread only on the client", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Low stock: Ceramic Vase");

    const checkbox = screen.getByLabelText(/unread only/i);
    await user.click(checkbox);

    expect(screen.getByText("Low stock: Ceramic Vase")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Payment failed for order #1002")).not.toBeInTheDocument());
  });

  it("filters by type", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Low stock: Ceramic Vase");

    const selects = screen.getAllByRole("combobox");
    const typeSelect = selects[0];
    await user.selectOptions(typeSelect, "LOW_STOCK");

    expect(screen.getByText("Low stock: Ceramic Vase")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Payment failed for order #1002")).not.toBeInTheDocument());
  });

  it("calls the mark-read endpoint for a single row", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Low stock: Ceramic Vase");

    const markReadButtons = screen.getAllByText("Mark read");
    await user.click(markReadButtons[0]);

    await waitFor(() => expect(adminMarkNotificationRead).toHaveBeenCalledWith("n1"));
  });

  it("calls the mark-all-read endpoint and updates the unread badge", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Low stock: Ceramic Vase");

    const markAllButton = screen.getByRole("button", { name: /mark all read/i });
    await user.click(markAllButton);

    await waitFor(() => expect(adminMarkAllNotificationsRead).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Mark read")).not.toBeInTheDocument());
  });
});
