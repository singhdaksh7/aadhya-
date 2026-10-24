import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  adminDeleteIntegration: vi.fn(),
  adminCashfreeSummary: vi.fn(),
  adminCashfreeSave: vi.fn(),
  adminCashfreeRemove: vi.fn(),
  adminCashfreeTest: vi.fn(),
  adminCashfreeSetMode: vi.fn(),
  adminCashfreeVerifySetup: vi.fn(),
  adminCashfreeWebhookEvents: vi.fn(),
  adminGetShippingBusiness: vi.fn(),
  adminSaveShippingBusiness: vi.fn(),
  adminGetEmailStatus: vi.fn(),
  adminSendTestEmail: vi.fn(),
  adminGetEmailHealth: vi.fn(),
  adminGetEmailLogs: vi.fn(),
  adminRetryEmailLog: vi.fn(),
  adminGetSmtpSettings: vi.fn(),
  adminSaveSmtpSettings: vi.fn(),
  adminDeleteSmtpSettings: vi.fn(),
}));

vi.mock("../src/lib/api", () => api);
const authState = vi.hoisted(() => ({ role: "SUPER_ADMIN" }));
vi.mock("../src/context/AdminAuthContext", () => ({
  useAdminAuth: () => ({ admin: { role: authState.role } }),
}));

const URL_ = "https://api.example.test/api/webhooks/cashfree";
function summary(overrides = {}) {
  return {
    data: {
      mode: "TEST",
      modeSource: "admin",
      environments: {
        TEST: { environment: "TEST", configured: true, enabled: true, appId: "TEST1234abc", secretKeyMask: "••••••9f2a", lastTestedAt: null, testStatus: null },
        LIVE: { environment: "LIVE", configured: false, enabled: false, appId: null, secretKeyMask: null, lastTestedAt: null, testStatus: null },
      },
      paymentMethods: { cashfreeEnabled: true, codEnabled: true },
      onlinePaymentAvailable: true,
      apiVersion: "2025-01-01",
      webhook: {
        url: URL_,
        events: [
          { event: "PAYMENT_SUCCESS_WEBHOOK", effect: "Marks the payment and order as paid." },
          { event: "PAYMENT_FAILED_WEBHOOK", effect: "Records the failed payment attempt." },
          { event: "PAYMENT_USER_DROPPED_WEBHOOK", effect: "Records an abandoned payment." },
        ],
        lastReceivedAt: null,
        lastEventType: null,
        lastEventAt: null,
        lastSignature: null,
        lastResult: null,
        waitingForFirstSignedEvent: true,
      },
      ...overrides,
    },
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminIntegrations />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.role = "SUPER_ADMIN";
  api.adminGetIntegrationStatus.mockResolvedValue({ data: { credentials: [], webhookUrl: URL_ } });
  api.adminCashfreeSummary.mockResolvedValue(summary());
  api.adminCashfreeWebhookEvents.mockResolvedValue({ data: { items: [] } });
  api.adminGetShippingBusiness.mockResolvedValue({ data: {} });
  api.adminGetEmailStatus.mockResolvedValue({ data: {} });
  api.adminGetEmailHealth.mockResolvedValue({ data: { failedCount: 0 } });
  api.adminGetEmailLogs.mockResolvedValue({ data: { items: [] } });
  api.adminGetSmtpSettings.mockResolvedValue({ data: { saved: false, enabled: false, host: "", port: 587, encryption: "STARTTLS", user: "", hasPassword: false, fromName: "", fromEmail: "", replyTo: "", effectiveSource: "none" } });
});

describe("AdminIntegrations — access", () => {
  it("blocks non-super admins from the integrations screen", async () => {
    authState.role = "ADMIN";
    renderPage();
    expect(await screen.findByText(/Only super administrators/i)).toBeInTheDocument();
    expect(api.adminCashfreeSummary).not.toHaveBeenCalled();
  });
});

describe("Cashfree panel — status and secrets", () => {
  it("shows mode, summary and masked secret without ever rendering the secret value", async () => {
    renderPage();
    expect(await screen.findByText(/TEST MODE \(sandbox\)/)).toBeInTheDocument();
    const summaryList = screen.getByLabelText("Cashfree configuration summary");
    expect(within(summaryList).getByText("Available to customers")).toBeInTheDocument();
    expect(screen.getByText("••••••9f2a")).toBeInTheDocument();
    // The secret input starts empty and is password-typed: a saved secret is never placed in the DOM.
    expect(screen.getByLabelText("Secret Key")).toHaveValue("");
    expect(screen.getByLabelText("Secret Key")).toHaveAttribute("type", "password");
    expect(document.body.innerHTML).not.toMatch(/secret_value|cfsk_/i);
  });

  it("defaults to TEST mode when no mode was ever selected and says online payment is hidden until ready", async () => {
    api.adminCashfreeSummary.mockResolvedValue(summary({ modeSource: "default", onlinePaymentAvailable: false, environments: { TEST: { environment: "TEST", configured: false, enabled: false, appId: null, secretKeyMask: null }, LIVE: { environment: "LIVE", configured: false, enabled: false, appId: null, secretKeyMask: null } } }));
    renderPage();
    expect(await screen.findByText(/TEST MODE \(sandbox\)/)).toBeInTheDocument();
    expect(screen.getByText(/Hidden from customers/)).toBeInTheDocument();
  });

  it("shows the exact webhook URL and only the events the backend handles", async () => {
    renderPage();
    expect(await screen.findByTestId("cashfree-webhook-url")).toHaveTextContent(URL_);
    expect(screen.getAllByText("PAYMENT_SUCCESS_WEBHOOK").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PAYMENT_FAILED_WEBHOOK").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PAYMENT_USER_DROPPED_WEBHOOK").length).toBeGreaterThan(0);
    expect(screen.queryByText("PAYMENT_CHARGES_WEBHOOK")).not.toBeInTheDocument();
    expect(screen.queryByText(/razorpay/i)).not.toBeInTheDocument();
  });
});

