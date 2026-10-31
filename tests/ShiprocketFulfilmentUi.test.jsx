import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ShipmentPackagePanel from "../src/components/admin/ShipmentPackagePanel";
import ShiprocketTabs from "../src/components/admin/integrations/ShiprocketTabs";
import TrackingBlock from "../src/components/TrackingBlock";
import TrackOrder from "../src/pages/TrackOrder";

const api = vi.hoisted(() => ({
  ApiRequestError: class ApiRequestError extends Error { constructor(m, s) { super(m); this.status = s; } },
  adminGetOrderPackage: vi.fn(),
  adminConfirmOrderPackage: vi.fn(),
  adminCheckServiceability: vi.fn(),
  adminCreateShipment: vi.fn(),
  adminGenerateShipmentAwb: vi.fn(),
  adminScheduleShipmentPickup: vi.fn(),
  adminGetShipmentLabel: vi.fn(),
  adminRefreshTracking: vi.fn(),
  adminCancelShipment: vi.fn(),
  adminShiprocketOverview: vi.fn(),
  adminShiprocketPickupLocations: vi.fn(),
  adminTestIntegration: vi.fn(),
  adminShiprocketSummary: vi.fn(),
  adminShiprocketWebhookEvents: vi.fn(),
  adminShiprocketGenerateToken: vi.fn(),
  adminShiprocketRemoveToken: vi.fn(),
  adminShiprocketVerifySetup: vi.fn(),
  trackOrder: vi.fn(),
}));
vi.mock("../src/lib/api", () => api);

