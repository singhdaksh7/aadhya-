import crypto from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { hashPassword } from "../../utils/password.js";
import { normalizeIndianPhone } from "./customer-auth.validators.js";

const isUniqueViolation = (error) => error?.code === "P2002";

// Called once an order is confirmed (online payment verified, or COD placed). A guest order gets a
// customer account for its email address; the account has a random, unknown password and
// `passwordSetAt = null`, so the only way in is the one-time email code, after which the customer is
// asked to choose a password. The order is linked to the account so it shows up after login.
// Account-takeover note: nobody can sign in without receiving the code at that mailbox, so placing an
// order with someone else's email gives the orderer no access.
export async function ensureAccountForOrder(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true, customerEmail: true, customerName: true, customerPhone: true },
  });
  if (!order || !order.customerEmail) return { linked: false, created: false };
  if (order.customerId) return { linked: true, created: false, customerId: order.customerId };

  const email = order.customerEmail.trim().toLowerCase();
  let customer = await prisma.customer.findUnique({ where: { email } });
  let created = false;
  if (!customer) {
    const phone = normalizeIndianPhone(order.customerPhone || "");
    try {
      customer = await prisma.customer.create({
        data: {
          name: String(order.customerName || email.split("@")[0]).slice(0, 120),
          email,
          phone: /^[6-9]\d{9}$/.test(phone) ? phone : null,
          passwordHash: await hashPassword(crypto.randomBytes(32).toString("hex")),
          autoCreated: true,
          passwordSetAt: null,
        },
      });
      created = true;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      customer = await prisma.customer.findUnique({ where: { email } });
    }
  }
  if (!customer || !customer.isActive) return { linked: false, created };
  await prisma.order.updateMany({ where: { id: order.id, customerId: null }, data: { customerId: customer.id } });
  return { linked: true, created, customerId: customer.id };
}
