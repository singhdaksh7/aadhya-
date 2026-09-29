import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { notifyAdmin } from "./notify-admin.js";

// Directories we do a writability smoke-test against. Never expose these
// absolute paths in the API response — only booleans.
function storageTargets() {
  return {
    uploads: path.resolve(process.cwd(), env.uploads.dir),
    books: path.resolve(process.cwd(), "private", "books"),
    invoices: path.resolve(process.env.PRIVATE_INVOICE_DIR || "private/invoices"),
  };
}

async function checkDirWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.health-check-${crypto.randomUUID()}.tmp`);
    fs.writeFileSync(probe, "ok");
    fs.rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkIntegration(provider) {
  try {
    const row = await prisma.integrationCredential.findFirst({
      where: { provider, isActive: true },
      select: { testStatus: true, lastTestedAt: true },
    });
    return {
      configured: Boolean(row),
      lastTestStatus: row?.testStatus || null,
      lastTestedAt: row?.lastTestedAt || null,
    };
  } catch {
    return { configured: false, lastTestStatus: null, lastTestedAt: null };
  }
}

// Backup metadata: written by scripts/backup-production.sh after every run.
// Never assume the file exists (e.g. fresh dev checkout, or the backup has
// never run) — return a clear "no data yet" shape instead.
function readBackupMetadata() {
  const metadataPath = process.env.BACKUP_METADATA_FILE || path.resolve(process.cwd(), "..", "backups", "backup-metadata.json");
  const candidates = [metadataPath, path.resolve(process.cwd(), "backups", "backup-metadata.json")];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, "utf8");
        const parsed = JSON.parse(raw);
        return {
          available: true,
          lastRunAt: parsed.lastRunAt || null,
          status: parsed.status || "unknown",
          sizeBytes: parsed.sizeBytes ?? null,
        };
      }
    } catch {
      // fall through to next candidate / final "no data" shape
    }
  }
  return { available: false, lastRunAt: null, status: "no_data", sizeBytes: null };
}

// In-memory recent-error tracker fed by the error-handling middleware. Not
// persisted — resets on process restart, which is fine for a "recent 5xx
// spikes" signal on a single-instance deploy. Kept tiny and dependency-free
// so importing it from errorHandler.js carries no risk to other modules.
const recent5xx = [];
const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function recordServerError() {
  const now = Date.now();
  recent5xx.push(now);
  while (recent5xx.length && now - recent5xx[0] > FIVE_MINUTES_MS) {
    recent5xx.shift();
  }
  // Simple spike heuristic: 10+ 5xxs in a 5-minute window.
  if (recent5xx.length === 10) {
    notifyAdmin({
      type: "SYSTEM_WARNING",
      title: "Elevated server error rate",
      message: `${recent5xx.length} server errors (5xx) in the last 5 minutes.`,
      severity: "WARNING",
    }).catch(() => {});
  }
}

export function get5xxCountLast5Min() {
  const now = Date.now();
  while (recent5xx.length && now - recent5xx[0] > FIVE_MINUTES_MS) {
    recent5xx.shift();
  }
  return recent5xx.length;
}

export async function getInternalHealth() {
  const targets = storageTargets();

  const [dbOk, uploadsWritable, booksWritable, invoicesWritable, razorpay, shiprocket] = await Promise.all([
    checkDatabase(),
    checkDirWritable(targets.uploads),
    checkDirWritable(targets.books),
    checkDirWritable(targets.invoices),
    checkIntegration("RAZORPAY"),
    checkIntegration("SHIPROCKET"),
  ]);

  const backup = readBackupMetadata();

  // Recent failed webhook events (best-effort — WebhookEvent only logs
  // processed events today, so this is a coarse "recent activity" signal,
  // not a dedicated failure log). Read-only, no schema changes made here.
  let recentWebhookEvents = null;
  try {
    recentWebhookEvents = await prisma.webhookEvent.count({
      where: { processedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
  } catch {
    recentWebhookEvents = null;
  }

  const overallOk = dbOk && uploadsWritable && booksWritable && invoicesWritable;

  return {
    status: overallOk ? "ok" : "degraded",
    checkedAt: new Date().toISOString(),
    database: { ok: dbOk },
    storage: {
      uploads: uploadsWritable,
      books: booksWritable,
      invoices: invoicesWritable,
    },
    email: { smtpConfigured: env.smtp.isConfigured },
    integrations: {
      razorpay: { configured: env.razorpay.isConfigured || razorpay.configured, lastTestStatus: razorpay.lastTestStatus },
      shiprocket: { configured: shiprocket.configured, lastTestStatus: shiprocket.lastTestStatus },
    },
    backup,
    monitoring: {
      recentServerErrors5xxLast5Min: get5xxCountLast5Min(),
      recentWebhookEventsLast24h: recentWebhookEvents,
    },
  };
}
