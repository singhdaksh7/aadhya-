import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { Button } from "../../components/ui";
import { useAdminAuth } from "../../context/AdminAuthContext";

export default function AdminLogin() {
  const { login, status } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated") {
    return <Navigate to={location.state?.from || "/admin"} replace />;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(location.state?.from || "/admin", { replace: true });
    } catch (err) {
      setError(err.status === 403 ? "This admin account has been deactivated." : "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-3xl border border-charcoal/10 bg-white/60 p-8">
        <h1 className="font-serif-display text-2xl text-charcoal">Admin Login</h1>
        <p className="mt-1 text-sm text-charcoal-soft">Aadya Society commerce admin.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-charcoal/40 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-charcoal/40 focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-terracotta">{error}</p>}

          <Button as="button" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
