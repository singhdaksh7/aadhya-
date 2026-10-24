import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { getStoreName } from "../../lib/storeName.js";
import { getCredential } from "../integrations/credential.service.js";
import { readInvoicePdf } from "../invoices/invoice.storage.js";
import { ApiError } from "../../utils/ApiError.js";

let cachedMailer = null;
let cachedMailerKey = "";

// Effective SMTP settings: the Admin-managed credential (Admin -> Integrations -> Email, secrets encrypted
// at rest) wins; the SMTP_* environment variables remain as a fallback so existing deployments keep working.
export async function getSmtpConfig() {
  let stored = null;
  try {
    const cred = await getCredential("SMTP", "DEFAULT");
    if (cred?.data?.host) stored = cred.data;
  } catch { stored = null; }
  if (stored) {
    const port = Number(stored.port) || 587;
    const encryption = ["SSL_TLS", "STARTTLS", "NONE"].includes(stored.encryption) ? stored.encryption : port === 465 ? "SSL_TLS" : "STARTTLS";
    const fromEmail = stored.fromEmail || stored.user || "";
    const fromName = String(stored.fromName || (await getStoreName())).replace(/["<>\r\n]/g, "");
    return { configured: true, source: "admin", host: stored.host, port, encryption, user: stored.user || "", pass: stored.apiPassword || "", from: fromEmail ? `"${fromName}" <${fromEmail}>` : env.smtp.from, replyTo: stored.replyTo || "" };
  }
  if (env.smtp.isConfigured) {
    const port = env.smtp.port;
    return { configured: true, source: "env", host: env.smtp.host || process.env.SMTP_HOST, port, encryption: port === 465 ? "SSL_TLS" : "STARTTLS", user: env.smtp.user, pass: env.smtp.pass, replyTo: "" };
  }
  return { configured: false, source: "none" };
}

async function getMailer() {
  const cfg = await getSmtpConfig();
  if (!cfg.configured) return { mailer: null };
  const key = JSON.stringify([cfg.host, cfg.port, cfg.encryption, cfg.user, cfg.pass, cfg.from, cfg.replyTo]);
  if (!cachedMailer || cachedMailerKey !== key) {
    cachedMailerKey = key;
    cachedMailer = nodemailer.createTransport(
      {
        host: cfg.host,
        port: cfg.port,
        secure: cfg.encryption === "SSL_TLS",
        requireTLS: cfg.encryption === "STARTTLS",
        ignoreTLS: cfg.encryption === "NONE",
        auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      },
      { from: cfg.from, ...(cfg.replyTo ? { replyTo: cfg.replyTo } : {}) }
    );
  }
  return { mailer: cachedMailer };
}

// The single low-level send used by every transactional email (see modules/notifications). Records one
// EmailLog row per attempt: recipient, event, subject, outcome and a safe provider message id. It never
// stores bodies, login codes, reset links or SMTP credentials, and never throws: callers decide what a
// failed email means (order/payment/shipment state must never depend on it).
export async function deliverEmail({ to, subject, html, text, type, event = null, orderId = null, source = null, notificationId = null }) {
  const cfg = await getSmtpConfig();
  const { mailer } = await getMailer();
  const logBase = { type, event: event || type, recipient: to, orderId, subject: String(subject || "").slice(0, 200), source, notificationId };
  const writeLog = async (data) => {
    try {
      await prisma.emailLog.create({ data: { ...logBase, ...data } });
    } catch (writeErr) {
      if (!isMissingParentRow(writeErr)) console.error("[email] could not write email log:", writeErr.message);
    }
  };
  if (!mailer) {
    await writeLog({ status: "SKIPPED", failureMessage: "SMTP not configured" });
    return { sent: false, reason: "smtp_not_configured", error: "SMTP not configured" };
  }
  try {
    const info = await mailer.sendMail({ to, subject, html, text });
    await writeLog({ status: "SENT", providerMessageId: info?.messageId || null, sentAt: new Date() });
    return { sent: true, messageId: info?.messageId || null };
  } catch (err) {
    let message = String(err?.message || "send failed");
    if (cfg.pass) message = message.split(cfg.pass).join("***");
    message = message.slice(0, 300);
    console.error(`[email] ${type} to ${to} failed:`, message);
    await writeLog({ status: "FAILED", failureMessage: message });
    return { sent: false, reason: "send_failed", error: message };
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// `emailedAt` is an atomic send claim for automatic mail. A webhook retry
// cannot produce a second invoice email; an explicit admin resend bypasses
// the claim and is separately recorded in EmailLog/AuditLog.
// Invoice/order rows can be gone by the time this settles (e.g. an admin
// deletes the order, or — in tests — the next test's teardown runs before
// this detached dispatch finishes). Treat that as a safe no-op rather than
// an unhandled failure, the same way shipment webhooks treat an unknown
// shipment: the email was never going to be deliverable anyway.
function isMissingParentRow(err) {
  return err?.code === "P2025" || err?.code === "P2003";
}

export async function sendInvoiceEmail(invoiceId, { resend = false, adminId = null } = {}) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { order: true } });
  if (!invoice) return { sent: false, reason: "invoice_not_found" };
  if (!resend) {
    let claim;
    try {
      claim = await prisma.invoice.updateMany({ where: { id: invoiceId, emailedAt: null }, data: { emailedAt: new Date() } });
    } catch (err) {
      if (isMissingParentRow(err)) return { sent: false, reason: "invoice_not_found" };
      throw err;
    }
    if (!claim.count) return { sent: false, reason: "already_emailed" };
  }
  const { mailer } = await getMailer();
  try {
    if (!mailer) {
      if (!resend) await prisma.invoice.update({ where: { id: invoiceId }, data: { emailedAt: null } });
      await prisma.emailLog.create({ data: { type: "INVOICE", recipient: invoice.customerEmail, orderId: invoice.orderId, invoiceId, status: "SKIPPED", failureMessage: "SMTP not configured" } });
      return { sent: false, reason: "smtp_not_configured" };
    }
    const attachment = invoice.pdfStorageKey ? await readInvoicePdf(invoice.pdfStorageKey) : null;
    const info = await mailer.sendMail({
      to: invoice.customerEmail,
      subject: `Your Tushaqsa Invoice — ${invoice.invoiceNumber}`,
      html: `<div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#2b2723"><h1>Your Tushaqsa invoice</h1><p>Hello ${escapeHtml(invoice.customerName)},</p><p>Invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> for order <strong>${escapeHtml(invoice.order.orderNumber)}</strong> is attached.</p><p>Total: <strong>₹${Number(invoice.totalAmount).toLocaleString("en-IN")}</strong><br/>Payment method: ${escapeHtml(invoice.order.paymentMethod)}</p><p><a href="${env.frontendUrl.replace(/\/$/, "")}/account/orders/${encodeURIComponent(invoice.order.orderNumber)}">View your order</a></p><p style="margin-top:24px;color:#4a443d">Team Tushaqsa</p></div>`,
      attachments: attachment ? [{ filename: `${invoice.invoiceNumber.replace(/[^A-Za-z0-9._-]/g, "-")}.pdf`, content: attachment.stream, contentType: "application/pdf" }] : [],
    });
    if (resend) await prisma.invoice.update({ where: { id: invoiceId }, data: { emailedAt: invoice.emailedAt || new Date() } });
    await prisma.emailLog.create({ data: { type: resend ? "INVOICE_RESEND" : "INVOICE", recipient: invoice.customerEmail, orderId: invoice.orderId, invoiceId, status: "SENT", providerMessageId: info.messageId || null, sentAt: new Date() } });
    if (adminId && resend) await prisma.adminAuditLog.create({ data: { adminId, action: "INVOICE_RESEND", provider: "email", metadata: { invoiceId } } });
    return { sent: true };
  } catch (err) {
    if (isMissingParentRow(err)) return { sent: false, reason: "invoice_not_found" };
    try {
      if (!resend) await prisma.invoice.update({ where: { id: invoiceId }, data: { emailedAt: null } });
      await prisma.emailLog.create({ data: { type: resend ? "INVOICE_RESEND" : "INVOICE", recipient: invoice.customerEmail, orderId: invoice.orderId, invoiceId, status: "FAILED", failureMessage: String(err.message || "send failed").slice(0, 500) } });
    } catch (writeErr) {
      if (!isMissingParentRow(writeErr)) throw writeErr;
    }
    console.error("[email] invoice email failed:", err.message);
    return { sent: false, reason: "send_failed" };
  }
}

// ---------------------------------------------------------------------------
// Admin email operations: status/health surface, connection test, and manual
// retry of a specific failed transactional email. None of these ever expose
// SMTP credentials (host/port/from/user presence only — never the password).
// ---------------------------------------------------------------------------

/** Sanitized SMTP configuration + last test outcome. Never includes secrets. */
export async function getEmailStatus() {
  const lastTest = await prisma.emailLog.findFirst({
    where: { type: "TEST_EMAIL" },
    orderBy: { createdAt: "desc" },
  });
  const cfg = await getSmtpConfig();
  return {
    configured: cfg.configured,
    source: cfg.source,
    host: cfg.host || null,
    port: cfg.port || null,
    senderAddress: cfg.from || null,
    hasAuthUser: Boolean(cfg.user),
    lastTestAt: lastTest ? (lastTest.sentAt || lastTest.createdAt) : null,
    lastTestStatus: lastTest ? lastTest.status : null,
  };
}

/**
 * Verifies the SMTP transport and sends a safe, generic test message to the
 * given recipient. Returns a sanitized outcome — never the password, a full
 * stack trace, or any provider secret. Every attempt is recorded as an
 * EmailLog row of type TEST_EMAIL so status/health surfaces can read it back.
 */
export async function sendTestEmail(recipient, adminId) {
  const { mailer } = await getMailer();
  if (!mailer) {
    await prisma.emailLog.create({ data: { type: "TEST_EMAIL", recipient, status: "SKIPPED", failureMessage: "SMTP not configured" } });
    return { sent: false, reason: "smtp_not_configured" };
  }
  try {
    await mailer.verify();
  } catch {
    await prisma.emailLog.create({ data: { type: "TEST_EMAIL", recipient, status: "FAILED", failureMessage: "SMTP connection could not be verified" } });
    return { sent: false, reason: "connection_failed" };
  }
  try {
    const info = await mailer.sendMail({
      to: recipient,
      subject: `${await getStoreName()} — test email`,
      html: `<div style="font-family:Georgia,serif;max-width:480px;margin:auto;color:#2b2723"><h1>SMTP test successful</h1><p>This is a test message sent from the admin panel to confirm outgoing email is working correctly.</p></div>`,
    });
    await prisma.emailLog.create({ data: { type: "TEST_EMAIL", recipient, status: "SENT", providerMessageId: info.messageId || null, sentAt: new Date() } });
    if (adminId) await prisma.adminAuditLog.create({ data: { adminId, action: "EMAIL_TEST_SENT", provider: "email", metadata: { recipient } } });
    return { sent: true };
  } catch (err) {
    await prisma.emailLog.create({ data: { type: "TEST_EMAIL", recipient, status: "FAILED", failureMessage: String(err.message || "send failed").slice(0, 300) } });
    return { sent: false, reason: "send_failed" };
  }
}

/** Failed-email count + most recent failures, for a dashboard widget. */
export async function getEmailHealthSummary({ recentLimit = 10 } = {}) {
  const [failedCount, recentFailures, status] = await Promise.all([
    prisma.emailLog.count({ where: { status: "FAILED" } }),
    prisma.emailLog.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: recentLimit,
      select: { id: true, type: true, recipient: true, orderId: true, invoiceId: true, failureMessage: true, createdAt: true },
    }),
    getEmailStatus(),
  ]);
  return { smtpConfigured: status.configured, lastTestAt: status.lastTestAt, lastTestStatus: status.lastTestStatus, failedCount, recentFailures };
}

