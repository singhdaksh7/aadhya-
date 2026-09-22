import crypto from "node:crypto";
import request from "supertest";
import { prisma } from "../src/lib/prisma.js";
import { env } from "../src/config/env.js";
import { hashToken } from "../src/utils/secureToken.js";
import { hashPassword } from "../src/utils/password.js";

export async function resetDb() {
  if (process.env.NODE_ENV !== "test" || !/(_test|test)/i.test(process.env.DATABASE_URL || "")) {
    throw new Error("Refusing to reset a database outside the dedicated test environment.");
  }
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.customerRefreshSession.deleteMany();
  await prisma.address.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.orderAddress.deleteMany();
  await prisma.order.deleteMany();
  await prisma.collectionProduct.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productBookDetails.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.siteSetting.deleteMany();
  await prisma.newsletterSubscriber.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.customer.deleteMany();
}

export async function seedTestAdmin(overrides = {}) {
  const passwordHash = await hashPassword(overrides.password || env.admin.password);
  return prisma.adminUser.create({
    data: {
      name: overrides.name || env.admin.name,
      email: (overrides.email || env.admin.email).toLowerCase(),
      passwordHash,
      role: overrides.role || "SUPER_ADMIN",
      isActive: overrides.isActive ?? true,
    },
  });
}

export async function seedTestCategory(overrides = {}) {
  return prisma.category.create({
    data: {
      name: overrides.name || "Test Category",
      slug: overrides.slug || "test-category",
      isActive: overrides.isActive ?? true,
      sortOrder: overrides.sortOrder ?? 0,
    },
  });
}

export async function seedTestProduct(overrides = {}) {
  const category = overrides.category || (await seedTestCategory());
  return prisma.product.create({
    data: {
      name: overrides.name || "Test Product",
      slug: overrides.slug || "test-product",
      productType: overrides.productType || "PHYSICAL",
      categoryId: category.id,
      price: overrides.price ?? 500,
      salePrice: overrides.salePrice ?? null,
      stockQuantity: overrides.stockQuantity ?? 10,
      trackInventory: overrides.trackInventory ?? true,
      isActive: overrides.isActive ?? true,
      sku: overrides.sku ?? null,
    },
  });
}

export const VALID_CUSTOMER = { name: "Test Customer", email: "customer@example.com", phone: "9876543210" };
export const VALID_ADDRESS = {
  fullName: "Test Customer",
  phone: "9876543210",
  addressLine1: "123 MG Road",
  city: "Bengaluru",
  state: "Karnataka",
  postalCode: "560001",
  country: "India",
};
export const VALID_ACCOUNT_ADDRESS = { ...VALID_ADDRESS, label: "Home" };

// Seeds a customer directly via Prisma (bypasses the register endpoint) for
// tests that need a customer row without exercising the auth flow itself.
export async function seedTestCustomer(overrides = {}) {
  const passwordHash = await hashPassword(overrides.password || "SafePassword123!");
  return prisma.customer.create({
    data: {
      name: overrides.name || "Test Customer",
      email: (overrides.email || "customer@example.com").toLowerCase(),
      phone: overrides.phone === undefined ? "9876543210" : overrides.phone,
      passwordHash,
      isActive: overrides.isActive ?? true,
    },
  });
}

// Registers a customer through the real HTTP endpoint (so cookies/tokens are
// produced exactly as a browser would receive them) and returns a supertest
// agent that carries the refresh cookie for subsequent requests.
export async function registerCustomer(app, overrides = {}) {
  const credentials = {
    name: overrides.name || "Test Customer",
    email: overrides.email || "customer@example.com",
    password: overrides.password || "SafePassword123!",
    phone: overrides.phone === undefined ? "9876543210" : overrides.phone,
  };
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/register").send(credentials);
  return { agent, accessToken: res.body?.data?.accessToken, customer: res.body?.data?.customer, credentials, res };
}

// Inserts a password reset token row directly, returning the raw (unhashed)
// token, so tests can exercise expired/used/invalid paths without waiting on
// real clocks or the forgot-password email flow.
export async function createRawResetToken(customerId, { expired = false, used = false } = {}) {
  const token = crypto.randomBytes(24).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      customerId,
      tokenHash: hashToken(token),
      expiresAt: expired ? new Date(Date.now() - 1000) : new Date(Date.now() + 3600000),
      usedAt: used ? new Date() : null,
    },
  });
  return token;
}
