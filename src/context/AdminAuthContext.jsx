import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { adminLogin, adminLogout, adminMe, adminRefresh, setAccessToken } from "../lib/api";

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | authenticated | unauthenticated

  useEffect(() => {
    (async () => {
      try {
        const refreshRes = await adminRefresh();
        setAccessToken(refreshRes.data.accessToken, "admin");
        setAdmin(refreshRes.data.admin);
        setStatus("authenticated");
      } catch {
        setAccessToken(null, "admin");
        setAdmin(null);
        setStatus("unauthenticated");
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await adminLogin(email, password);
    setAccessToken(res.data.accessToken, "admin");
    setAdmin(res.data.admin);
    setStatus("authenticated");
    return res.data.admin;
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminLogout();
    } finally {
      setAccessToken(null, "admin");
      setAdmin(null);
      setStatus("unauthenticated");
    }
  }, []);

  const refreshMe = useCallback(async () => {
    const res = await adminMe();
    setAdmin(res.data.admin);
    return res.data.admin;
  }, []);

  return (
    <AdminAuthContext.Provider value={{ admin, status, login, logout, refreshMe }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
