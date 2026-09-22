import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signAccessToken(admin) {
  return jwt.sign({ sub: admin.id, role: admin.role, type: "access", audience: "admin" }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  });
}

export function signRefreshToken(admin) {
  return jwt.sign({ sub: admin.id, type: "refresh", audience: "admin" }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

export const REFRESH_COOKIE_NAME = "admin_refresh_token";
export const CUSTOMER_REFRESH_COOKIE_NAME = "customer_refresh_token";

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/api/admin/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function customerRefreshCookieOptions() {
  return { ...refreshCookieOptions(), path: "/api/auth" };
}

export function signCustomerAccessToken(customer) {
  return jwt.sign({ sub: customer.id, type: "access", audience: "customer" }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  });
}
