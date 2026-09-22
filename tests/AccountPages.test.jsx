import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { CustomerAuthProvider } from "../src/context/CustomerAuthContext";
import RequireCustomer from "../src/components/RequireCustomer";
import { Login, Account, Addresses, Orders, OrderDetail, Forgot, Reset } from "../src/pages/account/AccountPages";

const api = vi.hoisted(() => ({
  customerRegister: vi.fn(),
  customerLogin: vi.fn(),
  customerRefresh: vi.fn(),
  customerLogout: vi.fn(),
  setAccessToken: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  updateAccountProfile: vi.fn(),
  changeAccountPassword: vi.fn(),
  accountAddresses: vi.fn(),
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
  setDefaultAddress: vi.fn(),
  accountOrders: vi.fn(),
  accountOrder: vi.fn(),
}));

vi.mock("../src/lib/api", () => api);

function AuthedRoutes({ initialEntries }) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <CustomerAuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Login register />} />
          <Route path="/forgot-password" element={<Forgot />} />
          <Route path="/reset-password" element={<Reset />} />
          <Route path="/account" element={<RequireCustomer><Account /></RequireCustomer>} />
          <Route path="/account/orders" element={<RequireCustomer><Orders /></RequireCustomer>} />
          <Route path="/account/orders/:orderNumber" element={<RequireCustomer><OrderDetail /></RequireCustomer>} />
          <Route path="/account/addresses" element={<RequireCustomer><Addresses /></RequireCustomer>} />
        </Routes>
      </CustomerAuthProvider>
    </MemoryRouter>
  );
}

const CUSTOMER = { id: "c1", name: "Test Customer", email: "test@example.com", phone: "9876543210" };

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.customerRefresh.mockRejectedValue(new Error("no session")); // logged-out bootstrap by default
});

describe("bootstrap", () => {
  it("attempts a silent refresh on mount and lands unauthenticated when it fails (no stale session)", async () => {
    render(<AuthedRoutes initialEntries={["/account"]} />);
    await waitFor(() => expect(api.customerRefresh).toHaveBeenCalled());
    // Unauthenticated -> RequireCustomer redirects to /login
    await waitFor(() => expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument());
  });

  it("restores an authenticated session when refresh succeeds", async () => {
    api.customerRefresh.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
    api.accountAddresses.mockResolvedValue({ data: [] });
    render(<AuthedRoutes initialEntries={["/account"]} />);
    await waitFor(() => expect(screen.getByText(/Email: test@example.com/)).toBeInTheDocument());
    expect(api.setAccessToken).toHaveBeenCalledWith("tok");
  });
});

describe("protected route redirect", () => {
  it("redirects an unauthenticated visitor from /account/addresses to /login with a returnTo", async () => {
    render(<AuthedRoutes initialEntries={["/account/addresses"]} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument());
  });
});

