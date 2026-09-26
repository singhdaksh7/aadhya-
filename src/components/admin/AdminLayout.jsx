import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { IconMenu, IconClose } from "../icons";

const linkGroups = [
  {
    title: "CONTENT",
    items: [
      { to: "/admin", label: "Dashboard", end: true },
      { to: "/admin/homepage-builder", label: "Homepage Builder" },
      { to: "/admin/banners", label: "Banners" },
      { to: "/admin/promos", label: "Promo Ticker" },
      { to: "/admin/pages", label: "Pages (CMS)" },
      { to: "/admin/blog", label: "Blog Journal" },
      { to: "/admin/faqs", label: "FAQ CMS" },
      { to: "/admin/media", label: "Media Library" },
    ],
  },
  {
    title: "COMMERCE",
    items: [
      { to: "/admin/products", label: "Products" },
      { to: "/admin/categories", label: "Categories" },
      { to: "/admin/collections", label: "Collections" },
      { to: "/admin/coupons", label: "Coupons" },
      { to: "/admin/orders", label: "Orders" },
    ],
  },
  {
    title: "WEBSITE & SETTINGS",
    items: [
      { to: "/admin/navigation", label: "Navigation" },
      { to: "/admin/settings", label: "Store Settings" },
    ],
  },
];

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    if (mobileOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
      {/* Mobile Admin Header (<768px) */}
      <div className="mb-6 flex items-center justify-between border-b border-charcoal/10 pb-4 md:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-xl border border-charcoal/15 bg-white p-2 text-charcoal shadow-sm hover:bg-charcoal/5"
            aria-label="Open Admin Menu"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <div>
            <p className="font-serif-display text-base text-charcoal">Aadya Admin</p>
            <p className="text-[11px] text-charcoal-soft">{admin?.name}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="rounded-full border border-charcoal/20 bg-white px-3 py-1 text-xs font-semibold text-charcoal hover:border-terracotta hover:text-terracotta"
        >
          Logout
        </button>
      </div>

      {/* Mobile Slide-out Navigation Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-ivory p-6 shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-4">
              <div>
                <p className="font-serif-display text-lg text-charcoal">Aadya Admin</p>
                <p className="text-xs text-charcoal-soft">{admin?.name}</p>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-full p-2 text-charcoal-soft hover:bg-charcoal/5"
                aria-label="Close menu"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-6 flex flex-col gap-4">
              {linkGroups.map((group) => (
                <div key={group.title} className="space-y-1">
                  <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-terracotta">{group.title}</p>
                  {group.items.map((l) => (
                    <NavLink
                      key={l.to}
                      to={l.to}
                      end={l.end}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `block rounded-xl px-3 py-2 text-xs font-medium transition ${
                          isActive ? "bg-sage-light text-green-deep font-semibold" : "text-charcoal-soft hover:bg-charcoal/5"
                        }`
                      }
                    >
                      {l.label}
                    </NavLink>
                  ))}
                </div>
              ))}
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="mt-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-terracotta hover:bg-terracotta/10"
              >
                Logout
              </button>
            </nav>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-8 md:flex-row min-h-[75vh]">
        {/* Desktop Sidebar (>=768px) */}
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="mb-6">
            <p className="font-serif-display text-lg text-charcoal">Aadya Admin</p>
            <p className="mt-1 text-xs text-charcoal-soft">{admin?.name}</p>
          </div>
          <nav className="flex flex-col gap-5">
            {linkGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-terracotta/90 mb-1.5">{group.title}</p>
                {group.items.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    end={l.end}
                    className={({ isActive }) =>
                      `block rounded-xl px-3 py-2 text-xs font-medium transition ${
                        isActive ? "bg-sage-light text-green-deep font-semibold" : "text-charcoal-soft hover:bg-charcoal/5"
                      }`
                    }
                  >
                    {l.label}
                  </NavLink>
                ))}
              </div>
            ))}
            <button
              onClick={logout}
              className="mt-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-charcoal-soft hover:bg-charcoal/5"
            >
              Logout
            </button>
          </nav>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

