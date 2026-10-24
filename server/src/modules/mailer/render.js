import { EMAIL_TEMPLATES, fillPlaceholders } from "./templates.js";

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const oneLine = (s) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();
const httpsOnly = (url) => (typeof url === "string" && /^https?:\/\//i.test(url) ? url : "");

const COLORS = { ink: "#2b2723", muted: "#6b645c", line: "#e8e1d6", bg: "#f6f2ec", card: "#ffffff", accent: "#b8674a" };

// Paragraphs from the editable text: blank line = new paragraph, single newline = line break.
function paragraphsHtml(text) {
  return String(text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${COLORS.ink};">${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function summaryBlock(order) {
  const rows = (order.items || [])
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid ${COLORS.line};font-size:14px;color:${COLORS.ink};">${esc(item.productNameSnapshot)}<span style="color:${COLORS.muted};"> × ${esc(item.quantity)}</span></td>
        <td style="padding:8px 0;border-bottom:1px solid ${COLORS.line};font-size:14px;text-align:right;white-space:nowrap;color:${COLORS.ink};">${money(item.lineTotal)}</td>
      </tr>`
    )
    .join("");
  const line = (label, value, bold = false) =>
    `<tr><td style="padding:4px 0;font-size:14px;${bold ? "font-weight:bold;" : ""}color:${COLORS.ink};">${label}</td><td style="padding:4px 0;font-size:14px;text-align:right;${bold ? "font-weight:bold;" : ""}color:${COLORS.ink};">${value}</td></tr>`;
  const discount = Number(order.discountAmount || 0);
  const tax = Number(order.taxAmount || 0);
  const addr = order.address;
  const addressHtml = addr
    ? `<p style="margin:18px 0 4px;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:.06em;color:${COLORS.muted};">Shipping to</p>
       <p style="margin:0;font-size:14px;line-height:1.55;color:${COLORS.ink};">${esc(addr.fullName)}<br/>${esc(addr.addressLine1)}${addr.addressLine2 ? `<br/>${esc(addr.addressLine2)}` : ""}<br/>${esc(addr.city)}, ${esc(addr.state)} ${esc(addr.postalCode)}<br/>${esc(addr.country)}</p>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 0;border-collapse:collapse;">${rows}</table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 0;border-collapse:collapse;">
      ${line("Subtotal", money(order.subtotal))}
      ${line("Shipping", Number(order.shippingAmount || 0) === 0 ? "Free" : money(order.shippingAmount))}
      ${discount > 0 ? line("Discount", `− ${money(discount)}`) : ""}
      ${tax > 0 ? line("Tax", money(tax)) : ""}
      ${line("Total", money(order.totalAmount), true)}
    </table>
    <p style="margin:14px 0 0;font-size:13px;color:${COLORS.muted};">Order date: ${esc(order.orderDateLabel || "")} &nbsp;·&nbsp; Payment: ${esc(order.paymentLabel || "")}</p>
    ${addressHtml}`;
}

// Internal order snapshot for Admin notification emails: who, what, how much, where. No payment credentials.
function adminOrderBlock(vars, order) {
  const kv = (k, v) => (v ? `<tr><td style="padding:6px 0;font-size:13px;color:${COLORS.muted};vertical-align:top;width:38%;">${esc(k)}</td><td style="padding:6px 0;font-size:14px;color:${COLORS.ink};">${esc(v)}</td></tr>` : "");
  const items = (order?.items || [])
    .map((i) => `<tr><td style="padding:7px 0;border-bottom:1px solid ${COLORS.line};font-size:14px;color:${COLORS.ink};">${esc(i.productNameSnapshot)}<span style="color:${COLORS.muted};"> × ${esc(i.quantity)}</span></td><td style="padding:7px 0;border-bottom:1px solid ${COLORS.line};font-size:14px;text-align:right;white-space:nowrap;color:${COLORS.ink};">${money(i.lineTotal)}</td></tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 12px;border-collapse:collapse;">
      ${kv("Order", vars.orderNumber)}${kv("Placed", `${vars.orderDate}`)}${kv("Customer", vars.customerName)}${kv("Email", vars.customerEmail)}${kv("Phone", vars.customerPhone)}${kv("Payment", `${vars.paymentMethod}${vars.paymentStatus ? ` — ${vars.paymentStatus}` : ""}`)}${kv("Order status", vars.orderStatus)}${kv("Deliver to", vars.shippingLocation)}
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;border-collapse:collapse;">${items}
      <tr><td style="padding:10px 0 0;font-size:15px;font-weight:bold;color:${COLORS.ink};">Total</td><td style="padding:10px 0 0;font-size:15px;font-weight:bold;text-align:right;color:${COLORS.ink};">${esc(vars.orderTotal)}</td></tr>
    </table>`;
}
function adminOrderText(vars, order) {
  return [
    `Order: ${vars.orderNumber}`,
    `Placed: ${vars.orderDate}`,
    `Customer: ${vars.customerName}`,
    vars.customerEmail && `Email: ${vars.customerEmail}`,
    vars.customerPhone && `Phone: ${vars.customerPhone}`,
    `Payment: ${vars.paymentMethod}${vars.paymentStatus ? ` - ${vars.paymentStatus}` : ""}`,
    vars.orderStatus && `Order status: ${vars.orderStatus}`,
    vars.shippingLocation && `Deliver to: ${vars.shippingLocation}`,
    "",
    ...(order?.items || []).map((i) => `${i.productNameSnapshot} x ${i.quantity}  ${money(i.lineTotal)}`),
    `Total: ${vars.orderTotal}`,
  ]
    .filter((l) => l !== undefined && l !== false && l !== null)
    .join("\n");
}

function trackingBlock(vars) {
  const rows = [
    vars.courierName ? ["Courier", vars.courierName] : null,
    vars.trackingNumber ? ["Tracking number (AWB)", vars.trackingNumber] : null,
  ].filter(Boolean);
  if (!rows.length) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 14px;border:1px solid ${COLORS.line};border-radius:8px;border-collapse:separate;">
    ${rows.map(([k, v]) => `<tr><td style="padding:10px 14px;font-size:13px;color:${COLORS.muted};">${esc(k)}</td><td style="padding:10px 14px;font-size:14px;font-weight:bold;text-align:right;color:${COLORS.ink};">${esc(v)}</td></tr>`).join("")}
  </table>`;
}

function codeBlock(code) {
  return `<p style="margin:18px 0;text-align:center;"><span style="display:inline-block;padding:14px 26px;font-size:32px;letter-spacing:8px;font-weight:bold;font-family:Consolas,Menlo,monospace;color:${COLORS.ink};background:${COLORS.bg};border:1px solid ${COLORS.line};border-radius:8px;">${esc(code)}</span></p>`;
}

function ctaButton(label, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 6px;"><tr><td style="background:${COLORS.accent};border-radius:999px;">
    <a href="${esc(url)}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:bold;letter-spacing:.04em;color:#ffffff;text-decoration:none;">${esc(label)}</a>
  </td></tr></table>`;
}

// Builds {subject, html, text} for one email.
//   key        template key (templates.js)
//   vars       placeholder values
//   override   admin-edited { subject, heading, body } or null (defaults used)
//   order      optional order (with items/address) for the summary block
//   code       one-time code (LOGIN_CODE only) - rendered in the layout, never in text the Admin can edit
//   variant    "guest" picks the guest-account wording for ACCOUNT_CREATED
//   brand      { name, logoUrl, supportEmail, supportPhone }
export function composeEmail({ key, vars, override = null, order = null, code = null, variant = null, brand }) {
  const def = EMAIL_TEMPLATES[key];
  if (!def) throw new Error(`Unknown email template: ${key}`);
  const subject = oneLine(fillPlaceholders(override?.subject ?? def.subject, vars));
  const heading = oneLine(fillPlaceholders(override?.heading ?? def.heading, vars));
  const bodyText = fillPlaceholders(override?.body ?? (variant === "guest" && def.guestBody ? def.guestBody : def.body), vars);

  const htmlBlocks = [];
  const textBlocks = [];
  for (const block of def.blocks) {
    if (block === "summary" && order) {
      htmlBlocks.push(summaryBlock(order));
      textBlocks.push(
        [
          ...order.items.map((i) => `${i.productNameSnapshot} x ${i.quantity}  ${money(i.lineTotal)}`),
          `Subtotal: ${money(order.subtotal)}`,
          `Shipping: ${Number(order.shippingAmount || 0) === 0 ? "Free" : money(order.shippingAmount)}`,
          ...(Number(order.discountAmount || 0) > 0 ? [`Discount: -${money(order.discountAmount)}`] : []),
          ...(Number(order.taxAmount || 0) > 0 ? [`Tax: ${money(order.taxAmount)}`] : []),
          `Total: ${money(order.totalAmount)}`,
          `Order date: ${order.orderDateLabel || ""}`,
          `Payment: ${order.paymentLabel || ""}`,
          ...(order.address ? ["", "Shipping to:", [order.address.fullName, order.address.addressLine1, order.address.addressLine2, `${order.address.city}, ${order.address.state} ${order.address.postalCode}`, order.address.country].filter(Boolean).join("\n")] : []),
        ].join("\n")
      );
    } else if (block === "accountNote" && order?.guestAccountNote) {
      const note = `We created an account for ${order.customerEmail || "your email"} so you can follow this order. Choose "Email me a login code" on the sign-in page and enter the code we send you; you can then set a password.`;
      htmlBlocks.push(`<p style="margin:16px 0 0;padding:12px 14px;border:1px solid ${COLORS.line};border-radius:8px;font-size:13px;line-height:1.55;color:${COLORS.ink};">${esc(note)}</p>`);
      textBlocks.push(note);
    } else if (block === "tracking") {
      const html = trackingBlock(vars);
      if (html) {
        htmlBlocks.push(html);
        textBlocks.push([vars.courierName && `Courier: ${vars.courierName}`, vars.trackingNumber && `Tracking number (AWB): ${vars.trackingNumber}`].filter(Boolean).join("\n"));
      }
    } else if (block === "code" && code) {
      htmlBlocks.push(codeBlock(code));
      textBlocks.push(`Your code: ${code}`);
    } else if (block === "adminOrder" && order) {
      htmlBlocks.push(adminOrderBlock(vars, order));
      textBlocks.push(adminOrderText(vars, order));
    } else if (block === "returnReason" && vars.returnReason) {
      htmlBlocks.push(`<p style="margin:12px 0 14px;font-size:14px;line-height:1.6;color:${COLORS.ink};"><strong>Return reason:</strong> ${esc(vars.returnReason)}</p>`);
      textBlocks.push(`Return reason: ${vars.returnReason}`);
    } else if (block === "cancellationReason" && vars.cancellationReason) {
      htmlBlocks.push(`<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${COLORS.ink};"><strong>Reason:</strong> ${esc(vars.cancellationReason)}</p>`);
      textBlocks.push(`Reason: ${vars.cancellationReason}`);
    }
  }

  const isAdmin = def.audience === "admin";
  const ctaUrl = def.cta ? httpsOnly(vars[def.cta.url]) : "";
  const supportLine = brand.supportEmail ? `Need help? Write to <a href="mailto:${esc(brand.supportEmail)}" style="color:${COLORS.accent};">${esc(brand.supportEmail)}</a>${brand.supportPhone ? ` or call ${esc(brand.supportPhone)}` : ""}.` : "";

  const logo = httpsOnly(brand.logoUrl)
    ? `<img src="${esc(brand.logoUrl)}" alt="${esc(brand.name)}" style="display:block;margin:0 auto;max-width:200px;max-height:70px;height:auto;border:0;"/>`
    : `<span style="font-family:Georgia,serif;font-size:26px;font-weight:bold;letter-spacing:.02em;color:${COLORS.ink};">${esc(brand.name)}</span>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${COLORS.card};border-radius:12px;border:1px solid ${COLORS.line};">
    <tr><td align="center" style="padding:26px 24px 14px;border-bottom:1px solid ${COLORS.line};">${logo}</td></tr>
    <tr><td style="padding:26px 28px 8px;font-family:Georgia,'Times New Roman',serif;">
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${COLORS.ink};font-weight:normal;">${esc(heading)}</h1>
      ${paragraphsHtml(bodyText)}
      ${htmlBlocks.join("\n")}
      ${ctaUrl ? ctaButton(def.cta.label, ctaUrl) : ""}
      ${isAdmin ? "" : `<p style="margin:22px 0 4px;font-size:15px;color:${COLORS.ink};">Team ${esc(brand.name)}</p>`}
    </td></tr>
    <tr><td style="padding:16px 28px 24px;border-top:1px solid ${COLORS.line};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${COLORS.muted};">
      ${supportLine && !isAdmin ? `<div>${supportLine}</div>` : ""}
      <div>${esc(brand.name)} - Home Decor and Lifestyle Products</div>
      <div style="margin-top:6px;">${isAdmin ? `Internal notification for ${esc(brand.name)} staff. Change who receives these in Admin → Settings → Notifications.` : `You are receiving this message because of activity on your ${esc(brand.name)} account or order.`}</div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = [
    heading,
    "",
    bodyText,
    ...textBlocks.filter(Boolean).flatMap((b) => ["", b]),
    ...(ctaUrl ? ["", `${def.cta.label}: ${ctaUrl}`] : []),
    "",
    ...(isAdmin ? [] : [`Team ${brand.name}`, ...(brand.supportEmail ? [brand.supportEmail] : [])]),
    `${brand.name} - Home Decor and Lifestyle Products`,
  ].join("\n");

  return { subject, html, text };
}