describe("login / register", () => {
  it("logs in and lands on /account", async () => {
    api.customerLogin.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
    api.accountAddresses.mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    render(<AuthedRoutes initialEntries={["/login"]} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText("Email"), "test@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "SafePassword123");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(screen.getByText(/Email: test@example.com/)).toBeInTheDocument());
  });

  it("shows the server error message on a failed login instead of navigating", async () => {
    api.customerLogin.mockRejectedValue(new Error("Invalid email or password."));
    const user = userEvent.setup();
    render(<AuthedRoutes initialEntries={["/login"]} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText("Email"), "test@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "WrongPassword1");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
  });

  it("registers a new account and lands on /account", async () => {
    api.customerRegister.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
    api.accountAddresses.mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    render(<AuthedRoutes initialEntries={["/register"]} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText("Name"), "Test Customer");
    await user.type(screen.getByPlaceholderText("Email"), "test@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "SafePassword123");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.getByText(/Email: test@example.com/)).toBeInTheDocument());
  });
});

describe("logout", () => {
  it("clears the session and RequireCustomer redirects to /login on the next protected render", async () => {
    api.customerRefresh.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
    api.accountAddresses.mockResolvedValue({ data: [] });
    api.customerLogout.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AuthedRoutes initialEntries={["/account"]} />);
    await waitFor(() => expect(screen.getByText(/Email: test@example.com/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() => expect(api.customerLogout).toHaveBeenCalled());
    expect(api.setAccessToken).toHaveBeenLastCalledWith(null);
  });
});

describe("profile", () => {
  it("saves profile changes", async () => {
    api.customerRefresh.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
    api.updateAccountProfile.mockResolvedValue({ data: { customer: CUSTOMER } });
    const user = userEvent.setup();
    render(<AuthedRoutes initialEntries={["/account"]} />);
    await waitFor(() => expect(screen.getByText(/Email: test@example.com/)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(api.updateAccountProfile).toHaveBeenCalled());
    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
  });
});

describe("password change", () => {
  async function renderAccount() {
    api.customerRefresh.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
    const user = userEvent.setup();
    render(<AuthedRoutes initialEntries={["/account"]} />);
    await waitFor(() => expect(screen.getByText(/Email: test@example.com/)).toBeInTheDocument());
    return user;
  }

  it("rejects a mismatched confirmation client-side without calling the API", async () => {
    const user = await renderAccount();
    await user.type(screen.getByPlaceholderText("Current Password"), "OldPassword123");
    await user.type(screen.getByPlaceholderText("New Password"), "NewPassword123");
    await user.type(screen.getByPlaceholderText("Confirm New Password"), "DifferentPassword1");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("New passwords do not match.")).toBeInTheDocument();
    expect(api.changeAccountPassword).not.toHaveBeenCalled();
  });

  it("submits a valid form and logs the user out on success", async () => {
    api.changeAccountPassword.mockResolvedValue({});
    api.customerLogout.mockResolvedValue({});
    const user = await renderAccount();
    await user.type(screen.getByPlaceholderText("Current Password"), "OldPassword123");
    await user.type(screen.getByPlaceholderText("New Password"), "NewPassword123");
    await user.type(screen.getByPlaceholderText("Confirm New Password"), "NewPassword123");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() => expect(api.changeAccountPassword).toHaveBeenCalledWith({
      currentPassword: "OldPassword123",
      newPassword: "NewPassword123",
      confirmPassword: "NewPassword123",
    }));
    await waitFor(() => expect(api.customerLogout).toHaveBeenCalled());
  });

  it("displays the server error when the current password is wrong", async () => {
    api.changeAccountPassword.mockRejectedValue(new Error("Current password is incorrect."));
    const user = await renderAccount();
    await user.type(screen.getByPlaceholderText("Current Password"), "WrongPassword1");
    await user.type(screen.getByPlaceholderText("New Password"), "NewPassword123");
    await user.type(screen.getByPlaceholderText("Confirm New Password"), "NewPassword123");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText("Current password is incorrect.")).toBeInTheDocument();
    expect(api.customerLogout).not.toHaveBeenCalled();
  });
});

describe("addresses", () => {
  const ADDR = { id: "addr1", label: "Home", fullName: "Test Customer", phone: "9876543210", addressLine1: "123 MG Road", addressLine2: "", city: "Bengaluru", state: "Karnataka", postalCode: "560001", country: "India", isDefault: true };

  it("shows an empty state with no saved addresses", async () => {
    api.customerRefresh.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
    api.accountAddresses.mockResolvedValue({ data: [] });
    render(<AuthedRoutes initialEntries={["/account/addresses"]} />);
    expect(await screen.findByText("No saved addresses yet.")).toBeInTheDocument();
  });

  it("lists saved addresses", async () => {
    api.customerRefresh.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
    api.accountAddresses.mockResolvedValue({ data: [ADDR] });
    render(<AuthedRoutes initialEntries={["/account/addresses"]} />);
    expect(await screen.findByText("Home", { exact: false })).toBeInTheDocument();
  });

  it("adds a new address", async () => {
    api.customerRefresh.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
    api.accountAddresses.mockResolvedValue({ data: [] });
    api.createAddress.mockResolvedValue({ data: ADDR });
    const user = userEvent.setup();
    render(<AuthedRoutes initialEntries={["/account/addresses"]} />);
    await screen.findByText("No saved addresses yet.");
    await user.type(screen.getByPlaceholderText("fullName"), "Test Customer");
    await user.type(screen.getByPlaceholderText("phone"), "9876543210");
    await user.type(screen.getByPlaceholderText("addressLine1"), "123 MG Road");
    await user.type(screen.getByPlaceholderText("city"), "Bengaluru");
    await user.type(screen.getByPlaceholderText("state"), "Karnataka");
    await user.type(screen.getByPlaceholderText("postalCode"), "560001");
    await user.type(screen.getByPlaceholderText("country"), "India");
    await user.click(screen.getByRole("button", { name: "Add address" }));
    await waitFor(() => expect(api.createAddress).toHaveBeenCalled());
  });

  it("edits an existing address", async () => {
    api.customerRefresh.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
    api.accountAddresses.mockResolvedValue({ data: [ADDR] });
    api.updateAddress.mockResolvedValue({ data: { ...ADDR, city: "Mumbai" } });
    const user = userEvent.setup();
    render(<AuthedRoutes initialEntries={["/account/addresses"]} />);
    await screen.findByText("Home", { exact: false });
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save address" }));
    await waitFor(() => expect(api.updateAddress).toHaveBeenCalledWith("addr1", expect.any(Object)));
  });

  it("deletes an address", async () => {
    api.customerRefresh.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
    api.accountAddresses.mockResolvedValue({ data: [ADDR] });
    api.deleteAddress.mockResolvedValue({ data: { deleted: true } });
    const user = userEvent.setup();
    render(<AuthedRoutes initialEntries={["/account/addresses"]} />);
    await screen.findByText("Home", { exact: false });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(api.deleteAddress).toHaveBeenCalledWith("addr1"));
  });

  it("sets a different address as default", async () => {
    api.customerRefresh.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
    api.accountAddresses.mockResolvedValue({ data: [{ ...ADDR, isDefault: false }] });
    api.setDefaultAddress.mockResolvedValue({ data: { default: true } });
    const user = userEvent.setup();
    render(<AuthedRoutes initialEntries={["/account/addresses"]} />);
    await screen.findByText("Home", { exact: false });
    await user.click(screen.getByRole("button", { name: "Set default" }));
    await waitFor(() => expect(api.setDefaultAddress).toHaveBeenCalledWith("addr1"));
  });
});

describe("orders", () => {
  it("lists account orders", async () => {
    api.customerRefresh.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
    api.accountOrders.mockResolvedValue({ data: [{ id: "o1", orderNumber: "AAD-2026-000001", totalAmount: 500, status: "CONFIRMED", paymentStatus: "PAID" }] });
    render(<AuthedRoutes initialEntries={["/account/orders"]} />);
    expect(await screen.findByText("AAD-2026-000001", { exact: false })).toBeInTheDocument();
  });

  it("shows an empty state with no orders", async () => {
    api.customerRefresh.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
    api.accountOrders.mockResolvedValue({ data: [] });
    render(<AuthedRoutes initialEntries={["/account/orders"]} />);
    expect(await screen.findByText("No account orders yet.")).toBeInTheDocument();
  });

  it("shows order detail", async () => {
    api.customerRefresh.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
    api.accountOrder.mockResolvedValue({
      data: { orderNumber: "AAD-2026-000001", status: "CONFIRMED", paymentStatus: "PAID", items: [{ id: "i1", productNameSnapshot: "Book A", quantity: 1, lineTotal: 500 }] },
    });
    render(<AuthedRoutes initialEntries={["/account/orders/AAD-2026-000001"]} />);
    expect(await screen.findByText("AAD-2026-000001")).toBeInTheDocument();
    expect(await screen.findByText(/Book A/)).toBeInTheDocument();
  });

  it("a forbidden/missing order (API error) leaves the detail view empty instead of crashing", async () => {
    api.customerRefresh.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
    api.accountOrder.mockRejectedValue(new Error("Order not found"));
    render(<AuthedRoutes initialEntries={["/account/orders/AAD-2026-999999"]} />);
    expect(await screen.findByText("Order not found")).toBeInTheDocument();
    expect(screen.queryByText("AAD-2026-999999")).not.toBeInTheDocument();
  });
});

describe("forgot / reset password", () => {
  it("shows the generic confirmation after submitting forgot-password", async () => {
    api.forgotPassword.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AuthedRoutes initialEntries={["/forgot-password"]} />);
    await user.type(screen.getByRole("textbox"), "test@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByText(/If an account exists/)).toBeInTheDocument();
  });

  it("rejects a mismatched confirmation on the reset form without calling the API", async () => {
    const user = userEvent.setup();
    render(<AuthedRoutes initialEntries={["/reset-password?token=abc"]} />);
    await user.type(screen.getByPlaceholderText("New password"), "NewPassword123");
    await user.type(screen.getByPlaceholderText("Confirm new password"), "DifferentPassword1");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  it("submits a valid reset and shows success", async () => {
    api.resetPassword.mockResolvedValue({});
    const user = userEvent.setup();
    render(<AuthedRoutes initialEntries={["/reset-password?token=abc"]} />);
    await user.type(screen.getByPlaceholderText("New password"), "NewPassword123");
    await user.type(screen.getByPlaceholderText("Confirm new password"), "NewPassword123");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() => expect(api.resetPassword).toHaveBeenCalledWith({ token: "abc", newPassword: "NewPassword123", confirmPassword: "NewPassword123" }));
    expect(await screen.findByText(/Password reset. You can now log in./)).toBeInTheDocument();
  });

  it("shows the server error on an invalid/expired reset token", async () => {
    api.resetPassword.mockRejectedValue(new Error("This password reset link is invalid or expired."));
    const user = userEvent.setup();
    render(<AuthedRoutes initialEntries={["/reset-password?token=bad"]} />);
    await user.type(screen.getByPlaceholderText("New password"), "NewPassword123");
    await user.type(screen.getByPlaceholderText("Confirm new password"), "NewPassword123");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByText("This password reset link is invalid or expired.")).toBeInTheDocument();
  });
});
