import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { readInvoicePdf } from "../invoices/invoice.storage.js";
import { ApiError } from "../../utils/ApiError.js";

let transporter = null;
function getTransporter() {
  if (!env.smtp.isConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

function renderOrderConfirmationHtml(order) {
  const rows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;">${escapeHtml(item.productNameSnapshot)} × ${item.quantity}</td>
        <td style="padding:8px 0;text-align:right;">₹${Number(item.lineTotal).toLocaleString("en-IN")}</td>
      </tr>`
    )
    .join("");

  const addr = order.address;

  return `
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;margin:0 auto;color:#2b2723;">
    <h1 style="font-size:22px;">Thank you, ${escapeHtml(order.customerName)}!</h1>
    <p>Your Aadya Society order <strong>${order.orderNumber}</strong> is confirmed.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows}</table>
    <table style="width:100%;border-top:1px solid #ddd;padding-top:8px;">
      <tr><td>Subtotal</td><td style="text-align:right;">₹${Number(order.subtotal).toLocaleString("en-IN")}</td></tr>
      <tr><td>Shipping</td><td style="text-align:right;">₹${Number(order.shippingAmount).toLocaleString("en-IN")}</td></tr>
      <tr><td style="font-weight:bold;">Total</td><td style="text-align:right;font-weight:bold;">₹${Number(order.totalAmount).toLocaleString("en-IN")}</td></tr>
    </table>
    ${
      addr
        ? `<h2 style="font-size:16px;margin-top:24px;">Shipping to</h2>
    <p style="margin:0;">${escapeHtml(addr.fullName)}<br/>${escapeHtml(addr.addressLine1)}${addr.addressLine2 ? `<br/>${escapeHtml(addr.addressLine2)}` : ""}<br/>${escapeHtml(addr.city)}, ${escapeHtml(addr.state)} ${escapeHtml(addr.postalCode)}<br/>${escapeHtml(addr.country)}</p>`
        : ""
    }
    <p style="margin-top:24px;color:#4a443d;">Order status: ${order.status}</p>
  </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function sendPasswordResetEmail({ customer, token }) {
  const mailer = getTransporter();
  if (!mailer) return { sent: false, reason: "smtp_not_configured" };
  const resetUrl = `${env.frontendUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await mailer.sendMail({ from: env.smtp.from, to: customer.email, subject: "Reset your Aadya Society password", html: `<div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#2b2723"><h1>Reset your password</h1><p>Hello ${escapeHtml(customer.name || "there")},</p><p>We received a request to reset your Aadya Society account password. This link expires in one hour.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#3c4a3a;color:#fff;text-decoration:none;border-radius:6px">Reset password</a></p><p>If you did not request this, you can safely ignore this email.</p></div>` });
    return { sent: true };
  } catch (err) { console.error("[email] failed to send password reset email:", err.message); return { sent: false, reason: "send_failed" }; }
}

// Fire-and-forget by design: called after a payment is finalized, and must
// never throw back into that transaction/webhook path. If SMTP isn't
// configured (e.g. local dev), it logs and returns instead of failing.
export async function sendOrderConfirmationEmail(orderId, { resend = false, adminId = null } = {}) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, address: true, customer: true },
  });
  if (!order) return { sent: false, reason: "order_not_found" };

  const mailer = getTransporter();
  if (!mailer) {
    // eslint-disable-next-line no-console
    console.log(`[email] SMTP not configured — skipping confirmation email for ${order.orderNumber}`);
    try {
      await prisma.emailLog.create({ data: { type: "ORDER_CONFIRMATION", recipient: order.customerEmail, orderId, status: "SKIPPED", failureMessage: "SMTP not configured" } });
    } catch (writeErr) {
      if (!isMissingParentRow(writeErr)) throw writeErr;
    }
    return { sent: false, reason: "smtp_not_configured" };
  }

  try {
    const info = await mailer.sendMail({
      from: env.smtp.from,
      to: order.customerEmail,
      subject: `Your Aadya Society order ${order.orderNumber} is confirmed`,
      html: `${renderOrderConfirmationHtml(order)}${order.customer ? `<p style="text-align:center"><a href="${env.frontendUrl.replace(/\/$/, "")}/account/orders/${encodeURIComponent(order.orderNumber)}">View your order</a></p>` : ""}`,
    });
    try {
      await prisma.emailLog.create({ data: { type: "ORDER_CONFIRMATION", recipient: order.customerEmail, orderId, status: "SENT", providerMessageId: info.messageId || null, sentAt: new Date() } });
    } catch (writeErr) {
      if (!isMissingParentRow(writeErr)) throw writeErr;
    }
    if (adminId && resend) await prisma.adminAuditLog.create({ data: { adminId, action: "ORDER_CONFIRMATION_RESEND", provider: "email", metadata: { orderId } } });
    return { sent: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[email] failed to send confirmation for ${order.orderNumber}:`, err.message);
    try {
      await prisma.emailLog.create({ data: { type: "ORDER_CONFIRMATION", recipient: order.customerEmail, orderId, status: "FAILED", failureMessage: String(err.message || "send failed").slice(0, 500) } });
    } catch (writeErr) {
      if (!isMissingParentRow(writeErr)) throw writeErr;
    }
    return { sent: false, reason: "send_failed" };
  }
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
  const mailer = getTransporter();
  try {
    if (!mailer) {
      if (!resend) await prisma.invoice.update({ where: { id: invoiceId }, data: { emailedAt: null } });
      await prisma.emailLog.create({ data: { type: "INVOICE", recipient: invoice.customerEmail, orderId: invoice.orderId, invoiceId, status: "SKIPPED", failureMessage: "SMTP not configured" } });
      return { sent: false, reason: "smtp_not_configured" };
    }
    const attachment = invoice.pdfStorageKey ? await readInvoicePdf(invoice.pdfStorageKey) : null;
    const info = await mailer.sendMail({
      from: env.smtp.from,
      to: invoice.customerEmail,
      subject: `Your Aadya Invoice — ${invoice.invoiceNumber}`,
      html: `<div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#2b2723"><h1>Your Aadya invoice</h1><p>Hello ${escapeHtml(invoice.customerName)},</p><p>Invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong> for order <strong>${escapeHtml(invoice.order.orderNumber)}</strong> is attached.</p><p>Total: <strong>₹${Number(invoice.totalAmount).toLocaleString("en-IN")}</strong><br/>Payment method: ${escapeHtml(invoice.order.paymentMethod)}</p><p><a href="${env.frontendUrl.replace(/\/$/, "")}/account/orders/${encodeURIComponent(invoice.order.orderNumber)}">View your order</a></p></div>`,
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

export async function sendShippingStatusEmail(orderId, status, { resend = false, adminId = null } = {}) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true, customer: true, items: true } });
  if (!order || !["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"].includes(status)) return { sent: false };
  const type = `${status}_EMAIL`;
  if (!resend) {
    const exists = await prisma.emailLog.findFirst({ where: { orderId, type, status: "SENT" } });
    if (exists) return { sent: false, reason: "already_sent" };
  }
  const subject = status === "DELIVERED" ? "Your Aadya order has been delivered" : status === "OUT_FOR_DELIVERY" ? "Your Aadya order is out for delivery" : "Your Aadya order has shipped";
  const mailer = getTransporter();
  if (!mailer) return { sent: false, reason: "smtp_not_configured" };
  try {
    await mailer.sendMail({ from: env.smtp.from, to: order.customerEmail, subject, html: `<p>Hello ${escapeHtml(order.customerName)},</p><p>Your order <strong>${escapeHtml(order.orderNumber)}</strong> is ${escapeHtml(status.replaceAll("_", " ").toLowerCase())}.</p><p>Carrier: ${escapeHtml(order.shipment?.carrier || "")}${order.shipment?.trackingNumber ? `<br/>Tracking: ${escapeHtml(order.shipment.trackingNumber)}` : ""}</p><p><a href="${env.frontendUrl.replace(/\/$/, "")}/account/orders/${encodeURIComponent(order.orderNumber)}">View your order</a></p>` });
    await prisma.emailLog.create({ data: { type, recipient: order.customerEmail, orderId, status: "SENT", sentAt: new Date() } });
    if (order.customerId && !resend) await prisma.customerNotification.create({ data: { customerId: order.customerId, type: `ORDER_${status}`, title: status === "DELIVERED" ? "Delivered" : status === "OUT_FOR_DELIVERY" ? "Out for delivery" : "Shipped", message: `Your order ${order.orderNumber} is ${status.replaceAll("_", " ").toLowerCase()}.`, link: `/account/orders/${order.orderNumber}` } });
    if (adminId && resend) await prisma.adminAuditLog.create({ data: { adminId, action: "SHIPPING_EMAIL_RESEND", provider: "email", metadata: { orderId, status } } });
    return { sent: true };
  } catch (err) {
    await prisma.emailLog.create({ data: { type, recipient: order.customerEmail, orderId, status: "FAILED", failureMessage: String(err.message).slice(0, 500) } });
    return { sent: false };
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
  return {
    configured: env.smtp.isConfigured,
    host: env.smtp.host || null,
    port: env.smtp.port,
    senderAddress: env.smtp.from,
    hasAuthUser: Boolean(env.smtp.user),
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
  const mailer = getTransporter();
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
      from: env.smtp.from,
      to: recipient,
      subject: "Aadya Society — test email",
      html: `<div style="font-family:Georgia,serif;max-width:480px;margin:auto;color:#2b2723"><h1>SMTP test successful</h1><p>This is a test message sent from the Aadya Society admin panel to confirm outgoing email is working correctly.</p></div>`,
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

const RESENDABLE_TYPES = new Set(["ORDER_CONFIRMATION", "INVOICE", "INVOICE_RESEND", "IN_TRANSIT_EMAIL", "OUT_FOR_DELIVERY_EMAIL", "DELIVERED_EMAIL"]);

/**
 * Explicit, admin-initiated retry of one failed/skipped transactional email
 * identified by its EmailLog id. Never triggered automatically — this is the
 * only path that resends a previously failed customer email.
 */
export async function retryEmailLog(emailLogId, adminId) {
  const log = await prisma.emailLog.findUnique({ where: { id: emailLogId } });
  if (!log) throw ApiError.notFound("Email log entry not found.");
  if (!["FAILED", "SKIPPED"].includes(log.status)) throw ApiError.badRequest("Only a failed or skipped email can be retried.");
  if (!RESENDABLE_TYPES.has(log.type)) throw ApiError.badRequest(`Emails of type ${log.type} cannot be retried from here.`);

  if (log.type === "ORDER_CONFIRMATION") {
    if (!log.orderId) throw ApiError.badRequest("This log entry has no associated order.");
    return sendOrderConfirmationEmail(log.orderId, { resend: true, adminId });
  }
  if (log.type === "INVOICE" || log.type === "INVOICE_RESEND") {
    if (!log.invoiceId) throw ApiError.badRequest("This log entry has no associated invoice.");
    return sendInvoiceEmail(log.invoiceId, { resend: true, adminId });
  }
  const status = log.type.replace(/_EMAIL$/, "");
  if (!log.orderId) throw ApiError.badRequest("This log entry has no associated order.");
  return sendShippingStatusEmail(log.orderId, status, { resend: true, adminId });
}

// Fire-and-forget notification for a return/refund status change. Never
// throws back into the caller's transaction — returns.service.js calls this
// with .catch(...) the same way order/shipping status emails are dispatched.
export async function sendReturnStatusEmail(orderId, returnRequest, statusLabel) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { sent: false, reason: "order_not_found" };

  const mailer = getTransporter();
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
    const info = await mailer.sendMail({ from: env.smtp.from, to: order.customerEmail, subject, html });
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