describe("Cashfree panel — saving", () => {
  it("sends only the fields Admin changed, trimmed, so the Secret Key can be replaced alone", async () => {
    const user = userEvent.setup();
    api.adminCashfreeSave.mockResolvedValue({ data: {} });
    renderPage();
    await user.type(await screen.findByLabelText("Secret Key"), "  new_secret_value  ");
    await user.click(screen.getByRole("button", { name: "Save TEST credentials" }));
    await waitFor(() => expect(api.adminCashfreeSave).toHaveBeenCalled());
    expect(api.adminCashfreeSave.mock.calls[0][0]).toEqual({ environment: "TEST", appId: "TEST1234abc", secretKey: "new_secret_value" });
  });

  it("a blank Secret Key keeps the stored one (nothing is sent)", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText("Secret Key");
    await user.click(screen.getByRole("button", { name: "Save TEST credentials" }));
    expect(api.adminCashfreeSave).not.toHaveBeenCalled();
    expect(await screen.findByText(/Nothing to save/)).toBeInTheDocument();
  });

  it("renders field-level validation errors from the server", async () => {
    const user = userEvent.setup();
    api.adminCashfreeSave.mockRejectedValue(new api.ApiRequestError("Please check your Cashfree settings.", 400, { secretKey: "This looks like a LIVE (production) Secret Key." }));
    renderPage();
    await user.type(await screen.findByLabelText("Secret Key"), "cfsk_ma_prod_x");
    await user.click(screen.getByRole("button", { name: "Save TEST credentials" }));
    expect(await screen.findByText("This looks like a LIVE (production) Secret Key.")).toBeInTheDocument();
  });

  it("clears typed secrets when switching between TEST and LIVE credentials", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText("Secret Key"), "typed_test_secret");
    await user.click(screen.getByRole("tab", { name: /LIVE \(production\)/ }));
    expect(screen.getByLabelText("Secret Key")).toHaveValue("");
    expect(screen.getByLabelText("Cashfree App ID")).toHaveValue("");
  });

  it("removes stored credentials after confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.adminCashfreeRemove.mockResolvedValue({ data: { removed: true } });
    renderPage();
    await screen.findByLabelText("Secret Key");
    await user.click(screen.getByRole("button", { name: "Remove credentials" }));
    await waitFor(() => expect(api.adminCashfreeRemove).toHaveBeenCalledWith("TEST"));
  });
});

describe("Cashfree panel — mode, connection and webhook", () => {
  it("requires confirmation before switching to LIVE", async () => {
    const user = userEvent.setup();
    api.adminCashfreeSetMode.mockResolvedValue(summary({ mode: "LIVE" }));
    renderPage();
    await screen.findByText(/TEST MODE \(sandbox\)/);
    await user.click(screen.getByRole("button", { name: "LIVE mode" }));
    expect(api.adminCashfreeSetMode).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Customers will be charged real money");
    await user.click(screen.getByRole("button", { name: "Confirm switch to LIVE" }));
    await waitFor(() => expect(api.adminCashfreeSetMode).toHaveBeenCalledWith("LIVE"));
  });

  it("runs the connection test for the environment being edited and shows a clear outcome", async () => {
    const user = userEvent.setup();
    api.adminCashfreeTest.mockResolvedValue({ data: { outcome: "AUTH_FAILED" } });
    renderPage();
    await screen.findByText(/TEST MODE \(sandbox\)/);
    await user.click(screen.getByRole("button", { name: "Test connection" }));
    await waitFor(() => expect(api.adminCashfreeTest).toHaveBeenCalledWith("TEST"));
    expect((await screen.findAllByText(/TEST: Authentication failed/)).length).toBe(1);
  });

  it("verifies setup and states that it is waiting for the first signed event", async () => {
    const user = userEvent.setup();
    api.adminCashfreeVerifySetup.mockResolvedValue({
      data: { ready: true, waitingForFirstSignedEvent: true, message: "Waiting for the first signed Cashfree event.", checks: [{ key: "endpoint", label: "Webhook endpoint reachable and enforcing signatures", pass: true, detail: "Endpoint reachable and rejecting unsigned requests" }] },
    });
    renderPage();
    await screen.findByText(/TEST MODE \(sandbox\)/);
    await user.click(screen.getByRole("button", { name: "Check webhook setup" }));
    expect(await screen.findByText("Waiting for the first signed Cashfree event.")).toBeInTheDocument();
  });

  it("shows webhook delivery history without payloads", async () => {
    api.adminCashfreeWebhookEvents.mockResolvedValue({
      data: { items: [{ id: "1", time: "2026-10-15T08:00:00Z", event: "PAYMENT_SUCCESS_WEBHOOK", signature: "VERIFIED", result: "PROCESSED", reference: "TUS-2026-000001", error: null }, { id: "2", time: "2026-10-15T08:01:00Z", event: null, signature: "FAILED", result: "REJECTED", reference: null, error: "Signature did not match" }] },
    });
    renderPage();
    expect(await screen.findByText("TUS-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Signature did not match")).toBeInTheDocument();
  });
});
