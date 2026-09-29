import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { IconMenu } from "../icons";
import { pageTitleFromPath } from "./navConfig";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { adminListNotifications, adminMarkNotificationRead, adminMarkAllNotificationsRead } from "../../lib/api";

const NOTIFICATION_POLL_MS = 30000;

const SEVERITY_STYLES = {
  CRITICAL: "bg-red-100 text-red-700",
  WARNING: "bg-amber-100 text-amber-700",
  INFO: "bg-sky-100 text-sky-700",
};

// Best-effort entity-page link for a notification, based on entityType.
function entityLink(n) {
  if (!n.entityType || !n.entityId) return null;
  switch (n.entityType) {
    case "Product":
    case "ProductVariant":
      return "/admin/inventory/low-stock";
    case "Order":
      return `/admin/orders/${n.entityId}`;
    default:
      return null;
  }
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "A";
}

export default function AdminTopbar({ onMenuClick, collapsed }) {
  const { admin, logout } = useAdminAuth();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const title = pageTitleFromPath(location.pathname);

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await adminListNotifications({ take: 10 });
      setNotifications(res.data || []);
      setUnreadCount(res.meta?.unreadCount ?? 0);
    } catch {
      // Silent — the bell should never break the topbar on a transient failure.
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, NOTIFICATION_POLL_MS);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  async function handleMarkRead(id) {
    try {
      await adminMarkNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Ignore — will reconcile on next poll.
    }
  }

  async function handleMarkAllRead() {
    try {
      await adminMarkAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Ignore — will reconcile on next poll.
    }
  }

  useEffect(() => {
    const onDoc = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setProfileOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  return (
    <header className={`admin-topbar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="admin-topbar__left">
        <button type="button" className="admin-icon-btn" onClick={onMenuClick} aria-label="Toggle sidebar">
          <IconMenu className="h-5 w-5" />
        </button>
        <div>
          <p className="admin-topbar__welcome">Welcome!</p>
          <h1 className="admin-topbar__title">{title}</h1>
        </div>
      </div>

      <div className="admin-topbar__right">
        <Link to="/admin/orders" className="admin-icon-btn" aria-label="Orders" title="Orders">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 8h12l-1 11H7L6 8Z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 8V7a3 3 0 0 1 6 0v1" strokeLinecap="round" />
          </svg>
        </Link>

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            className="admin-icon-btn relative"
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notifications"
            aria-haspopup="menu"
            aria-expanded={notifOpen}
            title="Notifications"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="admin-dropdown w-80 max-h-96 overflow-y-auto" role="menu">
              <div className="flex items-center justify-between px-3 py-2 border-b border-black/5">
                <p className="text-sm font-semibold text-charcoal">Notifications</p>
                {unreadCount > 0 && (
                  <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={handleMarkAllRead}>
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-charcoal-soft">No notifications yet.</p>
              ) : (
                notifications.map((n) => {
                  const link = entityLink(n);
                  const content = (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_STYLES[n.severity] || SEVERITY_STYLES.INFO}`}>
                          {n.severity}
                        </span>
                        <span className="text-[10px] text-charcoal-soft">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className={`text-xs ${n.isRead ? "text-charcoal-soft" : "font-semibold text-charcoal"}`}>{n.title}</p>
                      <p className="text-[11px] text-charcoal-soft">{n.message}</p>
                    </div>
                  );
                  return (
                    <div
                      key={n.id}
                      className={`admin-dropdown__item flex-col items-stretch gap-1 ${!n.isRead ? "bg-primary/5" : ""}`}
                      role="menuitem"
                    >
                      {link ? (
                        <Link to={link} onClick={() => { setNotifOpen(false); if (!n.isRead) handleMarkRead(n.id); }}>
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                      {!n.isRead && (
                        <button
                          type="button"
                          className="self-end text-[10px] font-medium text-primary hover:underline"
                          onClick={() => handleMarkRead(n.id)}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            className="admin-profile-btn"
            onClick={() => setProfileOpen((v) => !v)}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
          >
            <span className="admin-avatar">{initials(admin?.name)}</span>
            <span className="hidden sm:block text-left leading-tight">
              <span className="block text-xs font-semibold text-charcoal">{admin?.name || "Admin"}</span>
              <span className="block text-[10px] uppercase tracking-wider text-charcoal-soft">{admin?.role || "ADMIN"}</span>
            </span>
          </button>
          {profileOpen && (
            <div className="admin-dropdown" role="menu">
              <div className="admin-dropdown__meta">
                <p className="text-sm font-semibold text-charcoal">{admin?.name}</p>
                <p className="text-xs text-charcoal-soft">{admin?.email}</p>
              </div>
              <Link to="/admin/settings" className="admin-dropdown__item" role="menuitem" onClick={() => setProfileOpen(false)}>
                Settings
              </Link>
              <button type="button" className="admin-dropdown__item admin-dropdown__item--danger" role="menuitem" onClick={logout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
