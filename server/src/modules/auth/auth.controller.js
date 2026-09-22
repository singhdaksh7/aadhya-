import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { loginSchema } from "./auth.validators.js";
import { loginAdmin, rotateRefreshToken } from "./auth.service.js";
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from "../../utils/tokens.js";

export const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const { accessToken, refreshToken, admin } = await loginAdmin(email, password);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
  ok(res, { accessToken, admin });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  const { accessToken, refreshToken, admin } = await rotateRefreshToken(token);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
  ok(res, { accessToken, admin });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/admin/auth" });
  ok(res, { loggedOut: true });
});

export const me = asyncHandler(async (req, res) => {
  ok(res, { admin: req.admin });
});
