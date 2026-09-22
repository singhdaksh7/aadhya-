import { prisma } from "../../lib/prisma.js";
import { verifyPassword } from "../../utils/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/tokens.js";
import { ApiError } from "../../utils/ApiError.js";

export async function loginAdmin(email, password) {
  const admin = await prisma.adminUser.findUnique({ where: { email } });

  // Generic message for both "not found" and "wrong password" — never reveal which.
  if (!admin) throw ApiError.unauthorized("Invalid email or password");

  const validPassword = await verifyPassword(password, admin.passwordHash);
  if (!validPassword) throw ApiError.unauthorized("Invalid email or password");

  if (!admin.isActive) throw ApiError.forbidden("This admin account has been deactivated");

  const accessToken = signAccessToken(admin);
  const refreshToken = signRefreshToken(admin);

  return {
    accessToken,
    refreshToken,
    admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
  };
}

export async function rotateRefreshToken(refreshToken) {
  if (!refreshToken) throw ApiError.unauthorized("No refresh token provided");

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const admin = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
  if (!admin || !admin.isActive) throw ApiError.unauthorized();

  const accessToken = signAccessToken(admin);
  const newRefreshToken = signRefreshToken(admin);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
  };
}
