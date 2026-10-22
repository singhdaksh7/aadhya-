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
  adminRazorpaySummary: vi.fn(),
  adminRazorpaySave: vi.fn(),
  adminRazorpayTest: vi.fn(),
  adminRazorpaySetMode: vi.fn(),
  adminRazorpayGenerateWebhookSecret: vi.fn(),
  adminRazorpayRemoveWebhookSecret: vi.fn(),
  adminRazorpayVerifySetup: vi.fn(),
  adminRazorpayWebhookEvents: vi.fn(),
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

const URL_ = "https://api.example.test/api/webhooks/razorpay";
function summary(overrides = {}) {
  return {
    data: {
      mode: "TEST",
      modeSource: "admin",
      usingEnvironmentVariables: false,
      environments: {
        TEST: { environment: "TEST", configured: true, enabled: true, keyId: "rzp_test_abc123", keySecretMask: "••••••9f2a", webhookSecretConfigured: true, webhookSecretMask: "••••••77xz", lastTestedAt: null, testStatus: null },
        LIVE: { environment: "LIVE", configured: false, enabled: false, keyId: null, keySecretMask: null, webhookSecretConfigured: false, webhookSecretMask: null, lastTestedAt: null, testStatus: null },
      },
      paymentMethods: { razorpayEnabled: true, codEnabled: true },
      webhook: {
        url: URL_,
        events: [
          { event: "payment.captured", effect: "Marks the payment and order as paid." },
          { event: "payment.failed", effect: "Records the failed payment attempt." },
        ],
        secretConfigured: true,
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
  api.adminRazorpaySummary.mockResolvedValue(summary());
  api.adminRazorpayWebhookEvents.mockResolvedValue({ data: { items: [] } });
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
    expect(api.adminRazorpaySummary).not.toHaveBeenCalled();
  });
});

describe("Razorpay panel — status and secrets", () => {
  it("shows mode, configuration summary and masked secrets without ever rendering a secret value", async () => {
    renderPage();
    expect(await screen.findByText("TEST MODE")).toBeInTheDocument();
    const summaryList = screen.getByLabelText("Razorpay configuration summary");
    expect(within(summaryList).getAllByText("Configured").length).toBeGreaterThanOrEqual(2); // API credentials + webhook secret
    expect(screen.getByText("••••••9f2a")).toBeInTheDocument();
    // Secret inputs start empty and are password-typed: a saved secret is never placed in the DOM.
    expect(screen.getByLabelText("Key Secret")).toHaveValue("");
    expect(screen.getByLabelText("Key Secret")).toHaveAttribute("type", "password");
    expect(document.body.innerHTML).not.toMatch(/secret_value|whsec/i);
  });

  it("displays the automatic webhook URL read-only with a Copy button", async () => {
    const user = userEvent.setup();
    // userEvent.setup() installs its own clipboard stub, so spy on that one.
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    renderPage();
    const field = await screen.findByLabelText("Webhook URL");
    expect(field).toHaveValue(URL_);
    expect(field).toHaveAttribute("readonly");
    await user.click(screen.getByRole("button", { name: "Copy Webhook URL" }));
    expect(writeText).toHaveBeenCalledWith(URL_);
  });

  it("lists only the supported events and the setup guide steps", async () => {
    renderPage();
    await screen.findByText("TEST MODE");
    expect(screen.getAllByText("payment.captured").length).toBeGreaterThan(0);
    expect(screen.getAllByText("payment.failed").length).toBeGreaterThan(0);
    expect(screen.queryByText("refund.processed")).not.toBeInTheDocument();
    expect(screen.getByText("Setup Guide")).toBeInTheDocument();
    expect(screen.getByText(/Click Add New Webhook/)).toBeInTheDocument();
  });
});

