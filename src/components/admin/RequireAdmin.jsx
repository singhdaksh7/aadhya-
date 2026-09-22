import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";

export default function RequireAdmin({ children }) {
  const { status } = useAdminAuth();
  const location = useLocation();

  if (status === "loading") {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-charcoal-soft">Loading…</div>;
  }
  if (status === "unauthenticated") {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
