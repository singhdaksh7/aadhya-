import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { deliverEmail, getSmtpConfig } from "../email/email.service.js";
import { getBrand } from "../mailer/mailer.service.js";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

const PHONE_REGEX = /^[+0-9()\-\s]{7,25}$/;

export const bulkInquiryInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email address").max(150),
  phone: z.string().trim().regex(PHONE_REGEX, "Invalid phone number"),
  company: z.string().trim().max(150).optional().nullable(),
  quantity: z.coerce.number().int().positive("Quantity must be a positive number").max(1000000),
  budget: z.string().trim().max(100).optional().nullable(),
  occasion: z.string().trim().min(2, "Occasion is required").max(120),
  preferredDate: z.string().trim().max(80).optional().nullable(),
  location: z.string().trim().max(150).optional().nullable(),
  message: z.string().trim().min(5, "Message must be at least 5 characters").max(2000),
  honeypot: z.string().optional(), // Anti-spam honeypot
});

/**
 * Creates a new Bulk Gifting Inquiry record and triggers owner email notification.
 */
export async function createBulkGiftingInquiry(data) {
  const parsed = bulkInquiryInputSchema.parse(data);

  // If honeypot is filled, silently discard or accept without emailing
  if (parsed.honeypot && parsed.honeypot.trim() !== "") {
    return {
      id: "bot-ignored",
      name: parsed.name,
      status: "NEW",
    };
  }

  const inquiry = await prisma.bulkGiftingInquiry.create({
    data: {
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      phone: parsed.phone,
      company: parsed.company || null,
      quantity: parsed.quantity,
      budget: parsed.budget || null,
      occasion: parsed.occasion,
      preferredDate: parsed.preferredDate || null,
      location: parsed.location || null,
      message: parsed.message,
      status: "NEW",
      source: "STOREFRONT_GIFTING",
    },
  });

  // Trigger email notification in background (non-blocking)
  notifyBulkInquiry(inquiry).catch((err) => {
    console.error("[bulk-gifting] failed to send email notification:", err.message);
  });

  return inquiry;
}

/**
 * Sends notification emails to configured admin recipients for a new bulk gifting enquiry.
 */
export async function notifyBulkInquiry(inquiry) {
  try {
    // 1. Resolve recipients: check configured admin notification recipients, fallback to support/admin email
    const recipients = await prisma.adminNotificationRecipient.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
      select: { email: true },
    });

    let targetEmails = recipients.map((r) => r.email);
    if (!targetEmails.length) {
      const brand = await getBrand().catch(() => null);
      if (brand?.supportEmail) targetEmails = [brand.supportEmail];
      else if (process.env.ADMIN_EMAIL) targetEmails = [process.env.ADMIN_EMAIL];
    }

    if (!targetEmails.length) {
      return { sent: 0, reason: "no_recipients_configured" };
    }

    const brand = await getBrand().catch(() => ({ name: "Tushaqsa" }));
    const brandName = brand.name || "Tushaqsa";
    const subject = `[Bulk Gifting Inquiry] ${inquiry.occasion} - ${inquiry.name} (${inquiry.quantity} pcs)`;

    const text = `
New Bulk Gifting Inquiry Received

Inquiry ID: ${inquiry.id}
Date: ${inquiry.createdAt ? new Date(inquiry.createdAt).toLocaleString("en-IN") : new Date().toLocaleString("en-IN")}
Name: ${inquiry.name}
Email: ${inquiry.email}
Phone: ${inquiry.phone}
Company / Organization: ${inquiry.company || "N/A"}
Approximate Quantity: ${inquiry.quantity}
Budget Range: ${inquiry.budget || "N/A"}
Occasion / Requirement: ${inquiry.occasion}
Preferred Delivery Date: ${inquiry.preferredDate || "N/A"}
Delivery Location: ${inquiry.location || "N/A"}

Message:
${inquiry.message}

View and manage this inquiry in the Admin panel:
${process.env.FRONTEND_URL || "https://aadyavocational.com"}/admin/gifting/inquiries
`.trim();

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e1e1e; background-color: #fbf9f5; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e8e3d9; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="background: #2b2623; color: #ffffff; padding: 24px 28px;">
      <h2 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 600; letter-spacing: 0.02em;">New Bulk Gifting Inquiry</h2>
      <p style="margin: 0; font-size: 13px; color: #e6dfd5;">${escapeHtml(brandName)} Storefront</p>
    </div>
    <div style="padding: 28px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
        <tr><td style="padding: 6px 0; color: #6e6761; width: 160px;">Inquiry ID:</td><td style="padding: 6px 0; font-family: monospace; font-size: 12px;">${escapeHtml(inquiry.id)}</td></tr>
        <tr><td style="padding: 6px 0; color: #6e6761;">Customer Name:</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(inquiry.name)}</td></tr>
        <tr><td style="padding: 6px 0; color: #6e6761;">Email:</td><td style="padding: 6px 0;"><a href="mailto:${escapeHtml(inquiry.email)}" style="color: #9a472c;">${escapeHtml(inquiry.email)}</a></td></tr>
        <tr><td style="padding: 6px 0; color: #6e6761;">Phone:</td><td style="padding: 6px 0;"><a href="tel:${escapeHtml(inquiry.phone)}" style="color: #9a472c;">${escapeHtml(inquiry.phone)}</a></td></tr>
        <tr><td style="padding: 6px 0; color: #6e6761;">Company:</td><td style="padding: 6px 0;">${escapeHtml(inquiry.company || "—")}</td></tr>
        <tr><td style="padding: 6px 0; color: #6e6761;">Approximate Quantity:</td><td style="padding: 6px 0; font-weight: 600;">${Number(inquiry.quantity).toLocaleString()} units</td></tr>
        <tr><td style="padding: 6px 0; color: #6e6761;">Budget Range:</td><td style="padding: 6px 0;">${escapeHtml(inquiry.budget || "—")}</td></tr>
        <tr><td style="padding: 6px 0; color: #6e6761;">Occasion:</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(inquiry.occasion)}</td></tr>
        <tr><td style="padding: 6px 0; color: #6e6761;">Preferred Date:</td><td style="padding: 6px 0;">${escapeHtml(inquiry.preferredDate || "—")}</td></tr>
        <tr><td style="padding: 6px 0; color: #6e6761;">Location / City:</td><td style="padding: 6px 0;">${escapeHtml(inquiry.location || "—")}</td></tr>
      </table>

      <div style="background: #f7f5f0; border-left: 4px solid #9a472c; padding: 14px 18px; border-radius: 4px; margin-bottom: 28px;">
        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #9a472c;">Client Message</p>
        <p style="margin: 0; font-size: 14px; white-space: pre-wrap; color: #333333;">${escapeHtml(inquiry.message)}</p>
      </div>

      <div style="text-align: center; margin-top: 10px;">
        <a href="${process.env.FRONTEND_URL || "https://aadyavocational.com"}/admin/gifting/inquiries" style="display: inline-block; background: #9a472c; color: #ffffff; text-decoration: none; padding: 12px 26px; font-size: 13px; font-weight: 600; border-radius: 9999px; letter-spacing: 0.04em;">Open in Admin Panel</a>
      </div>
    </div>
  </div>