describe("Razorpay panel — saving", () => {
  it("sends only the fields Admin changed, trimmed, so one secret can be replaced alone", async () => {
    const user = userEvent.setup();
    api.adminRazorpaySave.mockResolvedValue({ data: {} });
    renderPage();
    await user.type(await screen.findByLabelText("Key Secret"), "  new_secret_value  ");
    await user.click(screen.getByRole("button", { name: "Save TEST credentials" }));
    await waitFor(() => expect(api.adminRazorpaySave).toHaveBeenCalled());
    // Key ID is sent alongside a new secret so the pair is validated together; no webhook secret is touched.
    expect(api.adminRazorpaySave.mock.calls[0][0]).toEqual({ environment: "TEST", keyId: "rzp_test_abc123", keySecret: "new_secret_value" });
  });

  it("renders field-level validation errors from the server", async () => {
    const user = userEvent.setup();
    api.adminRazorpaySave.mockRejectedValue(new api.ApiRequestError("Please check your Razorpay settings.", 400, { keyId: "This looks like a LIVE Razorpay key." }));
    renderPage();
    const keyId = await screen.findByLabelText("Key ID");
    await user.clear(keyId);
    await user.type(keyId, "rzp_live_x");
    await user.type(screen.getByLabelText("Key Secret"), "abc");
    await user.click(screen.getByRole("button", { name: "Save TEST credentials" }));
    expect(await screen.findByText("This looks like a LIVE Razorpay key.")).toBeInTheDocument();
  });

  it("clears typed secrets when switching between TEST and LIVE credentials", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText("Key Secret"), "typed_test_secret");
    await user.click(screen.getByRole("tab", { name: "LIVE credentials" }));
    expect(screen.getByLabelText("Key Secret")).toHaveValue("");
    expect(screen.getByLabelText("Key ID")).toHaveValue("");
  });
});

describe("Razorpay panel — mode, connection and webhook secret", () => {
  it("requires confirmation before switching to LIVE", async () => {
    const user = userEvent.setup();
    api.adminRazorpaySetMode.mockResolvedValue(summary({ mode: "LIVE" }));
    renderPage();
    await screen.findByText("TEST MODE");
    await user.click(screen.getByRole("button", { name: "LIVE mode" }));
    expect(api.adminRazorpaySetMode).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Customers will be charged real money");
    await user.click(screen.getByRole("button", { name: "Confirm switch to LIVE" }));
    await waitFor(() => expect(api.adminRazorpaySetMode).toHaveBeenCalledWith("LIVE"));
  });

  it("runs the connection test for the environment being edited and shows a clear outcome", async () => {
    const user = userEvent.setup();
    api.adminRazorpayTest.mockResolvedValue({ data: { outcome: "AUTH_FAILED" } });
    renderPage();
    await screen.findByText("TEST MODE");
    await user.click(screen.getByRole("button", { name: "Test Razorpay Connection" }));
    await waitFor(() => expect(api.adminRazorpayTest).toHaveBeenCalledWith("TEST"));
    expect((await screen.findAllByText(/TEST: Authentication failed/)).length).toBe(1);
  });

  it("shows a generated webhook secret once with a warning, then hides it", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    api.adminRazorpayGenerateWebhookSecret.mockResolvedValue({ data: { environment: "TEST", webhookSecret: "GENERATED-SECRET-ONCE-xyz", shownOnce: true } });
    renderPage();
    await screen.findByText("TEST MODE");
    await user.click(screen.getByRole("button", { name: /Rotate \(Generate New Secret\)/ }));
    expect(await screen.findByDisplayValue("GENERATED-SECRET-ONCE-xyz")).toBeInTheDocument();
    expect(screen.getByText(/Copy this secret now\. It will not be shown again/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "I have copied it" }));
    expect(screen.queryByDisplayValue("GENERATED-SECRET-ONCE-xyz")).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("GENERATED-SECRET-ONCE-xyz");
  });

  it("verifies setup and states that it is waiting for the first signed event", async () => {
    const user = userEvent.setup();
    api.adminRazorpayVerifySetup.mockResolvedValue({
      data: { ready: true, waitingForFirstSignedEvent: true, message: "Waiting for first signed Razorpay event.", checks: [{ key: "secret", label: "Webhook secret configured", pass: true, detail: "Signatures can be verified" }] },
    });
    renderPage();
    await screen.findByText("TEST MODE");
    await user.click(screen.getByRole("button", { name: "Verify Setup" }));
    expect(await screen.findByText("Waiting for first signed Razorpay event.")).toBeInTheDocument();
  });

  it("shows webhook delivery history without payloads", async () => {
    api.adminRazorpayWebhookEvents.mockResolvedValue({
      data: { items: [{ id: "1", time: "2026-10-15T08:00:00Z", event: "payment.captured", signature: "VERIFIED", result: "PROCESSED", reference: "order_abc", error: null }, { id: "2", time: "2026-10-15T08:01:00Z", event: null, signature: "FAILED", result: "REJECTED", reference: null, error: "Signature did not match" }] },
    });
    renderPage();
    expect(await screen.findByText("order_abc")).toBeInTheDocument();
    expect(screen.getByText("Signature did not match")).toBeInTheDocument();
  });
});
