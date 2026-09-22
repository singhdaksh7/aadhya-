import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";

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
