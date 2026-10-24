import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({
  adminListEmailTemplates: vi.fn(),
  adminSaveEmailTemplate: vi.fn(),
  adminToggleEmailTemplate: vi.fn(),
  adminPreviewEmailTemplate: vi.fn(),
  adminResetEmailTemplate: vi.fn(),
  adminSendTemplateTest: vi.fn(),
  adminShiprocketSummary: vi.fn(),
  adminShiprocketGenerateToken: vi.fn(),
  adminShiprocketRemoveToken: vi.fn(),
  adminShiprocketVerifySetup: vi.fn(),
  adminShiprocketWebhookEvents: vi.fn(),
}));
vi.mock("../src/lib/api", () => api);

const AdminEmailTemplates = (await import("../src/pages/admin/AdminEmailTemplates")).default;
const ShiprocketWebhookPanel = (await import("../src/components/admin/integrations/ShiprocketWebhookPanel")).default;

const tpl = (key, label, over = {}) => ({ key, label, locked: false, enabled: true, customized: false, subject: `${label} subject`, heading: `${label} heading`, body: "Hello {{firstName}}", defaults: {}, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  api.adminListEmailTemplates.mockResolvedValue({
    data: { templates: [tpl("ORDER_SHIPPED", "Order shipped"), tpl("LOGIN_CODE", "Login code", { locked: true })], variables: { firstName: "First name", orderNumber: "Order number" } },
  });
});

describe("Admin → Email Templates", () => {
  it("lists templates, shows placeholders, previews the draft and saves edits", async () => {
    const user = userEvent.setup();
    api.adminPreviewEmailTemplate.mockResolvedValue({ data: { subject: "Preview subject", html: "<p>hi</p>", text: "hi" } });
    api.adminSaveEmailTemplate.mockResolvedValue({ data: {} });
    render(<AdminEmailTemplates />);
    expect(await screen.findByRole("button", { name: /Order shipped/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Login code/ })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Order shipped subject")).toBeInTheDocument();
    expect(screen.getByText("{{firstName}}")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Subject"));
    await user.paste("Shipped {{orderNumber}}"); // paste: userEvent.type treats { as key syntax
    await user.click(screen.getByRole("button", { name: "Preview" }));
    await waitFor(() => expect(api.adminPreviewEmailTemplate).toHaveBeenCalledWith("ORDER_SHIPPED", expect.objectContaining({ subject: "Shipped {{orderNumber}}" })));
    expect(await screen.findByTitle("Email preview")).toHaveAttribute("sandbox", "");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.adminSaveEmailTemplate).toHaveBeenCalledWith("ORDER_SHIPPED", expect.objectContaining({ subject: "Shipped {{orderNumber}}", enabled: true })));
  });

  it("security emails have no switch-off control", async () => {
    const user = userEvent.setup();
    render(<AdminEmailTemplates />);
    await user.click(await screen.findByRole("button", { name: /Login code/ }));
    expect(screen.getByText(/Security email: always sent/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Switch off" })).not.toBeInTheDocument();
  });

  it("shows a server validation error for an unknown placeholder", async () => {
    const user = userEvent.setup();
    api.adminSaveEmailTemplate.mockRejectedValue(new Error("Unknown placeholder: {{secret}}."));
    render(<AdminEmailTemplates />);
    await screen.findByLabelText("Subject");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unknown placeholder");
  });
});

describe("Shiprocket webhook panel", () => {
  const summary = (over = {}) => ({
    data: {
      enabled: true,
      credentials: [],
      webhook: { url: "https://api.example.test/api/webhooks/shipment-status", header: "x-api-key", tokenConfigured: false, lastReceivedAt: null, lastEventType: null, lastResult: null, lastSignature: null, waitingForFirstEvent: true, ...over },
      mapping: [{ id: 17, shiprocket: "Out for delivery", becomes: "OUT_FOR_DELIVERY", email: "OUT_FOR_DELIVERY email" }],
    },
  });
  beforeEach(() => {
    api.adminShiprocketSummary.mockResolvedValue(summary());
    api.adminShiprocketWebhookEvents.mockResolvedValue({ data: { items: [] } });
  });

  it("shows the neutral URL and the x-api-key instructions, never a stored token", async () => {
    render(<MemoryRouter><ShiprocketWebhookPanel /></MemoryRouter>);
    expect(await screen.findByTestId("shiprocket-webhook-url")).toHaveTextContent("/api/webhooks/shipment-status");
    expect(screen.getByText(/x-api-key/)).toBeInTheDocument();
    expect(screen.getByText("Token missing")).toBeInTheDocument();
  });

  it("shows a generated token once, with a warning, and hides it afterwards", async () => {
    const user = userEvent.setup();
    api.adminShiprocketGenerateToken.mockResolvedValue({ data: { webhookToken: "ONE-TIME-TOKEN-xyz", shownOnce: true } });
    render(<MemoryRouter><ShiprocketWebhookPanel /></MemoryRouter>);
    await user.click(await screen.findByRole("button", { name: "Generate token" }));
    expect(await screen.findByDisplayValue("ONE-TIME-TOKEN-xyz")).toBeInTheDocument();
    expect(screen.getByText(/It will not be shown again/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "I have copied it" }));
    expect(screen.queryByDisplayValue("ONE-TIME-TOKEN-xyz")).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("ONE-TIME-TOKEN-xyz");
  });
});
