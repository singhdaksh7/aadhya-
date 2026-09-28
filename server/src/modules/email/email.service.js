import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { readInvoicePdf } from "../invoices/invoice.storage.js";

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
export async function sendOrderConfirmationEmail(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, address: true, customer: true },
  });
  if (!order) return { sent: false, reason: "order_not_found" };

  const mailer = getTransporter();
  if (!mailer) {
    // eslint-disable-next-line no-console
    console.log(`[email] SMTP not configured — skipping confirmation email for ${order.orderNumber}`);
    return { sent: false, reason: "smtp_not_configured" };
  }

  try {
    await mailer.sendMail({
      from: env.smtp.from,
      to: order.customerEmail,
      subject: `Your Aadya Society order ${order.orderNumber} is confirmed`,
      html: `${renderOrderConfirmationHtml(order)}${order.customer ? `<p style="text-align:center"><a href="${env.frontendUrl.replace(/\/$/, "")}/account/orders/${encodeURIComponent(order.orderNumber)}">View your order</a></p>` : ""}`,
    });
    return { sent: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[email] failed to send confirmation for ${order.orderNumber}:`, err.message);
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

export async function sendShippingStatusEmail(orderId, status) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { shipment: true, customer: true, items: true } });
  if (!order || !["IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"].includes(status)) return { sent: false };
  const type = `${status}_EMAIL`;
  const exists = await prisma.emailLog.findFirst({ where: { orderId, type, status: "SENT" } });
  if (exists) return { sent: false, reason: "already_sent" };
  const subject = status === "DELIVERED" ? "Your Aadya order has been delivered" : status === "OUT_FOR_DELIVERY" ? "Your Aadya order is out for delivery" : "Your Aadya order has shipped";
  const mailer = getTransporter();
  if (!mailer) return { sent: false, reason: "smtp_not_configured" };
  try { await mailer.sendMail({ from: env.smtp.from, to: order.customerEmail, subject, html: `<p>Hello ${escapeHtml(order.customerName)},</p><p>Your order <strong>${escapeHtml(order.orderNumber)}</strong> is ${escapeHtml(status.replaceAll("_", " ").toLowerCase())}.</p><p>Carrier: ${escapeHtml(order.shipment?.carrier || "")}${order.shipment?.trackingNumber ? `<br/>Tracking: ${escapeHtml(order.shipment.trackingNumber)}` : ""}</p><p><a href="${env.frontendUrl.replace(/\/$/, "")}/account/orders/${encodeURIComponent(order.orderNumber)}">View your order</a></p>` }); await prisma.emailLog.create({ data: { type, recipient: order.customerEmail, orderId, status: "SENT", sentAt: new Date() } }); if (order.customerId) await prisma.customerNotification.create({ data: { customerId: order.customerId, type: `ORDER_${status}`, title: status === "DELIVERED" ? "Delivered" : status === "OUT_FOR_DELIVERY" ? "Out for delivery" : "Shipped", message: `Your order ${order.orderNumber} is ${status.replaceAll("_", " ").toLowerCase()}.`, link: `/account/orders/${order.orderNumber}` } }); return { sent: true }; } catch (err) { await prisma.emailLog.create({ data: { type, recipient: order.customerEmail, orderId, status: "FAILED", failureMessage: String(err.message).slice(0, 500) } }); return { sent: false }; }
}
