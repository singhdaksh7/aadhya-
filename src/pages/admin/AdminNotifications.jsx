import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { adminListNotifications, adminMarkNotificationRead, adminMarkAllNotificationsRead } from "../../lib/api";
import { LoadingNotice, ErrorNotice } from "../../components/StateNotice";
import { PageHeader, AdminCard, StatusBadge, AdminTable, AdminEmptyState } from "../../components/admin/ui";
import { FilterBar, FilterSelect } from "../../components/admin/ui/FilterBar";

const TYPE_OPTIONS = [
  "NEW_ORDER",
  "PAYMENT_FAILED",
  "LOW_STOCK",
  "OUT_OF_STOCK",
  "SHIPMENT_FAILED",
  "RETURN_REQUESTED",
  "REFUND_FAILED",
  "EMAIL_FAILED",
  "WEBHOOK_FAILED",
  "BACKUP_FAILED",
  "SYSTEM_WARNING",
];

const SEVERITY_OPTIONS = ["INFO", "WARNING", "CRITICAL"];

const SEVERITY_TONE = {
  CRITICAL: "danger",
  WARNING: "info",
  INFO: "neutral",
};

// Best-effort entity-page link for a notification, based on entityType.
// Only maps to routes we're confident exist — otherwise the row stays unlinked.
function entityLink(n) {
  if (!n.entityType) return null;
  switch (n.entityType) {
    case "Product":
    case "ProductVariant":
      return "/admin/inventory/low-stock";
    case "Order":
      return n.entityId ? `/admin/orders/${n.entityId}` : null;
    default:
      return null;
  }
}

export default function AdminNotifications() {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [markingId, setMarkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const params = { take: 100 };
      if (unreadOnly) params.isRead = "false";
      if (typeFilter) params.type = typeFilter;
      if (severityFilter) params.severity = severityFilter;
      const res = await adminListNotifications(params);
      setItems(res.data || []);
      setUnreadCount(res.meta?.unreadCount ?? 0);
      setStatus("ready");
    } catch (err) {
      setError(err.message || "Failed to load notifications.");
      setStatus("error");
    }
  }, [unreadOnly, typeFilter, severityFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Client-side fallback filtering in case the query params above weren't
  // applied for some reason (defensive; backend already supports these).
  const visibleItems = useMemo(() => {
    return items.filter((n) => {
      if (unreadOnly && n.isRead) return false;
      if (typeFilter && n.type !== typeFilter) return false;
      if (severityFilter && n.severity !== severityFilter) return false;
      return true;
    });
  }, [items, unreadOnly, typeFilter, severityFilter]);

  async function handleMarkRead(id) {
    setMarkingId(id);
    try {
      await adminMarkNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      setError(err.message || "Failed to mark notification read.");
    } finally {
      setMarkingId(null);
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await adminMarkAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(err.message || "Failed to mark all notifications read.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Notifications"
        description="System and order events that need admin attention."
        actions={
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={markingAll || unreadCount === 0}
            onClick={handleMarkAllRead}
          >
            {markingAll ? "Marking…" : `Mark all read${unreadCount ? ` (${unreadCount})` : ""}`}
          </button>
        }
      />

      <FilterBar className="mb-4">
        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
          Unread only
        </label>
        <FilterSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t.replaceAll("_", " ")}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
          <option value="">All severities</option>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </FilterSelect>
      </FilterBar>

      <AdminCard noPadding>
        {status === "loading" && <LoadingNotice />}
        {status === "error" && <ErrorNotice message={error} onRetry={load} />}
        {status === "ready" && visibleItems.length === 0 && (
          <AdminEmptyState title="No notifications" description="Nothing matches the current filters." />
        )}
        {status === "ready" && visibleItems.length > 0 && (
          <AdminTable
            columns={[
              { key: "status", label: "" },
              { key: "title", label: "Notification" },
              { key: "type", label: "Type" },
              { key: "severity", label: "Severity" },
              { key: "createdAt", label: "Time" },
              { key: "actions", label: "Actions" },
            ]}
          >
            {visibleItems.map((n) => {
              const link = entityLink(n);
              const body = (
                <div>
                  <p className={n.isRead ? "text-charcoal-soft" : "font-semibold text-charcoal"}>{n.title}</p>
                  <p className="text-xs text-charcoal-soft">{n.message}</p>
                </div>
              );
              return (
                <tr key={n.id} className={!n.isRead ? "bg-primary/5" : undefined}>
                  <td>
                    {!n.isRead && <span className="inline-block h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
                  </td>
                  <td>{link ? <Link to={link} className="hover:underline">{body}</Link> : body}</td>
                  <td className="text-xs">{n.type?.replaceAll("_", " ")}</td>
                  <td>
                    <StatusBadge value={n.severity} tone={SEVERITY_TONE[n.severity] || "neutral"} />
                  </td>
                  <td className="text-xs text-charcoal-soft">{new Date(n.createdAt).toLocaleString("en-IN")}</td>
                  <td>
                    {!n.isRead ? (
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost"
                        disabled={markingId === n.id}
                        onClick={() => handleMarkRead(n.id)}
                      >
                        {markingId === n.id ? "Marking…" : "Mark read"}
                      </button>
                    ) : (
                      <span className="text-xs text-charcoal-soft">Read</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        )}
      </AdminCard>
    </div>
  );
}
