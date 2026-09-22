import { NavLink, Outlet } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";

const links = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/collections", label: "Collections" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/settings", label: "Settings" },
];

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-7xl gap-8 px-5 py-10 sm:px-8">
      <aside className="w-56 shrink-0">
        <div className="mb-6">
          <p className="font-serif-display text-lg text-charcoal">Aadya Admin</p>
          <p className="mt-1 text-xs text-charcoal-soft">{admin?.name}</p>
        </div>
        <nav className="flex flex-col gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-sage-light text-green-deep" : "text-charcoal-soft hover:bg-charcoal/5"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
          <button
            onClick={logout}
            className="mt-4 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-charcoal-soft hover:bg-charcoal/5"
          >
            Logout
          </button>
        </nav>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
