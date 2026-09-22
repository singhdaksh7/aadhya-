import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyAccessToken } from "../utils/tokens.js";

export async function requireCustomer(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized();
    const payload = verifyAccessToken(token);
    if (payload.type !== "access" || payload.audience !== "customer") throw ApiError.unauthorized();
    const customer = await prisma.customer.findUnique({ where: { id: payload.sub } });
    if (!customer || !customer.isActive) throw ApiError.unauthorized();
    req.customer = { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone };
    next();
  } catch { next(ApiError.unauthorized("Invalid or expired session")); }
}
