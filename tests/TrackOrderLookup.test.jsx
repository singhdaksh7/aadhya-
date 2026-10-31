import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import TrackOrder from "../src/pages/TrackOrder";

const api = vi.hoisted(() => ({
  ApiRequestError: class ApiRequestError extends Error { constructor(m, s) { super(m); this.status = s; } },
  trackOrder: vi.fn(),
}));
vi.mock("../src/lib/api", () => api);

const TRACKING = {
  courier: "Delhivery", awb: "AWB555", status: "SHIPPED", statusLabel: "Shipped", estimatedDelivery: "2026-11-04T00:00:00Z", deliveredAt: null,
  events: [{ status: "CONFIRMED", label: "Order placed", at: "2026-10-28T08:00:00Z" }, { status: "SHIPPED", label: "Shipped", at: "2026-10-30T08:00:00Z" }],
};
const ORDER = { orderNumber: "TUS-1", status: "SHIPPED", createdAt: "2026-10-28T00:00:00Z", items: [], totalAmount: 100, tracking: TRACKING };
const at = (url) => render(<MemoryRouter initialEntries={[url]}><TrackOrder /></MemoryRouter>);

beforeEach(() => { api.trackOrder.mockReset(); });

describe("TrackOrder deep links", () => {
  it("looks the order up automatically with order + token and shows our own timeline", async () => {
    api.trackOrder.mockResolvedValue({ data: ORDER });
    at("/track-order?order=TUS-1&t=abc123");
    expect(await screen.findByTestId("tracking-timeline")).toBeInTheDocument();
    expect(api.trackOrder).toHaveBeenCalledTimes(1);
    expect(api.trackOrder).toHaveBeenCalledWith({ orderNumber: "TUS-1", token: "abc123" });
    expect(screen.getByLabelText("Order Number")).toHaveValue("TUS-1");
  });

  it("only prefills the order number when there is no token and does not look up", async () => {
    at("/track-order?order=TUS-9");
    expect(screen.getByLabelText("Order Number")).toHaveValue("TUS-9");
    await new Promise((r) => setTimeout(r, 30));
    expect(api.trackOrder).not.toHaveBeenCalled();
  });

  it("manual form still sends order number + email", async () => {
    api.trackOrder.mockResolvedValue({ data: ORDER });
    at("/track-order");
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Order Number"), "TUS-1");
    await user.type(screen.getByLabelText("Checkout Email"), "a@b.co");
    await user.click(screen.getByRole("button", { name: /Trace Order Status/ }));
    await waitFor(() => expect(api.trackOrder).toHaveBeenCalledWith({ orderNumber: "TUS-1", email: "a@b.co" }));
    expect(await screen.findByTestId("tracking-block")).toBeInTheDocument();
  });

  it("shows the generic not-found message for a bad token", async () => {
    api.trackOrder.mockRejectedValue(new api.ApiRequestError("nope", 404));
    at("/track-order?order=TUS-1&t=bad");
    expect(await screen.findByText(/No matching order was found/)).toBeInTheDocument();
  });

  it("never renders an external tracking link, even if the payload still carries trackingUrl", async () => {
    api.trackOrder.mockResolvedValue({ data: { ...ORDER, tracking: { ...TRACKING, trackingUrl: "https://shiprocket.co/tracking/AWB555" } } });
    at("/track-order?order=TUS-1&t=abc123");
    await screen.findByTestId("tracking-block");
    expect(screen.queryByText(/Track shipment/i)).not.toBeInTheDocument();
    expect(document.querySelector("a[href^='http']")).toBeNull();
    expect(document.body.innerHTML).not.toMatch(/shiprocket/i);
  });
});
