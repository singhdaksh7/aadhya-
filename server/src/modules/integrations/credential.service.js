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
const secretNames = new Set(["keySecret", "webhookSecret", "apiKey", "apiSecret", "apiPassword", "bearerToken", "clientSecret"]);
const mask = (value) => value ? `••••••${String(value).slice(-4)}` : null;
export async function saveCredential(provider, environment, data, adminId) { const encryptedData = encrypt(data); const row = await prisma.integrationCredential.upsert({ where: { provider_environment: { provider, environment } }, create: { provider, environment, encryptedData, isActive: data.enabled !== false }, update: { encryptedData, isActive: data.enabled !== false } }); await prisma.adminAuditLog.create({ data: { adminId, action: "INTEGRATION_CREDENTIAL_REPLACED", provider, metadata: { environment } } }); return safeCredential(row, data); }
export async function getCredential(provider, environment, { required = false } = {}) { const row = await prisma.integrationCredential.findUnique({ where: { provider_environment: { provider, environment } } }); if (!row || !row.isActive) { if (required) throw ApiError.badRequest(`${provider} is not configured.`); return null; } return { row, data: decrypt(row.encryptedData) }; }
export function safeCredential(row, data = null) { const fields = data || (() => { try { return decrypt(row.encryptedData); } catch { return {}; } })(); return { provider: row.provider, environment: row.environment, configured: true, isActive: row.isActive, lastTestedAt: row.lastTestedAt, testStatus: row.testStatus, masked: Object.fromEntries(Object.entries(fields).filter(([name]) => secretNames.has(name)).map(([name, value]) => [name, mask(value)])), keyId: fields.keyId || null, merchantLabel: fields.merchantLabel || null }; }
export async function listCredentials() { const rows = (await prisma.integrationCredential.findMany({ orderBy: [{ provider: "asc" }, { environment: "asc" }] })).filter((row) => !row.provider.endsWith("_MODE")); return rows.map((row) => safeCredential(row)); }
export async function disableCredential(provider, environment, adminId) { const row = await prisma.integrationCredential.update({ where: { provider_environment: { provider, environment } }, data: { isActive: false } }); await prisma.adminAuditLog.create({ data: { adminId, action: "INTEGRATION_CREDENTIAL_DISABLED", provider, metadata: { environment } } }); return safeCredential(row); }
export async function deleteCredential(provider, environment, adminId) { await prisma.integrationCredential.delete({ where: { provider_environment: { provider, environment } } }); await prisma.adminAuditLog.create({ data: { adminId, action: "INTEGRATION_CREDENTIAL_DELETED", provider, metadata: { environment } } }); return { deleted: true }; }
export async function markTest(provider, environment, status, adminId) { const row = await prisma.integrationCredential.update({ where: { provider_environment: { provider, environment } }, data: { lastTestedAt: new Date(), testStatus: status } }); await prisma.adminAuditLog.create({ data: { adminId, action: "INTEGRATION_CONNECTION_TESTED", provider, metadata: { environment, status } } }); return safeCredential(row); }

// ---------------------------------------------------------------------------
// Partial updates, mode selection and write-only secret helpers (Admin
// Integrations Center). Secrets only ever flow INTO these functions; nothing
// here returns a stored secret, and audit metadata records field NAMES only.
// ---------------------------------------------------------------------------
const audit = (adminId, action, provider, metadata) => prisma.adminAuditLog.create({ data: { adminId, action, provider, metadata } });

// Merge `patch` over whatever is stored for provider/environment. Empty/undefined
// patch values keep the stored value, so Admin can replace one secret without
// re-entering the others. `enabled` toggles isActive and is not stored in the blob.
export async function updateCredential(provider, environment, patch, adminId, { auditAction } = {}) {
  const row = await prisma.integrationCredential.findUnique({ where: { provider_environment: { provider, environment } } });
  let current = {};
  if (row) {
    try { current = decrypt(row.encryptedData); } catch { current = {}; }
  }
  const { enabled, ...fields } = patch;
  const changedFields = Object.entries(fields).filter(([, v]) => v !== undefined && v !== "").map(([k]) => k);
  const merged = { ...current };
  for (const name of changedFields) merged[name] = fields[name];
  if (typeof enabled === "boolean") merged.enabled = enabled;
  const isActive = typeof enabled === "boolean" ? enabled : row ? row.isActive : true;
  const encryptedData = encrypt(merged);
  const saved = await prisma.integrationCredential.upsert({
    where: { provider_environment: { provider, environment } },
    create: { provider, environment, encryptedData, isActive },
    update: { encryptedData, isActive },
  });
  await audit(adminId, auditAction || "INTEGRATION_CREDENTIAL_REPLACED", provider, { environment, changedFields, ...(typeof enabled === "boolean" ? { enabled } : {}) });
  return safeCredential(saved, merged);
}

// Presence-only view used by the Admin summary: booleans and masks, never values.
export async function describeCredential(provider, environment) {
  const row = await prisma.integrationCredential.findUnique({ where: { provider_environment: { provider, environment } } });
  if (!row) return null;
  let data = {};
  let decryptable = true;
  try { data = decrypt(row.encryptedData); } catch { decryptable = false; }
  return {
    row,
    decryptable,
    keyId: data.keyId || null,
    keySecretMask: mask(data.keySecret),
    webhookSecretMask: mask(data.webhookSecret),
    hasKeySecret: Boolean(data.keySecret),
    hasWebhookSecret: Boolean(data.webhookSecret),
  };
}

// Active-mode record: "<PROVIDER>_MODE"/"DEFAULT" holds non-secret selection state.
export async function getActiveEnvironment(provider) {
  const row = await prisma.integrationCredential.findUnique({ where: { provider_environment: { provider: `${provider}_MODE`, environment: "DEFAULT" } } });
  if (!row) return null;
  try { return decrypt(row.encryptedData).activeEnvironment || null; } catch { return null; }
}
export async function setActiveEnvironment(provider, environment, adminId) {
  const encryptedData = encrypt({ activeEnvironment: environment });
  await prisma.integrationCredential.upsert({
    where: { provider_environment: { provider: `${provider}_MODE`, environment: "DEFAULT" } },
    create: { provider: `${provider}_MODE`, environment: "DEFAULT", encryptedData, isActive: true },
    update: { encryptedData, isActive: true },
  });
  await audit(adminId, "INTEGRATION_MODE_CHANGED", provider, { environment });
}

// Cryptographically secure webhook secret, returned ONCE to the caller. 32 random
// bytes = 256 bits of entropy, URL-safe so it pastes cleanly into Razorpay.
export function generateWebhookSecret() {
  return crypto.randomBytes(32).toString("base64url");
}
export const recordSecretAudit = audit;
