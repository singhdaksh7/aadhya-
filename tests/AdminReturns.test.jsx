import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminReturnList from "../src/pages/admin/AdminReturnList";
import AdminReturnDetail from "../src/pages/admin/AdminReturnDetail";
import * as api from "../src/lib/api";

function makeReturn(overrides = {}) {
  return {
    id: "return-aaaaaaaa-1111",
    status: "REQUESTED",
    reason: "Damaged item",
    createdAt: "2026-01-01T00:00:00.000Z",
    items: [{ id: "ri1", quantity: 2, orderItem: { productNameSnapshot: "Ceramic Vase" } }],
    refunds: [],
    order: {
      orderNumber: "ORD-1001",
      customerName: "Asha Rao",
      customerEmail: "asha@example.com",
      payments: [{ id: "p1", provider: "razorpay", status: "PAID", amount: 1000, refundedAmount: 0 }],
      shipment: { carrier: "Delhivery", trackingNumber: "TRK1", status: "DELIVERED" },
    },
    ...overrides,
  };
}

describe("AdminReturnList", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders returns with key columns and supports status/search filtering", async () => {
    vi.spyOn(api, "adminListReturns").mockResolvedValue({
      data: [
        makeReturn(),
        makeReturn({ id: "return-bbbbbbbb-2222", reason: "RTO", status: "REFUND_PENDING", order: { ...makeReturn().order, orderNumber: "ORD-2002", customerName: "Vik Shah" } }),
      ],
      meta: { page: 1, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <AdminReturnList />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("ORD-1001")).toBeInTheDocument());
    expect(screen.getByText("ORD-2002")).toBeInTheDocument();
    expect(screen.getByText("Asha Rao")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Search return ID/i), { target: { value: "Vik" } });
    await waitFor(() => {
      expect(screen.queryByText("ORD-1001")).not.toBeInTheDocument();
      expect(screen.getByText("ORD-2002")).toBeInTheDocument();
    });
  });
});

describe("AdminReturnDetail — action visibility per status", () => {
  beforeEach(() => vi.restoreAllMocks());

  function renderDetail(returnRequest) {
    vi.spyOn(api, "adminGetReturn").mockResolvedValue({ data: returnRequest });
    return render(
      <MemoryRouter initialEntries={[`/admin/returns/${returnRequest.id}`]}>
        <Routes>
          <Route path="/admin/returns/:id" element={<AdminReturnDetail />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("REQUESTED shows only Approve and Reject", async () => {
    renderDetail(makeReturn({ status: "REQUESTED" }));
    await waitFor(() => expect(screen.getByText("Approve")).toBeInTheDocument());
    expect(screen.getByText("Reject")).toBeInTheDocument();
    expect(screen.queryByText("Issue Refund")).not.toBeInTheDocument();
    expect(screen.queryByText("Mark Received")).not.toBeInTheDocument();
    expect(screen.queryByText("Close")).not.toBeInTheDocument();
  });

  it("RECEIVED shows Issue Refund and Close but not Approve/Reject", async () => {
    renderDetail(makeReturn({ status: "RECEIVED" }));
    await waitFor(() => expect(screen.getByText("Issue Refund")).toBeInTheDocument());
    expect(screen.getByText("Close")).toBeInTheDocument();
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
    expect(screen.queryByText("Reject")).not.toBeInTheDocument();
  });

  it("REFUNDED shows only Close", async () => {
    renderDetail(makeReturn({ status: "REFUNDED" }));
    await waitFor(() => expect(screen.getByText("Close")).toBeInTheDocument());
    expect(screen.queryByText("Issue Refund")).not.toBeInTheDocument();
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
  });

  it("CLOSED shows no actions", async () => {
    renderDetail(makeReturn({ status: "CLOSED" }));
    await waitFor(() => expect(screen.getByText("No further actions available.")).toBeInTheDocument());
  });

  it("shows RTO badges for an RTO-generated REFUND_PENDING return (prepaid)", async () => {
    renderDetail(
      makeReturn({
        status: "REFUND_PENDING",
        reason: "RTO",
        restockedAt: "2026-01-02T00:00:00.000Z",
        order: { ...makeReturn().order, shipment: { carrier: "Delhivery", trackingNumber: "TRK1", status: "RTO_DELIVERED" } },
      })
    );
    await waitFor(() => expect(screen.getByText("RTO Delivered")).toBeInTheDocument());
    expect(screen.getByText("Refund Pending (RTO)")).toBeInTheDocument();
    expect(screen.getByText("Issue Refund")).toBeInTheDocument();
  });

  it("shows no-refund-needed messaging for an RTO COD return that's CLOSED", async () => {
    renderDetail(
      makeReturn({
        status: "CLOSED",
        reason: "RTO",
        restockedAt: "2026-01-02T00:00:00.000Z",
        order: {
          ...makeReturn().order,
          payments: [{ id: "p1", provider: "cod", status: "PAID", amount: 500, refundedAmount: 0 }],
          shipment: { carrier: "Delhivery", trackingNumber: "TRK1", status: "RTO_DELIVERED" },
        },
      })
    );
    await waitFor(() => expect(screen.getByText("No Refund Needed (COD)")).toBeInTheDocument());
  });

  it("refund modal validates amount does not exceed refundable balance", async () => {
    renderDetail(makeReturn({ status: "RECEIVED" }));
    await waitFor(() => expect(screen.getByTestId("open-refund-modal")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("open-refund-modal"));

    const amountInput = await screen.findByDisplayValue("1000");
    fireEvent.change(amountInput, { target: { value: "5000" } });
    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton).toBeTruthy();
    fireEvent.click(submitButton);

    expect(await screen.findByText(/cannot exceed the refundable balance/i)).toBeInTheDocument();
  });

  it("refund modal shows manual method fields for COD orders", async () => {
    renderDetail(
      makeReturn({
        status: "RECEIVED",
        order: { ...makeReturn().order, payments: [{ id: "p1", provider: "cod", status: "PAID", amount: 500, refundedAmount: 0 }] },
      })
    );
    await waitFor(() => expect(screen.getByTestId("open-refund-modal")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("open-refund-modal"));
    expect(await screen.findByText(/recorded manually/i)).toBeInTheDocument();
    expect(screen.getByText(/Reference \(UTR/i)).toBeInTheDocument();
  });
});
