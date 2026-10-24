import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { getStoreName } from "../../lib/storeName.js";
import { deliverEmail, getSmtpConfig } from "../email/email.service.js";
import { EMAIL_TEMPLATES, EVENT_FOR_ORDER_STATUS, SAMPLE_VARIABLES, unknownPlaceholders } from "./templates.js";
import { composeEmail } from "./render.js";

// ONE place that decides whether a customer email is sent. Every trigger (Admin status change, courier
// webhook, payment confirmation, account creation, refunds) calls into here, so the same event reaching
// us twice produces one email: the unique NotificationEvent.dedupeKey is claimed before anything is sent.
//
// Safety rules:
//  - Never throws into the caller: order/payment/shipment state must not depend on SMTP being up.
//  - Transactional emails never look at newsletter/marketing consent.
//  - Failures are logged (EmailLog + NotificationEvent) and retried a bounded number of times.

export const MAX_AUTOMATIC_ATTEMPTS = 3;
const RETRY_DELAYS_MIN = [10, 60]; // after attempt 1, after attempt 2
const STALE_PENDING_MIN = 10;

const base = () => env.frontendUrl.replace(/\/$/, "");
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const httpsUrl = (u) => (typeof u === "string" && /^https:\/\//i.test(u) ? u : "");

async function loadSettings() {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: ["general", "branding"] } } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value || {}]));
}

export async function getBrand() {
  const [name, settings] = await Promise.all([getStoreName(), loadSettings()]);
  let supportEmail = settings.general?.supportEmail || settings.general?.businessEmail || "";
  if (!supportEmail) {
    const cfg = await getSmtpConfig().catch(() => null);
    const m = String(cfg?.from || "").match(/<([^>]+)>/);
    supportEmail = m ? m[1] : "";
  }
  let logo = settings.branding?.desktopLogo || "";
  if (logo.startsWith("/") && env.apiPublicUrl.startsWith("https://")) logo = `${env.apiPublicUrl}${logo}`;
  return { name, supportEmail, supportPhone: settings.general?.supportPhone || "", logoUrl: httpsUrl(logo) };
}

// Template = code default overlaid with the Admin's saved wording.
export async function loadTemplate(key) {
  const def = EMAIL_TEMPLATES[key];
  const row = await prisma.emailTemplate.findUnique({ where: { key } }).catch(() => null);
  return {
    key,
    def,
    row,
    // Security emails can never be switched off; the others follow the saved toggle, else the default.
    enabled: def.locked ? true : row ? row.enabled : def.defaultEnabled,
    override: row ? { subject: row.subject, heading: row.heading, body: row.body } : null,
  };
}

function paymentLabel(order) {
  if (order.paymentMethod === "cod") return "Cash on Delivery";
  return order.paymentStatus === "PAID" ? "Paid online" : "Online payment";
}

function orderVariables(order, brand, extra = {}) {
  const shipment = order.shipment;
  const date = new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return {
    customerName: order.customerName || "",
    firstName: firstName(order.customerName),
    orderNumber: order.orderNumber,
    orderDate: date,
    orderTotal: inr(order.totalAmount),
    paymentMethod: paymentLabel(order),
    trackingNumber: shipment?.awb || shipment?.trackingNumber || "",
    courierName: shipment?.carrier || "",
    trackingUrl: httpsUrl(shipment?.trackingUrl),
    accountUrl: `${base()}/account`,
    orderUrl: order.customerId ? `${base()}/account/orders/${encodeURIComponent(order.orderNumber)}` : `${base()}/track-order`,
    supportEmail: brand.supportEmail,
    brandName: brand.name,
    cancellationReason: extra.reason || "",
    refundAmount: extra.refundAmount != null ? inr(extra.refundAmount) : "",
  };
}

function renderForOrder(tpl, order, brand, extra = {}) {
  const vars = orderVariables(order, brand, extra);
  const shaped = {
    ...order,
    orderDateLabel: vars.orderDate,
    paymentLabel: vars.paymentMethod,
    guestAccountNote: Boolean(order.customer?.autoCreated && !order.customer?.passwordSetAt),
  };
  return composeEmail({ key: tpl.key, vars, override: tpl.override, order: shaped, brand });
}

