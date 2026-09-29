import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  adminGetReturn,
  adminApproveReturn,
  adminRejectReturn,
  adminSchedulePickup,
  adminMarkReturnInTransit,
  adminMarkReturnReceived,
  adminIssueReturnRefund,
  adminCloseReturn,
} from "../../lib/api";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import { formatInr } from "../../lib/format";
import { Modal } from "../../components/ui";
import { PageHeader, AdminCard, StatusBadge } from "../../components/admin/ui";

// State machine mirrored from server/src/modules/returns/returns.service.js
// (assertStatus calls in approveReturn/rejectReturn/schedulePickup/
// markInTransit/markReceived/issueRefund/closeReturn). Keeping this in sync
// with the backend is what lets us hide actions that would 409.
const VALID_ACTIONS_BY_STATUS = {
  REQUESTED: ["approve", "reject"],
  APPROVED: ["reject", "schedule-pickup", "in-transit", "received", "refund"],
  PICKUP_SCHEDULED: ["in-transit", "received"],
  IN_TRANSIT: ["received"],
  RECEIVED: ["refund", "close"],
  REFUND_PENDING: ["refund"],
  REFUNDED: ["close"],
  REJECTED: ["close"],
  CLOSED: [],
};

const ACTION_LABELS = {
  approve: "Approve",
  reject: "Reject",
  "schedule-pickup": "Schedule Pickup",
  "in-transit": "Mark In Transit",
  received: "Mark Received",
  refund: "Issue Refund",
  close: "Close",
};

function refundableAmount(order) {
  const payment = order?.payments?.find((p) => p.status !== "FAILED") || order?.payments?.[0];
  if (!payment) return 0;
  const paid = Number(payment.amount || 0);
  const refunded = Number(payment.refundedAmount || 0);
  return Math.max(0, Math.round((paid - refunded) * 100) / 100);
}

function isCodOrder(order) {
  const payment = order?.payments?.[0];
  return payment?.provider === "cod" || order?.paymentMethod === "cod";
}

