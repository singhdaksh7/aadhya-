import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { adminNavGroups } from "./navConfig";
import { IconClose, IconChevronDown } from "../icons";

function isPathActive(pathname, to, end) {
  if (!to) return false;
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavItem({ item, onNavigate, collapsed }) {
  const location = useLocation();
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  const childActive = hasChildren && item.children.some((c) => isPathActive(location.pathname, c.to, c.end));
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (hasChildren) {
    const parentActive = item.to
      ? isPathActive(location.pathname, item.to, item.end) || childActive
      : childActive;
    return (
      <div className="admin-nav__item-group">
        <div className={`admin-nav__link admin-nav__link--parent ${parentActive ? "is-active" : ""}`}>
          {item.to ? (
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className="admin-nav__label flex-1"
            >
              {item.label}
            </NavLink>
          ) : (
            <button
              type="button"
              className="admin-nav__label flex-1 text-left"
              onClick={() => setOpen((v) => !v)}
              title={collapsed ? item.label : undefined}
            >
              {item.label}
            </button>
          )}
          {!collapsed && (
            <button
              type="button"
              className="shrink-0 rounded p-0.5 hover:bg-charcoal/5"
              onClick={() => setOpen((v) => !v)}
              aria-label={`Toggle ${item.label}`}
            >
              <IconChevronDown
                className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                width="14"
                height="14"
              />
            </button>
          )}
        </div>
        {open && !collapsed && (
          <div className="admin-nav__children">
            {item.children.map((child) => (
              <NavLink
                key={`${child.to}-${child.label}`}
                to={child.to}
                end={child.end}
                onClick={onNavigate}
                className={({ isActive }) => `admin-nav__link admin-nav__link--child ${isActive ? "is-active" : ""}`}
              >
                <span className="admin-nav__label">{child.label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) => `admin-nav__link ${isActive ? "is-active" : ""}`}
    >
      <span className="admin-nav__label">{item.label}</span>
    </NavLink>
  );
}

export default function AdminSidebar({
  open,
  collapsed,
  onClose,
  onToggleCollapse,
  adminName,
}) {
  return (
    <>
      <div
        className={`admin-sidebar-backdrop ${open ? "is-open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside className={`admin-sidebar ${open ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`}>
        <div className="admin-sidebar__brand">
          <div className="min-w-0">
            <p className="admin-sidebar__logo">Aadya</p>
            {!collapsed && <p className="admin-sidebar__sub">Admin Panel</p>}
          </div>
          <button type="button" className="admin-sidebar__close md:hidden" onClick={onClose} aria-label="Close menu">
            <IconClose className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="admin-sidebar__collapse hidden md:inline-flex"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <IconChevronDown className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : "rotate-90"}`} width="16" height="16" />
          </button>
        </div>

        {!collapsed && adminName && (
          <p className="admin-sidebar__user">{adminName}</p>
        )}

        <nav className="admin-sidebar__nav" aria-label="Admin">
          {adminNavGroups.map((group) => (
            <div key={group.title} className="admin-nav__group">
              {!collapsed && <p className="admin-nav__group-title">{group.title}</p>}
              <div className="admin-nav__group-items">
                {group.items.map((item) => (
                  <NavItem
                    key={item.to || item.label}
                    item={item}
                    onNavigate={onClose}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
