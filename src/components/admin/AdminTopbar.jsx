import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { IconMenu } from "../icons";
import { pageTitleFromPath } from "./navConfig";
import { useAdminAuth } from "../../context/AdminAuthContext";

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

  useEffect(() => {
    const onDoc = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setProfileOpen(false);
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
