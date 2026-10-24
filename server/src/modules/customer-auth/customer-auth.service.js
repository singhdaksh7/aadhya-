import { notifyAccountCreated } from "../mailer/mailer.service.js";
import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import { hashToken } from "../../utils/secureToken.js";
import { signCustomerAccessToken } from "../../utils/tokens.js";

const expiry = () => new Date(Date.now() + 7 * 86400000);
const raw = () => crypto.randomBytes(24).toString("hex");
const rawRefresh = () => crypto.randomBytes(32).toString("hex");
const safe = (c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, emailVerifiedAt: c.emailVerifiedAt, requiresPasswordSetup: !c.passwordSetAt });
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
      // A sequential interactive transaction can exhaust a one-connection
      // test/database pool when two registrations race. Generate the UUID
      // up front and use Prisma's batch transaction instead: both writes are
      // still atomic, without holding a connection across callback awaits.
      const customerId = crypto.randomUUID();
      const [customer] = await prisma.$transaction([
        prisma.customer.create({ data: { id: customerId, name: input.name, email: input.email, phone: input.phone || null, passwordHash, passwordSetAt: new Date() } }),
        prisma.customerRefreshSession.create({ data: { ...refresh.data, customerId } }),
      ]);
      // Welcome email: once per account, never blocks or fails registration.
      await notifyAccountCreated(customer, { guest: false });
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
  if (!session) throw ApiError.unauthorized("Invalid or expired session");
  if (session.revokedAt) {
    // Reuse of an already-rotated refresh token: either a benign race (a
    // retried request) or a stolen token being replayed after the
    // legitimate client already rotated past it. We can't tell which, so
    // treat it as theft and revoke every session for this customer,
    // forcing a fresh login everywhere.
    await prisma.customerRefreshSession.updateMany({
      where: { customerId: session.customerId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw ApiError.unauthorized("Invalid or expired session");
  }
  if (session.expiresAt <= new Date() || !session.customer.isActive) throw ApiError.unauthorized("Invalid or expired session");
  await prisma.customerRefreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  return createSession(session.customer, userAgent);
}

export async function logout(token) { if (token) await prisma.customerRefreshSession.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } }); }
export async function updateProfile(id, input) { return safe(await prisma.customer.update({ where: { id }, data: { name: input.name, phone: input.phone || null } })); }
export async function changePassword(id, input) { const c = await prisma.customer.findUnique({ where: { id } }); if (!c || !(await verifyPassword(input.currentPassword, c.passwordHash))) throw ApiError.unauthorized("Current password is incorrect."); await prisma.$transaction([prisma.customer.update({ where: { id }, data: { passwordHash: await hashPassword(input.newPassword), passwordSetAt: new Date() } }), prisma.customerRefreshSession.updateMany({ where: { customerId: id, revokedAt: null }, data: { revokedAt: new Date() } })]); }
export async function createReset(email) { const c = await prisma.customer.findUnique({ where: { email } }); if (!c) return null; const token = raw(); await prisma.passwordResetToken.deleteMany({ where: { customerId: c.id, usedAt: null } }); await prisma.passwordResetToken.create({ data: { customerId: c.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600000) } }); return { customer: c, token }; }
export async function resetPassword(input) { const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(input.token) } }); if (!row || row.usedAt || row.expiresAt <= new Date()) throw ApiError.badRequest("This password reset link is invalid or expired."); await prisma.$transaction([prisma.customer.update({ where: { id: row.customerId }, data: { passwordHash: await hashPassword(input.newPassword), passwordSetAt: new Date() } }), prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }), prisma.customerRefreshSession.updateMany({ where: { customerId: row.customerId, revokedAt: null }, data: { revokedAt: new Date() } })]); }

// ---------------------------------------------------------------------------
// One-time email login codes (used first by accounts auto-created from guest orders, but available to
// every customer). The response to a code request is always generic so it cannot be used to discover
// which emails have accounts.
// ---------------------------------------------------------------------------
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_HOURLY_LIMIT = 5;
const otpHash = (customerId, code) => crypto.createHmac("sha256", env.jwt.accessSecret).update(`otp:${customerId}:${code}`).digest("hex");

export async function createLoginOtp(email) {
  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer || !customer.isActive) return null;
  const now = Date.now();
  const recent = await prisma.customerLoginOtp.findMany({
    where: { customerId: customer.id, createdAt: { gt: new Date(now - 3600000) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recent.length >= OTP_HOURLY_LIMIT) return null;
  if (recent[0] && now - recent[0].createdAt.getTime() < OTP_COOLDOWN_MS) return null;
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await prisma.$transaction([
    prisma.customerLoginOtp.updateMany({ where: { customerId: customer.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.customerLoginOtp.create({ data: { customerId: customer.id, codeHash: otpHash(customer.id, code), expiresAt: new Date(now + OTP_TTL_MS) } }),
  ]);
  return { customer, code };
}

export async function verifyLoginOtp({ email, code }, userAgent) {
  const fail = () => ApiError.unauthorized("That code is invalid or has expired. Please request a new one.");
  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer || !customer.isActive) throw fail();
  const otp = await prisma.customerLoginOtp.findFirst({
    where: { customerId: customer.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) throw fail();
  const expected = Buffer.from(otpHash(customer.id, code), "hex");
  const stored = Buffer.from(otp.codeHash, "hex");
  if (expected.length !== stored.length || !crypto.timingSafeEqual(expected, stored)) {
    await prisma.customerLoginOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw fail();
  }
  const consumed = await prisma.customerLoginOtp.updateMany({ where: { id: otp.id, usedAt: null }, data: { usedAt: new Date() } });
  if (consumed.count !== 1) throw fail();
  const verified = customer.emailVerifiedAt ? customer : await prisma.customer.update({ where: { id: customer.id }, data: { emailVerifiedAt: new Date() } });
  return createSession(verified, userAgent);
}

// First-time password for an account that has only ever used email codes. Requires an authenticated
// session (which the OTP login provides) and only works while no password has been chosen.
export async function setInitialPassword(id, newPassword) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer || !customer.isActive) throw ApiError.unauthorized();
  if (customer.passwordSetAt) throw ApiError.badRequest("A password is already set. Use Change password instead.");
  const updated = await prisma.customer.update({ where: { id }, data: { passwordHash: await hashPassword(newPassword), passwordSetAt: new Date() } });
  return safe(updated);
}
