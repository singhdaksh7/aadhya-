import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdminIntegrations from "../src/pages/admin/AdminIntegrations";

const api = vi.hoisted(() => ({
  ApiRequestError: class ApiRequestError extends Error {
    constructor(message, status, details) {
      super(message);
      this.status = status;
      this.details = details;
    }
  },
  adminGetIntegrationStatus: vi.fn(),
  adminSaveIntegration: vi.fn(),
  adminTestIntegration: vi.fn(),
  adminGetShippingBusiness: vi.fn(),
  adminSaveShippingBusiness: vi.fn(),
  adminGetEmailStatus: vi.fn(),
  adminSendTestEmail: vi.fn(),
  adminGetEmailHealth: vi.fn(),
  adminGetEmailLogs: vi.fn(),
  adminRetryEmailLog: vi.fn(),
}));

vi.mock("../src/lib/api", () => api);
vi.mock("../src/context/AdminAuthContext", () => ({
  useAdminAuth: () => ({ admin: { role: "SUPER_ADMIN" } }),
}));

function statusResponse(overrides = {}) {
  return { data: { credentials: [], webhookUrl: "/api/webhooks/razorpay", ...overrides } };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.adminGetIntegrationStatus.mockResolvedValue(statusResponse());
  api.adminGetShippingBusiness.mockResolvedValue({ data: {} });
  api.adminGetEmailStatus.mockResolvedValue({ data: {} });
  api.adminGetEmailHealth.mockResolvedValue({ data: { failedCount: 0 } });
  api.adminGetEmailLogs.mockResolvedValue({ data: { items: [] } });
});

async function fillRazorpayForm(user) {
  await user.type(screen.getByLabelText("Key ID"), "  rzp_test_abc  ");
  await user.type(screen.getByLabelText("Key Secret"), "  secret_value  ");
  // Shiprocket's card also has a "Webhook secret" field — Razorpay's is the first in DOM order.
  const [razorpayWebhookSecret] = screen.getAllByLabelText("Webhook secret");
  await user.type(razorpayWebhookSecret, "  webhook_value  ");
}

describe("AdminIntegrations — Razorpay save flow", () => {
  it("submits environment only at the top level, never duplicated inside data, and trims values", async () => {
    const user = userEvent.setup();
    api.adminSaveIntegration.mockResolvedValue({ data: {} });
    render(<MemoryRouter><AdminIntegrations /></MemoryRouter>);

    await waitFor(() => expect(api.adminGetIntegrationStatus).toHaveBeenCalled());
    await fillRazorpayForm(user);
    await user.click(screen.getByRole("button", { name: "Save Razorpay" }));

    await waitFor(() => expect(api.adminSaveIntegration).toHaveBeenCalled());
    const payload = api.adminSaveIntegration.mock.calls[0][0];
    expect(payload).toEqual({
      provider: "RAZORPAY",
      environment: "TEST",
      data: { keyId: "rzp_test_abc", keySecret: "secret_value", webhookSecret: "webhook_value" },
    });
    expect(payload.data.environment).toBeUndefined();
  });

  it("renders field-level errors returned by the backend next to each input", async () => {
    const user = userEvent.setup();
    api.adminSaveIntegration.mockRejectedValue(
      new api.ApiRequestError("Please check your Razorpay credentials.", 400, {
        keyId: "Razorpay Key ID is required.",
        keySecret: "Razorpay Key Secret is required.",
      })
    );
    render(<MemoryRouter><AdminIntegrations /></MemoryRouter>);

    await waitFor(() => expect(api.adminGetIntegrationStatus).toHaveBeenCalled());
    // Fields are HTML5 `required`, so they must be non-empty to submit at all —
    // the server is still the one that rejects them (e.g. whitespace-only) here.
    await fillRazorpayForm(user);
    await user.click(screen.getByRole("button", { name: "Save Razorpay" }));

    expect(await screen.findByText("Razorpay Key ID is required.")).toBeInTheDocument();
    expect(await screen.findByText("Razorpay Key Secret is required.")).toBeInTheDocument();
  });

  it("wires the Test Connection button to the RAZORPAY test endpoint for the selected environment", async () => {
    const user = userEvent.setup();
    api.adminTestIntegration.mockResolvedValue({ data: { testStatus: "SUCCESS" } });
    render(<MemoryRouter><AdminIntegrations /></MemoryRouter>);

    await waitFor(() => expect(api.adminGetIntegrationStatus).toHaveBeenCalled());
    // Razorpay's card renders before Shiprocket's, so it's the first "Test Connection" button.
    const [razorpayTestButton] = screen.getAllByRole("button", { name: /Test Connection/i });
    await user.click(razorpayTestButton);

    await waitFor(() => expect(api.adminTestIntegration).toHaveBeenCalledWith("RAZORPAY", "TEST"));
  });
});
