import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { CustomerAuthProvider } from "../src/context/CustomerAuthContext";
import RequireCustomer from "../src/components/RequireCustomer";
import { OrderDetail, AccountReturns, AccountReturnDetail } from "../src/pages/account/AccountPages";

const api = vi.hoisted(() => ({
  customerRegister: vi.fn(),
  ApiRequestError: class ApiRequestError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  },
  customerLogin: vi.fn(),
  customerRefresh: vi.fn(),
  customerLogout: vi.fn(),
  setAccessToken: vi.fn(),
  accountOrder: vi.fn(),
  downloadAccountInvoice: vi.fn(),
  accountReturnEligibility: vi.fn(),
  createAccountReturn: vi.fn(),
  accountReturns: vi.fn(),
  accountReturn: vi.fn(),
}));

vi.mock("../src/lib/api", () => api);

function AuthedRoutes({ initialEntries }) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <CustomerAuthProvider>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/account/orders/:orderNumber" element={<RequireCustomer><OrderDetail /></RequireCustomer>} />
          <Route path="/account/returns" element={<RequireCustomer><AccountReturns /></RequireCustomer>} />
          <Route path="/account/returns/:id" element={<RequireCustomer><AccountReturnDetail /></RequireCustomer>} />
        </Routes>
      </CustomerAuthProvider>
    </MemoryRouter>
  );
}

const CUSTOMER = { id: "c1", name: "Test Customer", email: "test@example.com", phone: "9876543210" };

const ORDER = {
  orderNumber: "AAD-2026-000001",
  status: "DELIVERED",
  paymentStatus: "PAID",
  totalAmount: 500,
  items: [{ id: "oi1", productNameSnapshot: "Book A", quantity: 2, lineTotal: 500 }],
};

beforeEach(() => {
  Object.values(api).filter((v) => typeof v.mockReset === "function").forEach((fn) => fn.mockReset());
  api.customerRefresh.mockResolvedValue({ data: { accessToken: "tok", customer: CUSTOMER } });
});

describe("Request Return flow on order detail", () => {
  it("shows Request Return when the order is eligible", async () => {
    api.accountOrder.mockResolvedValue({ data: ORDER });
    api.accountReturnEligibility.mockResolvedValue({ data: { eligible: true, reason: null, returnableItemIds: ["oi1"] } });
    render(<AuthedRoutes initialEntries={["/account/orders/AAD-2026-000001"]} />);
    expect(await screen.findByRole("button", { name: "Request Return" })).toBeInTheDocument();
  });

  it("does not show Request Return, and shows the reason, when the order is ineligible", async () => {
    api.accountOrder.mockResolvedValue({ data: ORDER });
    api.accountReturnEligibility.mockResolvedValue({ data: { eligible: false, reason: "The return window for this order has closed", returnableItemIds: [] } });
    render(<AuthedRoutes initialEntries={["/account/orders/AAD-2026-000001"]} />);
    expect(await screen.findByText("The return window for this order has closed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request Return" })).not.toBeInTheDocument();
  });

  it("submits a return request with selected item, quantity and reason", async () => {
    api.accountOrder.mockResolvedValue({ data: ORDER });
    api.accountReturnEligibility.mockResolvedValue({ data: { eligible: true, reason: null, returnableItemIds: ["oi1"] } });
    api.createAccountReturn.mockResolvedValue({ data: { id: "r1" } });
    const user = userEvent.setup();
    render(<AuthedRoutes initialEntries={["/account/orders/AAD-2026-000001"]} />);
    await user.click(await screen.findByRole("button", { name: "Request Return" }));
    await user.click(screen.getByLabelText(/Book A/));
    await user.type(screen.getByPlaceholderText("Reason for return"), "Wrong size");
    await user.click(screen.getByRole("button", { name: "Submit Return Request" }));
    await waitFor(() =>
      expect(api.createAccountReturn).toHaveBeenCalledWith({
        orderNumber: "AAD-2026-000001",
        reason: "Wrong size",
        details: undefined,
        items: [{ orderItemId: "oi1", quantity: 1 }],
      })
    );
    expect(await screen.findByText(/return request has been submitted/i)).toBeInTheDocument();
  });
});

describe("Returns history", () => {
  it("renders returns with statuses", async () => {
    api.accountReturns.mockResolvedValue({
      data: [
        {
          id: "return-id-1",
          status: "APPROVED",
          refundStatus: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          order: { orderNumber: "AAD-2026-000001" },
          items: [{ id: "ri1", quantity: 1, orderItem: { productNameSnapshot: "Book A" } }],
        },
      ],
    });
    render(<AuthedRoutes initialEntries={["/account/returns"]} />);
    expect(await screen.findByText(/Return #return-i/)).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText(/AAD-2026-000001/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no returns", async () => {
    api.accountReturns.mockResolvedValue({ data: [] });
    render(<AuthedRoutes initialEntries={["/account/returns"]} />);
    expect(await screen.findByText(/haven't requested any returns/i)).toBeInTheDocument();
  });
});

describe("Return detail timeline", () => {
  it("highlights the current status and shows timestamps that have occurred", async () => {
    api.accountReturn.mockResolvedValue({
      data: {
        id: "return-id-1",
        status: "RECEIVED",
        reason: "Damaged item",
        details: null,
        refundAmount: 0,
        refundStatus: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        approvedAt: "2026-01-02T00:00:00.000Z",
        receivedAt: "2026-01-05T00:00:00.000Z",
        rejectedAt: null,
        completedAt: null,
        order: { orderNumber: "AAD-2026-000001" },
        items: [{ id: "ri1", quantity: 1, orderItem: { productNameSnapshot: "Book A" } }],
      },
    });
    render(<AuthedRoutes initialEntries={["/account/returns/return-id-1"]} />);
    expect(await screen.findByText("Received", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    // A future step (Refunded) should not show a timestamp.
    const refundedLabel = screen.getByText("Refunded");
    expect(refundedLabel.parentElement.textContent).not.toMatch(/\d{4}/);
  });

  it("handles a cross-customer 404 gracefully instead of crashing", async () => {
    api.accountReturn.mockRejectedValue(new api.ApiRequestError("Return request not found", 404));
    render(<AuthedRoutes initialEntries={["/account/returns/not-mine"]} />);
    expect(await screen.findByText(/couldn't find that return request/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Returns/i })).toBeInTheDocument();
  });
});
