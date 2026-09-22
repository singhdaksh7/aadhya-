import { ApiError } from "../utils/ApiError.js";
import { verifyAccessToken } from "../utils/tokens.js";
import { prisma } from "../lib/prisma.js";

export async function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized();

    const payload = verifyAccessToken(token);
    if (payload.type !== "access" || payload.audience !== "admin") throw ApiError.unauthorized();

    const admin = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
    if (!admin || !admin.isActive) throw ApiError.unauthorized();

    req.admin = { id: admin.id, email: admin.email, role: admin.role, name: admin.name };
    next();
  } catch {
    next(ApiError.unauthorized("Invalid or expired session"));
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return next(ApiError.forbidden());
    }
    next();
  };
}
