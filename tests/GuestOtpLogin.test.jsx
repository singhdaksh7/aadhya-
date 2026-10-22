import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { CustomerAuthProvider } from "../src/context/CustomerAuthContext";
import RequireCustomer from "../src/components/RequireCustomer";
import { Login, SetPassword } from "../src/pages/account/AccountPages";
import SmtpSettingsForm from "../src/components/admin/integrations/SmtpSettingsForm";

const api = vi.hoisted(() => ({
  ApiRequestError: class ApiRequestError extends Error { constructor(message, status) { super(message); this.status = status; } },
  customerLogin: vi.fn(),
  customerRegister: vi.fn(),
  customerRefresh: vi.fn(),
  customerLogout: vi.fn(),
  customerOtpRequest: vi.fn(),
  customerOtpVerify: vi.fn(),
  customerSetPassword: vi.fn(),
  setAccessToken: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  adminGetSmtpSettings: vi.fn(),
  adminSaveSmtpSettings: vi.fn(),
  adminDeleteSmtpSettings: vi.fn(),
}));
vi.mock("../src/lib/api", () => api);

function App({ initial = "/login" }) {
  return (
    <MemoryRouter initialEntries={[initial]}>
      <CustomerAuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/account" element={<RequireCustomer><div>ACCOUNT HOME</div></RequireCustomer>} />
          <Route path="/account/set-password" element={<RequireCustomer><SetPassword /></RequireCustomer>} />
        </Routes>
      </CustomerAuthProvider>
    </MemoryRouter>
  );
}

const GUEST_ACCOUNT = { id: "c1", name: "Guest Buyer", email: "guest@example.com", phone: null, requiresPasswordSetup: true };

beforeEach(() => {
  Object.values(api).filter((v) => typeof v.mockReset === "function").forEach((fn) => fn.mockReset());
  api.customerRefresh.mockRejectedValue(new Error("no session"));
});

describe("guest account: one-time code login, then set a password", () => {
  it("offers an email-code sign-in on the login page", async () => {
    render(<App />);
    expect(await screen.findByTestId("otp-login-link")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /email me a login code instead/i })).toBeInTheDocument();
  });

  it("requests a code, verifies it, and sends a first-time user to Set your password", async () => {
    api.customerOtpRequest.mockResolvedValue({ data: { message: "ok" } });
    api.customerOtpVerify.mockResolvedValue({ data: { accessToken: "tok", customer: GUEST_ACCOUNT } });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: /email me a login code instead/i }));
    await user.type(screen.getByPlaceholderText("Email"), "guest@example.com");
    await user.click(screen.getByRole("button", { name: /email me a code/i }));
    await waitFor(() => expect(api.customerOtpRequest).toHaveBeenCalledWith("guest@example.com"));

    await user.type(await screen.findByPlaceholderText("000000"), "123456");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() => expect(api.customerOtpVerify).toHaveBeenCalledWith({ email: "guest@example.com", code: "123456" }));
    expect(await screen.findByTestId("set-password")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /set your password/i })).toBeInTheDocument();
  });

  it("skips the password step for an account that already has a password", async () => {
    api.customerOtpRequest.mockResolvedValue({ data: {} });
    api.customerOtpVerify.mockResolvedValue({ data: { accessToken: "tok", customer: { ...GUEST_ACCOUNT, requiresPasswordSetup: false } } });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: /email me a login code instead/i }));
    await user.type(screen.getByPlaceholderText("Email"), "guest@example.com");
    await user.click(screen.getByRole("button", { name: /email me a code/i }));
    await user.type(await screen.findByPlaceholderText("000000"), "654321");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(await screen.findByText("ACCOUNT HOME")).toBeInTheDocument();
  });

  it("shows the server's message for a wrong or expired code", async () => {
    api.customerOtpRequest.mockResolvedValue({ data: {} });
    api.customerOtpVerify.mockRejectedValue(new api.ApiRequestError("That code is invalid or has expired. Please request a new one.", 401));
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: /email me a login code instead/i }));
    await user.type(screen.getByPlaceholderText("Email"), "guest@example.com");
    await user.click(screen.getByRole("button", { name: /email me a code/i }));
    await user.type(await screen.findByPlaceholderText("000000"), "000000");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid or has expired/i);
  });

  it("validates and saves the first password, then continues to the account", async () => {
    api.customerRefresh.mockResolvedValue({ data: { accessToken: "tok", customer: GUEST_ACCOUNT } });
    api.customerSetPassword.mockResolvedValue({ data: { customer: { ...GUEST_ACCOUNT, requiresPasswordSetup: false } } });
    const user = userEvent.setup();
    render(<App initial="/account/set-password" />);
    const pw = await screen.findByLabelText(/^new password$/i);
    const confirm = screen.getByLabelText(/^confirm password$/i);
    await user.type(pw, "short");
    await user.type(confirm, "short");
    await user.click(screen.getByRole("button", { name: /save password/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least 10 characters/i);
    expect(api.customerSetPassword).not.toHaveBeenCalled();

    await user.clear(pw);
    await user.clear(confirm);
    await user.type(pw, "Sturdy-pass-123");
    await user.type(confirm, "Sturdy-pass-123");
    await user.click(screen.getByRole("button", { name: /save password/i }));
    await waitFor(() => expect(api.customerSetPassword).toHaveBeenCalledWith({ newPassword: "Sturdy-pass-123", confirmPassword: "Sturdy-pass-123" }));
    expect(await screen.findByText("ACCOUNT HOME")).toBeInTheDocument();
  });
});

describe("Admin SMTP settings form", () => {
  const settings = { saved: true, enabled: true, host: "smtp.mail.test", port: 587, encryption: "STARTTLS", user: "orders@shop.test", hasPassword: true, fromName: "Aadya", fromEmail: "orders@shop.test", replyTo: "", effectiveSource: "admin" };

  it("loads saved settings without ever showing the password, and keeps it when left blank", async () => {
    api.adminGetSmtpSettings.mockResolvedValue({ data: settings });
    api.adminSaveSmtpSettings.mockResolvedValue({ data: settings });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<SmtpSettingsForm onSaved={onSaved} />);
    expect(await screen.findByDisplayValue("smtp.mail.test")).toBeInTheDocument();
    const pw = screen.getByPlaceholderText(/leave blank to keep the saved password/i);
    expect(pw).toHaveValue("");
    await user.click(screen.getByRole("button", { name: /save smtp settings/i }));
    await waitFor(() => expect(api.adminSaveSmtpSettings).toHaveBeenCalled());
    const sent = api.adminSaveSmtpSettings.mock.calls[0][0];
    expect(sent).toMatchObject({ host: "smtp.mail.test", port: 587, encryption: "STARTTLS", password: "", fromEmail: "orders@shop.test" });
    expect(onSaved).toHaveBeenCalled();
  });

  it("changing encryption moves a default port with it", async () => {
    api.adminGetSmtpSettings.mockResolvedValue({ data: { ...settings, saved: false, hasPassword: false, effectiveSource: "none" } });
    const user = userEvent.setup();
    render(<SmtpSettingsForm />);
    await screen.findByText(/no smtp is configured/i);
    await user.selectOptions(screen.getByRole("combobox"), "SSL_TLS");
    expect(screen.getByRole("spinbutton")).toHaveValue(465);
  });
});