const RESENDABLE_TYPES = new Set(["INVOICE", "INVOICE_RESEND"]);

/**
 * Explicit, admin-initiated retry of one failed/skipped transactional email identified by its EmailLog
 * id. Notification emails (order/account events) are re-sent through the notification service, which
 * keeps the at-most-once ledger consistent; invoice emails are re-sent by the invoice path.
 */
export async function retryEmailLog(emailLogId, adminId) {
  const log = await prisma.emailLog.findUnique({ where: { id: emailLogId } });
  if (!log) throw ApiError.notFound("Email log entry not found.");
  if (!["FAILED", "SKIPPED"].includes(log.status)) throw ApiError.badRequest("Only a failed or skipped email can be retried.");

  if (log.notificationId) {
    const { retryNotification } = await import("../notifications/notification.service.js");
    return retryNotification(log.notificationId, adminId);
  }
  if (!RESENDABLE_TYPES.has(log.type)) throw ApiError.badRequest(`Emails of type ${log.type} cannot be retried from here.`);
  if (!log.invoiceId) throw ApiError.badRequest("This log entry has no associated invoice.");
  return sendInvoiceEmail(log.invoiceId, { resend: true, adminId });
}

// Fire-and-forget notification for a return/refund status change. Never
// throws back into the caller's transaction — returns.service.js calls this
// with .catch(...) the same way order/shipping status emails are dispatched.
export async function sendReturnStatusEmail(orderId, returnRequest, statusLabel) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { sent: false, reason: "order_not_found" };

  const { mailer } = await getMailer();
  const subject = `Update on your return for order ${order.orderNumber}`;
  const html = `<div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;color:#2b2723;">
    <h1 style="font-size:20px;">Return update</h1>
    <p>Hello ${escapeHtml(order.customerName)},</p>
    <p>Your return request for order <strong>${order.orderNumber}</strong> is now: <strong>${escapeHtml(statusLabel)}</strong>.</p>
    ${returnRequest?.refundAmount ? `<p>Refund amount: ₹${Number(returnRequest.refundAmount).toLocaleString("en-IN")}</p>` : ""}
    <p style="margin-top:24px;color:#4a443d;">You can check the latest status from your account.</p>
  </div>`;

  if (!mailer) {
    try {
      await prisma.emailLog.create({ data: { type: "RETURN_STATUS", recipient: order.customerEmail, orderId, status: "SKIPPED", failureMessage: "SMTP not configured" } });
    } catch (writeErr) {
      if (!isMissingParentRow(writeErr)) throw writeErr;
    }
    return { sent: false, reason: "smtp_not_configured" };
  }

  try {
    const info = await mailer.sendMail({ to: order.customerEmail, subject, html });
    try {
      await prisma.emailLog.create({ data: { type: "RETURN_STATUS", recipient: order.customerEmail, orderId, status: "SENT", providerMessageId: info.messageId || null, sentAt: new Date() } });
    } catch (writeErr) {
      if (!isMissingParentRow(writeErr)) throw writeErr;
    }
    return { sent: true };
  } catch (err) {
    console.error(`[email] failed to send return status email for ${order.orderNumber}:`, err.message);
    try {
      await prisma.emailLog.create({ data: { type: "RETURN_STATUS", recipient: order.customerEmail, orderId, status: "FAILED", failureMessage: String(err.message || "send failed").slice(0, 500) } });
    } catch (writeErr) {
      if (!isMissingParentRow(writeErr)) throw writeErr;
    }
    return { sent: false, reason: "send_failed" };
  }
}