function RefundModal({ open, onClose, returnRequest, onSubmitted }) {
  const order = returnRequest?.order;
  const cod = isCodOrder(order);
  const remaining = refundableAmount(order);
  const [amount, setAmount] = useState(remaining ? String(remaining) : "");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(remaining ? String(remaining) : "");
      setReference("");
      setNote("");
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, returnRequest?.id]);

  if (!open) return null;

  const numericAmount = Number(amount);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid refund amount.");
      return;
    }
    // UX-only guard — the backend is the authority and will reject an
    // amount that exceeds the remaining refundable balance regardless.
    if (numericAmount > remaining + 0.01) {
      setError(`Amount cannot exceed the refundable balance of ${formatInr(remaining)}.`);
      return;
    }
    if (cod && !reference.trim()) {
      setError("A reference is required for a manually recorded refund.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = cod
        ? { amount: numericAmount, method: "manual", reference: reference.trim(), note: note || undefined }
        : { amount: numericAmount, method: "razorpay", note: note || undefined };
      await adminIssueReturnRefund(returnRequest.id, payload);
      onSubmitted();
    } catch (err) {
      setError(err?.message || "Failed to issue refund.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Issue Refund">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <p className="text-sm text-charcoal-soft">
          Refundable balance: <strong>{formatInr(remaining)}</strong>
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">
            Refund Amount
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            max={remaining || undefined}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="admin-input w-full"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="admin-btn admin-btn--ghost text-xs"
              onClick={() => setAmount(String(remaining))}
            >
              Full amount
            </button>
          </div>
        </div>

        {cod ? (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">
                Reference (UTR / transaction ID)
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="admin-input w-full"
                placeholder="e.g. bank transfer UTR"
              />
            </div>
            <p className="text-xs text-charcoal-soft">
              This order was paid by Cash on Delivery — refunds must be recorded manually (method: manual).
            </p>
          </>
        ) : (
          <p className="text-xs text-charcoal-soft">
            This will be issued via Razorpay to the original payment method (method: razorpay).
          </p>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="admin-input w-full"
            rows={2}
          />
        </div>

        {error && <p className="text-sm text-terracotta">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="admin-btn admin-btn--ghost">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="admin-btn admin-btn--primary">
            {submitting ? "Processing…" : "Issue Refund"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Timeline({ returnRequest }) {
  const events = [
    { label: "Requested", at: returnRequest.createdAt },
    { label: "Approved", at: returnRequest.approvedAt },
    { label: "Rejected", at: returnRequest.rejectedAt },
    { label: "Received", at: returnRequest.receivedAt },
    { label: "Restocked", at: returnRequest.restockedAt },
    { label: "Completed / Refunded / Closed", at: returnRequest.completedAt },
  ].filter((e) => e.at);

  if (!events.length) return <p className="text-sm text-charcoal-soft">No timeline events yet.</p>;

  return (
    <ol className="space-y-3">
      {events.map((e) => (
        <li key={e.label} className="flex items-start gap-3 text-sm">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-green" />
          <div>
            <p className="font-medium text-charcoal">{e.label}</p>
            <p className="text-xs text-charcoal-soft">{new Date(e.at).toLocaleString("en-IN")}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function AdminReturnDetail() {
  const { id } = useParams();
  const [returnRequest, setReturnRequest] = useState(null);
  const [loadStatus, setLoadStatus] = useState("loading");
  const [actionError, setActionError] = useState("");
  const [actionInFlight, setActionInFlight] = useState(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  function load() {
    setLoadStatus("loading");
    adminGetReturn(id)
      .then((res) => {
        setReturnRequest(res.data);
        setLoadStatus("ready");
      })
      .catch(() => setLoadStatus("error"));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function runAction(action, fn) {
    setActionError("");
    setActionInFlight(action);
    try {
      await fn();
      load();
    } catch (err) {
      setActionError(err?.message || "Action failed.");
    } finally {
      setActionInFlight(null);
    }
  }

  if (loadStatus === "loading") return <LoadingNotice />;
  if (loadStatus === "error" || !returnRequest) {
    return <ErrorNotice message="Unable to load this return." onRetry={load} />;
  }

  const validActions = VALID_ACTIONS_BY_STATUS[returnRequest.status] || [];
  const order = returnRequest.order;
  const shipment = order?.shipment;
  const payment = order?.payments?.[0];
  const isRto = returnRequest.reason === "RTO";
  const isRtoPrepaid = isRto && returnRequest.status === "REFUND_PENDING";
  const isRtoCod = isRto && (returnRequest.status === "CLOSED" || (returnRequest.restockedAt && isCodOrder(order)));

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title={`Return ${returnRequest.id.slice(0, 8)}`}
        description={order ? `Order ${order.orderNumber}` : undefined}
        actions={
          <Link to="/admin/returns" className="admin-btn admin-btn--ghost">
            Back to Returns
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge value={returnRequest.status} />
        {isRto && <StatusBadge value={shipment?.status === "RTO" ? "RTO Initiated" : "RTO Delivered"} tone="warning" />}
        {isRtoPrepaid && <StatusBadge value="Refund Pending (RTO)" tone="warning" />}
        {isRtoCod && <StatusBadge value="No Refund Needed (COD)" tone="neutral" />}
      </div>

      {actionError && <ErrorNotice message={actionError} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <AdminCard title="Requested Items">
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {(returnRequest.items || []).map((ri) => (
                  <tr key={ri.id}>
                    <td>{ri.orderItem?.productNameSnapshot || "—"}</td>
                    <td>{ri.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminCard>

          <AdminCard title="Reason & Details">
            <p className="text-sm font-medium text-charcoal">{returnRequest.reason}</p>
            {returnRequest.details && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-charcoal-soft">{returnRequest.details}</p>
            )}
          </AdminCard>

          <AdminCard title="Payment Info">
            {payment ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs uppercase text-charcoal-soft">Provider</dt>
                  <dd>{payment.provider}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-charcoal-soft">Status</dt>
                  <dd>
                    <StatusBadge value={payment.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-charcoal-soft">Paid Amount</dt>
                  <dd>{formatInr(payment.amount)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-charcoal-soft">Refunded So Far</dt>
                  <dd>{formatInr(payment.refundedAmount || 0)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-charcoal-soft">No payment record found.</p>
            )}
          </AdminCard>

          <AdminCard title="Shipment Info">
            {shipment ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs uppercase text-charcoal-soft">Carrier</dt>
                  <dd>{shipment.carrier || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-charcoal-soft">Tracking</dt>
                  <dd>{shipment.trackingNumber || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-charcoal-soft">Status</dt>
                  <dd>
                    <StatusBadge value={shipment.status} />
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-charcoal-soft">No shipment on this order.</p>
            )}
          </AdminCard>

          {(returnRequest.refunds || []).length > 0 && (
            <AdminCard title="Refund History">
              <table className="admin-table w-full">
                <thead>
                  <tr>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {returnRequest.refunds.map((rf) => (
                    <tr key={rf.id}>
                      <td>{formatInr(rf.amount)}</td>
                      <td>{rf.method}</td>
                      <td>{rf.reference || rf.providerRefundId || "—"}</td>
                      <td>{new Date(rf.createdAt).toLocaleDateString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminCard>
          )}
        </div>

        <div className="space-y-6">
          <AdminCard title="Customer">
            <p className="text-sm font-medium text-charcoal">{order?.customerName || "—"}</p>
            <p className="text-sm text-charcoal-soft">{order?.customerEmail}</p>
          </AdminCard>

          <AdminCard title="Actions">
            {validActions.length === 0 && (
              <p className="text-sm text-charcoal-soft">No further actions available.</p>
            )}
            <div className="flex flex-wrap gap-2">
              {validActions.includes("approve") && (
                <button
                  className="admin-btn admin-btn--primary"
                  disabled={actionInFlight === "approve"}
                  onClick={() => runAction("approve", () => adminApproveReturn(returnRequest.id))}
                >
                  {ACTION_LABELS.approve}
                </button>
              )}
              {validActions.includes("reject") && (
                <button
                  className="admin-btn admin-btn--ghost"
                  disabled={actionInFlight === "reject"}
                  onClick={() => runAction("reject", () => adminRejectReturn(returnRequest.id))}
                >
                  {ACTION_LABELS.reject}
                </button>
              )}
              {validActions.includes("schedule-pickup") && (
                <button
                  className="admin-btn admin-btn--ghost"
                  disabled={actionInFlight === "schedule-pickup"}
                  onClick={() => runAction("schedule-pickup", () => adminSchedulePickup(returnRequest.id))}
                >
                  {ACTION_LABELS["schedule-pickup"]}
                </button>
              )}
              {validActions.includes("in-transit") && (
                <button
                  className="admin-btn admin-btn--ghost"
                  disabled={actionInFlight === "in-transit"}
                  onClick={() => runAction("in-transit", () => adminMarkReturnInTransit(returnRequest.id))}
                >
                  {ACTION_LABELS["in-transit"]}
                </button>
              )}
              {validActions.includes("received") && (
                <button
                  className="admin-btn admin-btn--ghost"
                  disabled={actionInFlight === "received"}
                  onClick={() => runAction("received", () => adminMarkReturnReceived(returnRequest.id))}
                >
                  {ACTION_LABELS.received}
                </button>
              )}
              {validActions.includes("refund") && (
                <button
                  className="admin-btn admin-btn--primary"
                  data-testid="open-refund-modal"
                  onClick={() => setRefundModalOpen(true)}
                >
                  {ACTION_LABELS.refund}
                </button>
              )}
              {validActions.includes("close") && (
                <button
                  className="admin-btn admin-btn--ghost"
                  disabled={actionInFlight === "close"}
                  onClick={() => runAction("close", () => adminCloseReturn(returnRequest.id))}
                >
                  {ACTION_LABELS.close}
                </button>
              )}
            </div>
          </AdminCard>

          <AdminCard title="Status Timeline">
            <Timeline returnRequest={returnRequest} />
          </AdminCard>
        </div>
      </div>

      <RefundModal
        open={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        returnRequest={returnRequest}
        onSubmitted={() => {
          setRefundModalOpen(false);
          load();
        }}
      />
    </div>
  );
}
