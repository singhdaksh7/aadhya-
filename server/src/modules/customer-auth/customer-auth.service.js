import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { hashToken } from "../../utils/secureToken.js";
import { signCustomerAccessToken } from "../../utils/tokens.js";

const expiry = () => new Date(Date.now() + 7 * 86400000);
const raw = () => crypto.randomBytes(24).toString("hex");
const rawRefresh = () => crypto.randomBytes(32).toString("hex");
const safe = (c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, emailVerifiedAt: c.emailVerifiedAt });
const isUniqueViolation = (error, field) => error?.code === "P2002" && (!field || error.meta?.target?.includes(field));

function refreshSessionData(customerId, userAgent) {
  const refreshToken = rawRefresh();
  return {
    refreshToken,
    data: { customerId, tokenHash: hashToken(refreshToken), expiresAt: expiry(), userAgent: userAgent?.slice(0, 500) },
  };
}

async function createSession(customer, userAgent) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const session = refreshSessionData(customer.id, userAgent);
    try {
      await prisma.customerRefreshSession.create({ data: session.data });
      return { accessToken: signCustomerAccessToken(customer), refreshToken: session.refreshToken, customer: safe(customer) };
    } catch (error) {
      if (!isUniqueViolation(error, "tokenHash") || attempt === 2) throw error;
    }
  }
}

export async function register(input, userAgent) {
  const passwordHash = await hashPassword(input.password);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const refresh = refreshSessionData(undefined, userAgent);
    try {
      const customer = await prisma.$transaction(async (tx) => {
        const created = await tx.customer.create({
          data: { name: input.name, email: input.email, phone: input.phone || null, passwordHash },
        });
        try {
          await tx.customerRefreshSession.create({ data: { ...refresh.data, customerId: created.id } });
        } catch (error) {
          error.registrationStage = "session";
          throw error;
        }
        return created;
      });
      return { accessToken: signCustomerAccessToken(customer), refreshToken: refresh.refreshToken, customer: safe(customer) };
    } catch (error) {
      if (isUniqueViolation(error, "email")) throw ApiError.conflict("An account with this email already exists.");
      if (isUniqueViolation(error, "tokenHash") && attempt < 2) continue;
      throw error;
    }
  }
}

export async function login(input, userAgent) {
  const customer = await prisma.customer.findUnique({ where: { email: input.email } });
  if (!customer || !(await verifyPassword(input.password, customer.passwordHash)) || !customer.isActive) throw ApiError.unauthorized("Invalid email or password.");
  return createSession(customer, userAgent);
}

export async function refresh(token, userAgent) {
  if (!token) throw ApiError.unauthorized();
  const session = await prisma.customerRefreshSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { customer: true } });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.customer.isActive) throw ApiError.unauthorized("Invalid or expired session");
  await prisma.customerRefreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  return createSession(session.customer, userAgent);
}

export async function logout(token) { if (token) await prisma.customerRefreshSession.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } }); }
export async function updateProfile(id, input) { return safe(await prisma.customer.update({ where: { id }, data: { name: input.name, phone: input.phone || null } })); }
export async function changePassword(id, input) { const c = await prisma.customer.findUnique({ where: { id } }); if (!c || !(await verifyPassword(input.currentPassword, c.passwordHash))) throw ApiError.unauthorized("Current password is incorrect."); await prisma.$transaction([prisma.customer.update({ where: { id }, data: { passwordHash: await hashPassword(input.newPassword) } }), prisma.customerRefreshSession.updateMany({ where: { customerId: id, revokedAt: null }, data: { revokedAt: new Date() } })]); }
export async function createReset(email) { const c = await prisma.customer.findUnique({ where: { email } }); if (!c) return null; const token = raw(); await prisma.passwordResetToken.deleteMany({ where: { customerId: c.id, usedAt: null } }); await prisma.passwordResetToken.create({ data: { customerId: c.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600000) } }); return { customer: c, token }; }
export async function resetPassword(input) { const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(input.token) } }); if (!row || row.usedAt || row.expiresAt <= new Date()) throw ApiError.badRequest("This password reset link is invalid or expired."); await prisma.$transaction([prisma.customer.update({ where: { id: row.customerId }, data: { passwordHash: await hashPassword(input.newPassword) } }), prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }), prisma.customerRefreshSession.updateMany({ where: { customerId: row.customerId, revokedAt: null }, data: { revokedAt: new Date() } })]); }