const retryAt = (attempts) => (attempts < MAX_AUTOMATIC_ATTEMPTS ? new Date(Date.now() + RETRY_DELAYS_MIN[Math.min(attempts, RETRY_DELAYS_MIN.length) - 1] * 60_000) : null);

// Sends one claimed notification and records the outcome. Never throws.
async function dispatch(row, build) {
  const attempts = row.attempts + 1;
  await prisma.notificationEvent.update({ where: { id: row.id }, data: { status: "PENDING", attempts } }).catch(() => {});
  let mail;
  try {
    mail = await build();
  } catch (err) {
    await prisma.notificationEvent.update({ where: { id: row.id }, data: { status: "FAILED", lastError: `render: ${String(err.message).slice(0, 200)}`, nextRetryAt: null } }).catch(() => {});
    return { sent: false, reason: "render_failed" };
  }
  const result = await deliverEmail({ to: row.recipient, subject: mail.subject, html: mail.html, text: mail.text, type: row.event, event: row.event, orderId: row.orderId, source: row.source, notificationId: row.id });
  if (result.sent) {
    await prisma.notificationEvent.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date(), lastError: null, nextRetryAt: null } }).catch(() => {});
    return { sent: true };
  }
  await prisma.notificationEvent
    .update({ where: { id: row.id }, data: { status: "FAILED", lastError: String(result.error || result.reason || "send failed").slice(0, 300), nextRetryAt: retryAt(attempts) } })
    .catch(() => {});
  return { sent: false, reason: result.reason || "send_failed" };
}

async function claim(data) {
  try {
    return { ok: true, row: await prisma.notificationEvent.create({ data: { status: "PENDING", attempts: 0, ...data } }) };
  } catch (err) {
    if (err?.code === "P2002") return { ok: false, reason: "duplicate" };
    throw err;
  }
}

const orderInclude = { items: true, address: true, customer: true, shipment: true };

// Customer email for an order event (placed / processing / shipped / ... / refunds).
export async function notifyOrderEvent(orderId, event, { source = "SYSTEM", providerEventId = null, extra = {}, dedupeSuffix = "" } = {}) {
  try {
    const def = EMAIL_TEMPLATES[event];
    if (!def || def.audience !== "order") return { sent: false, reason: "unknown_event" };
    const tpl = await loadTemplate(event);
    if (!tpl.enabled) return { sent: false, reason: "disabled" };
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!order || !order.customerEmail) return { sent: false, reason: "order_not_found" };

    const claimed = await claim({
      dedupeKey: `${orderId}:${event}${dedupeSuffix ? `:${dedupeSuffix}` : ""}`,
      event,
      orderId,
      customerId: order.customerId || null,
      recipient: order.customerEmail,
      source,
      providerEventId,
    });
    if (!claimed.ok) return { sent: false, reason: claimed.reason };
    const brand = await getBrand();
    return await dispatch(claimed.row, () => renderForOrder(tpl, order, brand, extra));
  } catch (err) {
    console.error(`[notify] ${event} for order ${orderId} failed:`, err.message);
    return { sent: false, reason: "error" };
  }
}

// Status change -> the matching email (if that status has one).
export function notifyOrderStatus(orderId, status, opts) {
  const event = EVENT_FOR_ORDER_STATUS[status];
  return event ? notifyOrderEvent(orderId, event, opts) : Promise.resolve({ sent: false, reason: "no_email_for_status" });
}

