import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { CartProvider } from "../src/context/CartContext";
import CheckoutPage from "../src/pages/CheckoutPage";

const CUSTOMER = { id: "c1", name: "Jane Doe", email: "jane@example.com", phone: "9876543210" };

const product = {
  id: "p1",
  slug: "test-basket",
  name: "Test Basket",
  price: 990,
  salePrice: null,
  trackInventory: true,
  stockQuantity: 5,
  images: [],
};

const previewResponse = {
  data: {
    items: [{ slug: "test-basket", ok: true, issue: null, message: null, product: { name: "Test Basket", slug: "test-basket" }, unitPrice: 990, quantity: 1, lineTotal: 990 }],
    hasBlockingIssues: false,
    subtotal: 990,
    shipping: 99,
    tax: 0,
    discount: 0,
    total: 1089,
    currency: "INR",
  },
};

const HOME = { id: "addr-home", label: "Home", fullName: "Jane Doe", phone: "9876543210", addressLine1: "1 Home St", addressLine2: "", city: "Pune", state: "MH", postalCode: "411001", country: "India", isDefault: true };
const WORK = { id: "addr-work", label: "Work", fullName: "Jane Doe", phone: "9876543210", addressLine1: "2 Work Ave", addressLine2: "", city: "Mumbai", state: "MH", postalCode: "400001", country: "India", isDefault: false };

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../src/context/CustomerAuthContext", () => ({
  useCustomerAuth: () => ({ user: CUSTOMER }),
}));

vi.mock("../src/lib/api", () => ({
  fetchProductBySlug: vi.fn(() => Promise.resolve({ data: product })),
  checkoutPreview: vi.fn(() => Promise.resolve(previewResponse)),
  createOrder: vi.fn(() => Promise.resolve({ data: { orderId: "order-1", orderNumber: "AAD-2026-000001", accessToken: "tok123" } })),
  createRazorpayOrder: vi.fn(() => Promise.resolve({ data: { keyId: "rzp_test_x", razorpayOrderId: "order_rzp_1", amount: 108900, currency: "INR", name: "Aadya Society", description: "d", prefill: {} } })),
  verifyRazorpayPayment: vi.fn(() => Promise.resolve({ data: { orderNumber: "AAD-2026-000001" } })),
  accountAddresses: vi.fn(() => Promise.resolve({ data: [HOME, WORK] })),
  createAddress: vi.fn(() => Promise.resolve({ data: { id: "addr-new" } })),
  ApiRequestError: class ApiRequestError extends Error {},
}));

vi.mock("../src/lib/razorpay", () => ({ loadRazorpayScript: vi.fn(() => Promise.resolve(true)) }));

function seedCart() {
  localStorage.setItem("aadya.cart.v1", JSON.stringify([{ slug: "test-basket", quantity: 1 }]));
}

function Harness() {
  return (
    <MemoryRouter>
      <CartProvider>
        <CheckoutPage />
      </CartProvider>
    </MemoryRouter>
  );
}

beforeEach(async () => {
  localStorage.clear();
  navigateMock.mockClear();
  window.Razorpay = undefined;
  const api = await import("../src/lib/api");
  api.createOrder.mockClear();
  api.createAddress.mockClear();
  api.accountAddresses.mockClear();
  api.accountAddresses.mockResolvedValue({ data: [HOME, WORK] });
  api.checkoutPreview.mockClear();
  api.checkoutPreview.mockResolvedValue(previewResponse);
});

describe("CheckoutPage — logged-in", () => {
  it("prefills contact details from the user profile", async () => {
    seedCart();
    render(<Harness />);
    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("Jane Doe"));
    expect(screen.getByLabelText("Email")).toHaveValue("jane@example.com");
  });

  it("loads saved addresses and preselects the default one", async () => {
    seedCart();
    render(<Harness />);
    await waitFor(() => expect(screen.getByText(/Home — Jane Doe \(Default\)/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByDisplayValue("1 Home St")).toBeInTheDocument());
  });

  it("switches the shipping form when a different saved address is selected", async () => {
    seedCart();
    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(screen.getByDisplayValue("1 Home St")).toBeInTheDocument());
    await user.click(screen.getByLabelText(/Work — Jane Doe/));
    await waitFor(() => expect(screen.getByDisplayValue("2 Work Ave")).toBeInTheDocument());
  });

  it('sends the selected savedAddressId when "Use a new address" is not chosen', async () => {
    seedCart();
    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(screen.getByDisplayValue("1 Home St")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /pay securely/i }));
    const { createOrder } = await import("../src/lib/api");
    await waitFor(() => expect(createOrder).toHaveBeenCalled());
    expect(createOrder.mock.calls[0][0].savedAddressId).toBe("addr-home");
  });

  it('"Use a new address" clears the selection and reveals the save-address checkbox', async () => {
    seedCart();
    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(screen.getByDisplayValue("1 Home St")).toBeInTheDocument());
    await user.click(screen.getByLabelText("Use a new address"));
    expect(screen.getByLabelText(/Save this address to my account/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("1 Home St")).toBeInTheDocument(); // form fields are not auto-cleared, still editable
  });

  it("checking Save this address creates it and sends its id as savedAddressId, with the manual fields as entered", async () => {
    seedCart();
    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(screen.getByDisplayValue("1 Home St")).toBeInTheDocument());
    await user.click(screen.getByLabelText("Use a new address"));
    await user.clear(screen.getByLabelText("Address Line 1"));
    await user.type(screen.getByLabelText("Address Line 1"), "9 New Street");
    await user.click(screen.getByLabelText(/Save this address to my account/i));
    await user.click(screen.getByRole("button", { name: /pay securely/i }));

    const api = await import("../src/lib/api");
    await waitFor(() => expect(api.createAddress).toHaveBeenCalled());
    expect(api.createAddress.mock.calls[0][0].addressLine1).toBe("9 New Street");
    await waitFor(() => expect(api.createOrder).toHaveBeenCalled());
    expect(api.createOrder.mock.calls[0][0].savedAddressId).toBe("addr-new");
  });

  it("sends the manually entered address directly (no savedAddressId) when not saving", async () => {
    seedCart();
    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(screen.getByDisplayValue("1 Home St")).toBeInTheDocument());
    await user.click(screen.getByLabelText("Use a new address"));
    await user.clear(screen.getByLabelText("Address Line 1"));
    await user.type(screen.getByLabelText("Address Line 1"), "9 New Street");
    await user.click(screen.getByRole("button", { name: /pay securely/i }));

    const api = await import("../src/lib/api");
    await waitFor(() => expect(api.createOrder).toHaveBeenCalled());
    expect(api.createAddress).not.toHaveBeenCalled();
    expect(api.createOrder.mock.calls[0][0].savedAddressId).toBeUndefined();
    expect(api.createOrder.mock.calls[0][0].shippingAddress.addressLine1).toBe("9 New Street");
  });

  it("displays a backend ownership/ordering error from createOrder instead of navigating", async () => {
    seedCart();
    const api = await import("../src/lib/api");
    api.createOrder.mockRejectedValueOnce(new api.ApiRequestError("Address not found"));
    render(<Harness />);
    await waitFor(() => expect(screen.getByDisplayValue("1 Home St")).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /pay securely/i }));
    expect(await screen.findByText("Address not found")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("still sources cart totals from the checkout preview endpoint, not a client-side sum", async () => {
    seedCart();
    render(<Harness />);
    await waitFor(() => expect(screen.getByText("₹1,089")).toBeInTheDocument());
    const { checkoutPreview } = await import("../src/lib/api");
    expect(checkoutPreview).toHaveBeenCalled();
  });
});