</body>
</html>
`.trim();

    let sentCount = 0;
    for (const email of targetEmails) {
      const res = await deliverEmail({
        to: email,
        subject,
        html,
        text,
        type: "BULK_GIFTING_INQUIRY",
        event: "BULK_GIFTING_INQUIRY",
        audience: "ADMIN",
        source: "STOREFRONT",
      }).catch((e) => {
        console.error("[bulk-gifting] error delivering to", email, e.message);
        return { sent: false };
      });
      if (res?.sent) sentCount++;
    }

    // Customer confirmation email
    if (inquiry.email) {
      deliverCustomerConfirmation(inquiry, brandName).catch((err) => {
        console.error("[bulk-gifting] failed to send customer confirmation:", err.message);
      });
    }

    return { sent: sentCount };
  } catch (err) {
    console.error("[bulk-gifting] notify error:", err);
    return { sent: 0, error: err.message };
  }
}

async function deliverCustomerConfirmation(inquiry, brandName) {
  const subject = `We received your gifting enquiry — ${brandName}`;
  const text = `
Dear ${inquiry.name},

Thank you for reaching out to ${brandName} regarding your bulk/corporate gifting requirements.

We have received your enquiry for ${inquiry.quantity} pieces for ${inquiry.occasion}. Our team will review your specifications and contact you shortly at ${inquiry.phone || inquiry.email}.

Best regards,
The ${brandName} Team
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e1e1e; background-color: #fbf9f5; padding: 24px;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e8e3d9; padding: 28px;">
    <h3 style="margin-top: 0; color: #2b2623; font-size: 18px;">Thank you for your enquiry, ${escapeHtml(inquiry.name)}</h3>
    <p style="font-size: 14px; color: #4a4541;">We have received your request for <strong>${inquiry.quantity} items</strong> for <strong>${escapeHtml(inquiry.occasion)}</strong>.</p>
    <p style="font-size: 14px; color: #4a4541;">Our artisan gifting team will review your requirements and get in touch with you shortly.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
    <p style="font-size: 12px; color: #888;">Warm regards,<br /><strong>${escapeHtml(brandName)}</strong></p>
  </div>
</body>
</html>
`.trim();

  return deliverEmail({
    to: inquiry.email,
    subject,
    html,
    text,
    type: "CUSTOMER_GIFTING_CONFIRMATION",
    event: "CUSTOMER_GIFTING_CONFIRMATION",
    audience: "CUSTOMER",
    source: "SYSTEM",
  });
}

/**
 * Admin: List bulk gifting inquiries with search, status filtering, and pagination.
 */
export async function listBulkGiftingInquiries({ page = 1, limit = 20, status, search }) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (p - 1) * l;

  const where = {};
  if (status && ["NEW", "CONTACTED", "QUALIFIED", "CLOSED"].includes(status)) {
    where.status = status;
  }
  if (search && String(search).trim()) {
    const q = String(search).trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { occasion: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.bulkGiftingInquiry.count({ where }),
    prisma.bulkGiftingInquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: l,
    }),
  ]);

  return {
    items,
    pagination: {
      page: p,
      limit: l,
      total,
      pages: Math.ceil(total / l),
    },
  };
}

/**
 * Admin: Get a single bulk gifting inquiry by ID.
 */
export async function getBulkGiftingInquiry(id) {
  return prisma.bulkGiftingInquiry.findUnique({ where: { id } });
}

/**
 * Admin: Update status and optional internal notes for an inquiry.
 */
export async function updateBulkGiftingInquiry(id, data) {
  const updateData = {};
  if (data.status && ["NEW", "CONTACTED", "QUALIFIED", "CLOSED"].includes(data.status)) {
    updateData.status = data.status;
  }
  if (typeof data.internalNotes === "string") {
    updateData.internalNotes = data.internalNotes;
  }
  return prisma.bulkGiftingInquiry.update({
    where: { id },
    data: updateData,
  });
}