// Welcome email, once per account. Guest checkout accounts get the "use the login code" wording.
export async function notifyAccountCreated(customer, { guest = false, source = "SYSTEM" } = {}) {
  try {
    const tpl = await loadTemplate("ACCOUNT_CREATED");
    if (!tpl.enabled || !customer?.email) return { sent: false, reason: "disabled" };
    const claimed = await claim({ dedupeKey: `account:${customer.id}:ACCOUNT_CREATED`, event: "ACCOUNT_CREATED", orderId: null, customerId: customer.id, recipient: customer.email, source });
    if (!claimed.ok) return { sent: false, reason: claimed.reason };
    const brand = await getBrand();
    return await dispatch(claimed.row, async () =>
      composeEmail({
        key: "ACCOUNT_CREATED",
        vars: { customerName: customer.name || "", firstName: firstName(customer.name), accountUrl: `${base()}/account`, supportEmail: brand.supportEmail, brandName: brand.name },
        override: tpl.override,
        variant: guest && !tpl.override ? "guest" : null,
        brand,
      })
    );
  } catch (err) {
    console.error("[notify] ACCOUNT_CREATED failed:", err.message);
    return { sent: false, reason: "error" };
  }
}

// One-time login code. Each code is its own email (no dedupe) and the code is never stored or logged:
// EmailLog records only that "a login code email" was sent.
export async function sendLoginCodeEmail({ customer, code }) {
  try {
    const tpl = await loadTemplate("LOGIN_CODE");
    const brand = await getBrand();
    const mail = composeEmail({
      key: "LOGIN_CODE",
      vars: { customerName: customer.name || "", firstName: firstName(customer.name), brandName: brand.name, supportEmail: brand.supportEmail, expiresInMinutes: "10" },
      override: tpl.override,
      code,
      brand,
    });
    const result = await deliverEmail({ to: customer.email, subject: mail.subject, html: mail.html, text: mail.text, type: "LOGIN_CODE", event: "LOGIN_CODE", source: "SYSTEM" });
    return { sent: result.sent, reason: result.reason };
  } catch (err) {
    console.error("[notify] LOGIN_CODE failed:", err.message);
    return { sent: false, reason: "error" };
  }
}

export async function sendPasswordResetEmail({ customer, token }) {
  try {
    const tpl = await loadTemplate("PASSWORD_RESET");
    const brand = await getBrand();
    const resetUrl = `${base()}/reset-password?token=${encodeURIComponent(token)}`;
    const mail = composeEmail({
      key: "PASSWORD_RESET",
      vars: { customerName: customer.name || "", firstName: firstName(customer.name), brandName: brand.name, supportEmail: brand.supportEmail, resetUrl },
      override: tpl.override,
      brand,
    });
    // The reset link is a credential: it is sent, never logged (EmailLog stores subject/status only).
    const result = await deliverEmail({ to: customer.email, subject: mail.subject, html: mail.html, text: mail.text, type: "PASSWORD_RESET", event: "PASSWORD_RESET", source: "SYSTEM" });
    return { sent: result.sent, reason: result.reason };
  } catch (err) {
    console.error("[notify] PASSWORD_RESET failed:", err.message);
    return { sent: false, reason: "error" };
  }
}

// --- retries ----------------------------------------------------------------------------------------

async function resendRow(row) {
  if (row.orderId) {
    const order = await prisma.order.findUnique({ where: { id: row.orderId }, include: orderInclude });
    if (!order) return { sent: false, reason: "order_not_found" };
    const tpl = await loadTemplate(row.event);
    const brand = await getBrand();
    return dispatch(row, () => renderForOrder(tpl, order, brand));
  }
  if (row.event === "ACCOUNT_CREATED" && row.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: row.customerId } });
    if (!customer) return { sent: false, reason: "customer_not_found" };
    const tpl = await loadTemplate("ACCOUNT_CREATED");
    const brand = await getBrand();
    return dispatch(row, async () =>
      composeEmail({
        key: "ACCOUNT_CREATED",
        vars: { customerName: customer.name, firstName: firstName(customer.name), accountUrl: `${base()}/account`, supportEmail: brand.supportEmail, brandName: brand.name },
        override: tpl.override,
        variant: customer.autoCreated && !tpl.override ? "guest" : null,
        brand,
      })
    );
  }
  return { sent: false, reason: "not_retryable" };
}

