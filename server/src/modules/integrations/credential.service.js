import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";

function key() {
  const raw = env.integrationEncryptionKey;
  if (!raw) throw ApiError.badRequest("INTEGRATION_ENCRYPTION_KEY is not configured on this server.");
  const decoded = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (decoded.length !== 32) throw ApiError.badRequest("INTEGRATION_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex key.");
  return decoded;
}
function encrypt(data) { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv); const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64"); }
function decrypt(payload) { try { const packed = Buffer.from(payload, "base64"); if (packed.length < 29) throw new Error("too short"); const decipher = crypto.createDecipheriv("aes-256-gcm", key(), packed.subarray(0, 12)); decipher.setAuthTag(packed.subarray(12, 28)); return JSON.parse(Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString("utf8")); } catch { throw ApiError.badRequest("Stored integration credentials cannot be decrypted. Replace the credentials."); } }
const secretNames = new Set(["keySecret", "webhookSecret", "apiKey", "apiSecret", "bearerToken", "clientSecret"]);
const mask = (value) => value ? `••••••${String(value).slice(-4)}` : null;
export async function saveCredential(provider, environment, data, adminId) { const encryptedData = encrypt(data); const row = await prisma.integrationCredential.upsert({ where: { provider_environment: { provider, environment } }, create: { provider, environment, encryptedData, isActive: data.enabled !== false }, update: { encryptedData, isActive: data.enabled !== false } }); await prisma.adminAuditLog.create({ data: { adminId, action: "INTEGRATION_CREDENTIAL_REPLACED", provider, metadata: { environment } } }); return safeCredential(row, data); }
export async function getCredential(provider, environment, { required = false } = {}) { const row = await prisma.integrationCredential.findUnique({ where: { provider_environment: { provider, environment } } }); if (!row || !row.isActive) { if (required) throw ApiError.badRequest(`${provider} is not configured.`); return null; } return { row, data: decrypt(row.encryptedData) }; }
export function safeCredential(row, data = null) { const fields = data || (() => { try { return decrypt(row.encryptedData); } catch { return {}; } })(); return { provider: row.provider, environment: row.environment, configured: true, isActive: row.isActive, lastTestedAt: row.lastTestedAt, testStatus: row.testStatus, masked: Object.fromEntries(Object.entries(fields).filter(([name]) => secretNames.has(name)).map(([name, value]) => [name, mask(value)])), keyId: fields.keyId || null, merchantLabel: fields.merchantLabel || null }; }
export async function listCredentials() { const rows = await prisma.integrationCredential.findMany({ orderBy: [{ provider: "asc" }, { environment: "asc" }] }); return rows.map((row) => safeCredential(row)); }
export async function disableCredential(provider, environment, adminId) { const row = await prisma.integrationCredential.update({ where: { provider_environment: { provider, environment } }, data: { isActive: false } }); await prisma.adminAuditLog.create({ data: { adminId, action: "INTEGRATION_CREDENTIAL_DISABLED", provider, metadata: { environment } } }); return safeCredential(row); }
export async function deleteCredential(provider, environment, adminId) { await prisma.integrationCredential.delete({ where: { provider_environment: { provider, environment } } }); await prisma.adminAuditLog.create({ data: { adminId, action: "INTEGRATION_CREDENTIAL_DELETED", provider, metadata: { environment } } }); return { deleted: true }; }
export async function markTest(provider, environment, status, adminId) { const row = await prisma.integrationCredential.update({ where: { provider_environment: { provider, environment } }, data: { lastTestedAt: new Date(), testStatus: status } }); await prisma.adminAuditLog.create({ data: { adminId, action: "INTEGRATION_CONNECTION_TESTED", provider, metadata: { environment, status } } }); return safeCredential(row); }