const STEPS = ["NOT_CREATED", "PACKAGE_CONFIRMED", "SHIPMENT_CREATED", "AWB_ASSIGNED", "PICKUP_SCHEDULED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];
const NONE = { confirmPackage: false, checkServiceability: false, createShipment: false, assignAwb: false, schedulePickup: false, cancelShipment: false, downloadLabel: false, refreshTracking: false };
const pkgCtx = {
  provider: "SHIPROCKET", volumetricDivisor: 5000, presets: [],
  items: [{ name: "Brass Lamp", quantity: 1, weightKg: 0.5, lengthCm: 10, widthCm: 10, heightCm: 10 }],
  suggestion: { weightKg: 0.7, lengthCm: 12, widthCm: 12, heightCm: 12, productWeightKg: 0.5, tareKg: 0.2, warnings: [] },
  confirmed: null,
};
function order({ step = "NOT_CREATED", blockers = [], actions = {}, shipment = null, provider = "SHIPROCKET" } = {}) {
  return { id: "o1", shipment, fulfilment: { provider, step, steps: STEPS, blockers, shipmentStatus: shipment?.status || null, actions: { ...NONE, ...actions } } };
}
const SHIP = { status: "CREATED", providerOrderId: "SR-ORD-9", providerShipmentId: "SH-77", awb: "AWB555", carrier: "Delhivery", trackingUrl: "https://track.example/AWB555", pickupStatus: "Pending", lastSyncedAt: "2026-10-30T10:00:00Z", estimatedDelivery: "2026-11-04T00:00:00Z", lastError: "Courier timed out", events: [{ status: "CREATED", label: "Shipment created", occurredAt: "2026-10-30T09:00:00Z" }] };

const btn = (name) => screen.queryByRole("button", { name });
beforeEach(() => {
  Object.values(api).filter((v) => typeof v.mockReset === "function").forEach((f) => f.mockReset());
  api.adminGetOrderPackage.mockResolvedValue({ data: pkgCtx });
});
const renderPanel = (o, onChanged = vi.fn().mockResolvedValue()) => { render(<ShipmentPackagePanel orderId="o1" order={o} onChanged={onChanged} />); return onChanged; };

describe("Fulfilment card", () => {
  it("renders nothing for the manual provider", async () => {
    const { container } = render(<ShipmentPackagePanel orderId="o1" order={order({ provider: "MANUAL" })} onChanged={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(api.adminGetOrderPackage).not.toHaveBeenCalled();
  });

  it("shows the step indicator with the current step and the blockers", async () => {
    renderPanel(order({ step: "AWB_ASSIGNED", blockers: ["Pickup postal code is not set (Admin → Shipping)."], shipment: SHIP, actions: { schedulePickup: true } }));
    const steps = await screen.findByTestId("fulfilment-steps");
    expect(within(steps).getByText("AWB assigned")).toHaveAttribute("aria-current", "step");
    expect(within(steps).getByText(/Shipment created/)).toHaveAttribute("data-state", "done");
    expect(within(screen.getByTestId("fulfilment-blockers")).getByText(/Pickup postal code is not set/)).toBeInTheDocument();
  });

  it("hides every action button whose flag is false", async () => {
    renderPanel(order({ step: "NOT_CREATED" }));
    await screen.findByTestId("fulfilment-steps");
    for (const n of [/Confirm Package/, /Check couriers/, /Create Shiprocket shipment/, /Assign AWB/, /Schedule pickup/, /Download label/, /Refresh tracking/, /Cancel shipment/]) expect(btn(n)).not.toBeInTheDocument();
  });

  it("shows only the buttons whose flag is true", async () => {
    renderPanel(order({ step: "AWB_ASSIGNED", shipment: SHIP, actions: { schedulePickup: true, downloadLabel: true, refreshTracking: true, cancelShipment: true } }));
    await screen.findByTestId("fulfilment-steps");
    for (const n of [/Schedule pickup/, /Download label/, /Refresh tracking/, /Cancel shipment/]) expect(btn(n)).toBeInTheDocument();
    for (const n of [/Assign AWB/, /Confirm Package/, /Create Shiprocket shipment/]) expect(btn(n)).not.toBeInTheDocument();
  });

  it("shows shipment info and events, and re-fetches the order after an action", async () => {
    const user = userEvent.setup();
    api.adminRefreshTracking.mockResolvedValue({ data: {} });
    const onChanged = renderPanel(order({ step: "SHIPMENT_CREATED", shipment: SHIP, actions: { refreshTracking: true } }));
    const d = await screen.findByTestId("shipment-details");
    for (const t of ["SR-ORD-9", "SH-77", "AWB555", "Delhivery", "Pending", "Courier timed out"]) expect(within(d).getByText(t)).toBeInTheDocument();
    expect(within(d).getByRole("link", { name: "Open tracking link" })).toHaveAttribute("href", "https://track.example/AWB555");
    expect(within(screen.getByTestId("shipment-events")).getByText("Shipment created")).toBeInTheDocument();
    await user.click(btn(/Refresh tracking/));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(api.adminRefreshTracking).toHaveBeenCalledWith("o1");
  });

  it("confirms the package, lists couriers, then creates the shipment with the chosen courier", async () => {
    const user = userEvent.setup();
    api.adminConfirmOrderPackage.mockResolvedValue({ data: pkgCtx });
    api.adminCheckServiceability.mockResolvedValue({ data: { cod: false, pickupPostcode: "110001", deliveryPostcode: "560038", recommendedCourierCompanyId: 7, couriers: [{ courierCompanyId: 7, name: "Delhivery", rate: 80, cod: true, rating: 4.5 }, { courierCompanyId: 9, name: "Xpressbees", rate: 70, cod: true }] } });
    api.adminCreateShipment.mockResolvedValue({ data: {} });
    renderPanel(order({ actions: { confirmPackage: true, checkServiceability: true, createShipment: true } }));
    await user.click(await screen.findByRole("button", { name: /Confirm Package & Check Couriers/ }));
    await user.click(await screen.findByLabelText("Choose Xpressbees"));
    await user.click(screen.getByRole("button", { name: "Create Shiprocket shipment" }));
    await waitFor(() => expect(api.adminCreateShipment).toHaveBeenCalledWith("o1", { courierCompanyId: 9 }));
  });

  it("assigns an AWB without a courier when none was chosen, and with it when picked", async () => {
    const user = userEvent.setup();
    api.adminGenerateShipmentAwb.mockResolvedValue({ data: {} });
    renderPanel(order({ step: "SHIPMENT_CREATED", shipment: { ...SHIP, awb: null }, actions: { assignAwb: true } }));
    await user.click(await screen.findByRole("button", { name: "Assign AWB" }));
    await waitFor(() => expect(api.adminGenerateShipmentAwb).toHaveBeenCalledWith("o1", {}));
  });

  it("cancel asks for confirmation first and does nothing when declined", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPanel(order({ step: "SHIPMENT_CREATED", shipment: SHIP, actions: { cancelShipment: true } }));
    await user.click(await screen.findByRole("button", { name: /Cancel shipment/ }));
    expect(confirm.mock.calls[0][0]).toMatch(/Shiprocket/);
    expect(confirm.mock.calls[0][0]).toMatch(/after Shiprocket confirms/);
    expect(api.adminCancelShipment).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it("cancel failure shows the server error and keeps the button for retry", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.adminCancelShipment.mockRejectedValueOnce(new Error("Shiprocket refused: already picked up")).mockResolvedValueOnce({ data: {} });
    const onChanged = renderPanel(order({ step: "SHIPMENT_CREATED", shipment: SHIP, actions: { cancelShipment: true } }));
    await user.click(await screen.findByRole("button", { name: /Cancel shipment/ }));
    expect(await screen.findByTestId("fulfilment-error")).toHaveTextContent("Shiprocket refused: already picked up");
    expect(onChanged).toHaveBeenCalled();
    const retry = screen.getByRole("button", { name: /Cancel shipment/ });
    expect(retry).toBeEnabled();
    await user.click(retry);
    await waitFor(() => expect(api.adminCancelShipment).toHaveBeenCalledTimes(2));
  });
});

const OVERVIEW = {
  enabled: true, provider: "SHIPROCKET", environment: "TEST", credentialsConfigured: true,
  connection: { lastSuccessfulAuthAt: "2026-10-30T08:00:00Z", status: "OK" },
  pickup: { nickname: "Warehouse-1", city: "Delhi", pincode: "110001", complete: true },
  automation: { autoCreateShipment: false, autoGenerateAwb: false, autoSchedulePickup: true },
  diagnostics: { lastError: { message: "Token expired", at: "2026-10-29T08:00:00Z", operation: "createOrder" }, lastServiceability: { at: "2026-10-30T08:00:00Z", ok: true, couriers: 4, pickupPostcode: "110001", deliveryPostcode: "560038" } },
};

describe("Shiprocket integration tabs", () => {
  beforeEach(() => {
    api.adminShiprocketOverview.mockResolvedValue({ data: OVERVIEW });
    api.adminShiprocketSummary.mockResolvedValue({ data: { enabled: true, webhook: { url: "https://api.example.test/api/webhooks/courier", tokenConfigured: true, lastReceivedAt: null, lastEventType: null, lastResult: null }, mapping: [] } });
    api.adminShiprocketWebhookEvents.mockResolvedValue({ data: { items: [] } });
  });

  it("shows the overview with read-only automation flags and no secrets", async () => {
    const user = userEvent.setup();
    render(<ShiprocketTabs />);
    expect(await screen.findByText("Last successful authentication")).toBeInTheDocument();
    const auto = screen.getByTestId("shiprocket-automation");
    expect(within(auto).getAllByText("OFF")).toHaveLength(2);
    expect(within(auto).getAllByText("ON")).toHaveLength(1);
    expect(within(auto).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Overview", "Pickup", "Webhook", "Diagnostics"]);
    await user.click(screen.getByRole("tab", { name: "Webhook" }));
    expect(await screen.findByTestId("shiprocket-webhook-url")).toHaveTextContent("https://api.example.test/api/webhooks/courier");
    expect(document.body.innerHTML).not.toMatch(/password|apiSecret|x-api-key-value|token_value/i);
  });

  it("pickup tab flags a configured nickname that Shiprocket does not know", async () => {
    const user = userEvent.setup();
    api.adminShiprocketPickupLocations.mockResolvedValue({ data: { configuredNickname: "Warehouse-1", configuredFound: false, locations: [{ nickname: "Primary", name: "Asha", phone: "98", address: "1 MG Road", city: "Delhi", state: "DL", pincode: "110001", verified: true }] } });
    render(<ShiprocketTabs />);
    await user.click(await screen.findByRole("tab", { name: "Pickup" }));
    expect(api.adminShiprocketPickupLocations).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Load pickup locations from Shiprocket" }));
    expect(await screen.findByText(/was not found in your Shiprocket account/)).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
  });

  it("diagnostics shows last error and serviceability, and Test connection uses the environment", async () => {
    const user = userEvent.setup();
    api.adminTestIntegration.mockResolvedValue({ data: {} });
    render(<ShiprocketTabs />);
    await user.click(await screen.findByRole("tab", { name: "Diagnostics" }));
    expect(await screen.findByText("Token expired")).toBeInTheDocument();
    expect(screen.getByText(/OK · 4 couriers/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Test connection" }));
    await waitFor(() => expect(api.adminTestIntegration).toHaveBeenCalledWith("SHIPROCKET", "TEST"));
  });
});

const TRACKING = {
  courier: "Delhivery", awb: "AWB555", trackingUrl: "https://track.example/AWB555", status: "SHIPPED", statusLabel: "Shipped",
  estimatedDelivery: "2026-11-04T00:00:00Z", deliveredAt: null,
  events: [{ status: "CONFIRMED", label: "Order placed", at: "2026-10-28T08:00:00Z" }, { status: "SHIPPED", label: "Shipped", at: "2026-10-30T08:00:00Z" }],
};

describe("Customer tracking block", () => {
  it("renders courier, AWB, status, ETA, link and a newest-first timeline", () => {
    render(<TrackingBlock tracking={TRACKING} />);
    expect(screen.getByText("Delhivery")).toBeInTheDocument();
    expect(screen.getByText("AWB555")).toBeInTheDocument();
    expect(screen.getByText("Estimated delivery")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Track shipment" })).toHaveAttribute("href", "https://track.example/AWB555");
    const items = within(screen.getByTestId("tracking-timeline")).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Shipped");
    expect(items[1]).toHaveTextContent("Order placed");
  });

  it("hides the block when tracking is null and drops non-http links", () => {
    const { container, rerender } = render(<TrackingBlock tracking={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<TrackingBlock tracking={{ ...TRACKING, trackingUrl: "javascript:alert(1)" }} />);
    expect(screen.queryByRole("link", { name: "Track shipment" })).not.toBeInTheDocument();
  });

  it("never renders internal fields even if the payload carries them", () => {
    render(<TrackingBlock tracking={{ ...TRACKING, providerShipmentId: "SH-77", providerOrderId: "SR-ORD-9", rawProviderStatus: "PICKUP_EXCEPTION", lastError: "boom" }} />);
    expect(document.body.textContent).not.toMatch(/SH-77|SR-ORD-9|PICKUP_EXCEPTION|boom/);
  });

  it("is shown on the Track Order result and hidden when the order has no tracking", async () => {
    const user = userEvent.setup();
    const submit = async () => {
      await user.type(screen.getByPlaceholderText("AAD-2026-008921"), "TUS-1");
      await user.type(screen.getByPlaceholderText("you@example.com"), "a@b.co");
      await user.click(screen.getByRole("button", { name: /Trace Order Status/ }));
    };
    api.trackOrder.mockResolvedValue({ data: { orderNumber: "TUS-1", status: "SHIPPED", createdAt: "2026-10-28T00:00:00Z", items: [], totalAmount: 100, tracking: TRACKING } });
    const first = render(<MemoryRouter><TrackOrder /></MemoryRouter>);
    await submit();
    expect(await screen.findByTestId("tracking-block")).toBeInTheDocument();
    first.unmount();
    api.trackOrder.mockResolvedValue({ data: { orderNumber: "TUS-1", status: "CONFIRMED", createdAt: "2026-10-28T00:00:00Z", items: [], totalAmount: 100, tracking: null } });
    render(<MemoryRouter><TrackOrder /></MemoryRouter>);
    await submit();
    await screen.findByText("Order Details");
    expect(screen.queryByTestId("tracking-block")).not.toBeInTheDocument();
  });
});