// Bounded automatic retry: only FAILED rows that are due and under the attempt limit, plus rows stuck
// PENDING after a crash. Each row is claimed with a compare-and-swap so two workers can't both send.
export async function retryDueNotifications({ limit = 20 } = {}) {
  const now = new Date();
  const due = await prisma.notificationEvent.findMany({
    where: {
      OR: [
        { status: "FAILED", attempts: { lt: MAX_AUTOMATIC_ATTEMPTS }, nextRetryAt: { lte: now } },
        { status: "PENDING", updatedAt: { lt: new Date(now.getTime() - STALE_PENDING_MIN * 60_000) }, attempts: { lt: MAX_AUTOMATIC_ATTEMPTS } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let sent = 0;
  for (const row of due) {
    const cas = await prisma.notificationEvent.updateMany({ where: { id: row.id, status: row.status, attempts: row.attempts }, data: { status: "PENDING", nextRetryAt: null } });
    if (cas.count === 0) continue;
    const result = await resendRow({ ...row, status: "PENDING" });
    if (result.sent) sent += 1;
  }
  return { attempted: due.length, sent };
}

// Explicit Admin retry of one failed notification (resets the automatic-attempt budget).
export async function retryNotification(id, adminId) {
  const row = await prisma.notificationEvent.findUnique({ where: { id } });
  if (!row) return { sent: false, reason: "not_found" };
  if (row.status === "SENT") return { sent: false, reason: "already_sent" };
  const cas = await prisma.notificationEvent.updateMany({ where: { id, status: row.status }, data: { status: "PENDING", attempts: 0, nextRetryAt: null } });
  if (cas.count === 0) return { sent: false, reason: "in_progress" };
  if (adminId) await prisma.adminAuditLog.create({ data: { adminId, action: "NOTIFICATION_RETRY", provider: "email", metadata: { notificationId: id, event: row.event } } }).catch(() => {});
  return resendRow({ ...row, status: "PENDING", attempts: 0 });
}

// --- admin: previews and template list ---------------------------------------------------------------

export async function previewTemplate(key, override = null) {
  const def = EMAIL_TEMPLATES[key];
  if (!def) return null;
  const brand = await getBrand();
  const vars = { ...SAMPLE_VARIABLES, brandName: brand.name, supportEmail: brand.supportEmail || SAMPLE_VARIABLES.supportEmail };
  const sampleOrder = {
    orderNumber: vars.orderNumber,
    customerName: vars.customerName,
    customerEmail: "asha@example.com",
    subtotal: 1089,
    shippingAmount: 0,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 1089,
    orderDateLabel: vars.orderDate,
    paymentLabel: vars.paymentMethod,
    guestAccountNote: false,
    items: [{ productNameSnapshot: "Handwoven Jute Mat", quantity: 2, lineTotal: 598 }, { productNameSnapshot: "Kilim Fabric Tab Bag", quantity: 1, lineTotal: 491 }],
    address: { fullName: "Asha Verma", addressLine1: "12 Demo Street", addressLine2: "", city: "Jaipur", state: "Rajasthan", postalCode: "302001", country: "India" },
  };
  return composeEmail({ key, vars, override, order: sampleOrder, code: def.blocks.includes("code") ? "482913" : null, brand });
}

export async function listTemplates() {
  const rows = await prisma.emailTemplate.findMany();
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  return Object.entries(EMAIL_TEMPLATES).map(([key, def]) => {
    const row = byKey[key];
    return {
      key,
      label: def.label,
      locked: Boolean(def.locked),
      enabled: def.locked ? true : row ? row.enabled : def.defaultEnabled,
      customized: Boolean(row),
      subject: row?.subject ?? def.subject,
      heading: row?.heading ?? def.heading,
      body: row?.body ?? def.body,
      defaults: { subject: def.subject, heading: def.heading, body: def.body },
      updatedAt: row?.updatedAt || null,
    };
  });
}

export function validateTemplateInput({ subject, heading, body }) {
  const bad = [...new Set([...unknownPlaceholders(subject), ...unknownPlaceholders(heading), ...unknownPlaceholders(body)])];
  return bad;
}
