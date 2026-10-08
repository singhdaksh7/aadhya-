// Minimal Admin API client for the demo-content scripts. Everything goes through the normal
// authenticated admin endpoints (no direct database access).
//
//   API_BASE=https://api-store.example.com/api ADMIN_EMAIL=... ADMIN_PASSWORD=... node <script>
//
// Credentials are read from the environment only and are never written anywhere.

export const API_BASE = (process.env.API_BASE || "http://localhost:4100/api").replace(/\/$/, "");

export async function adminLogin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (an existing admin account) to run this script.");
  const res = await fetch(`${API_BASE}/admin/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Admin login failed (${res.status}): ${body.error || body.message || "unknown error"}`);
  const token = body.data?.accessToken;
  if (!token) throw new Error("Admin login returned no access token");
  return token;
}

export function client(token) {
  const call = async (method, path, payload, { form } = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(form || payload === undefined ? {} : { "content-type": "application/json" }) },
      body: form || (payload === undefined ? undefined : JSON.stringify(payload)),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${body.error || body.message || JSON.stringify(body).slice(0, 200)}`);
    return body;
  };
  return {
    get: (p) => call("GET", p),
    post: (p, b) => call("POST", p, b),
    put: (p, b) => call("PUT", p, b),
    upload: (p, form) => call("POST", p, undefined, { form }),
  };
}

export async function publicGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (res.status === 404) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return body;
}
