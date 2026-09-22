import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";

const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(200).optional() });
const statusSchema = z.object({ isActive: z.boolean() });
const customerSelect = { id: true, name: true, email: true, phone: true, isActive: true, createdAt: true, _count: { select: { orders: true } } };
const safeCustomer = (c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, isActive: c.isActive, createdAt: c.createdAt, ordersCount: c._count?.orders ?? c.orders?.length ?? 0, totalSpent: Number(c.orders?.reduce((sum, o) => sum + Number(o.totalAmount), 0) ?? 0) });

const router = Router();
router.use(requireAdmin);
router.get("/", asyncHandler(async (req, res) => {
  const { page, limit, search } = querySchema.parse(req.query);
  const where = search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }, { phone: { contains: search, mode: "insensitive" } }] } : {};
  const [customers, total] = await Promise.all([prisma.customer.findMany({ where, select: customerSelect, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }), prisma.customer.count({ where })]);
  ok(res, customers.map(safeCustomer), { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
}));
router.get("/:id", asyncHandler(async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id }, select: { ...customerSelect, addresses: { select: { id: true, label: true, city: true, state: true, isDefault: true } }, orders: { select: { id: true, orderNumber: true, totalAmount: true, status: true, paymentStatus: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 } } });
  if (!customer) throw ApiError.notFound("Customer not found");
  const totals = await prisma.order.aggregate({ where: { customerId: customer.id }, _sum: { totalAmount: true } });
  ok(res, { profile: safeCustomer(customer), addresses: customer.addresses, orderCount: customer._count.orders, recentOrders: customer.orders, totalSpend: Number(totals._sum.totalAmount ?? 0), status: customer.isActive ? "active" : "inactive" });
}));
router.patch("/:id/status", asyncHandler(async (req, res) => {
  const { isActive } = statusSchema.parse(req.body);
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (!customer) throw ApiError.notFound("Customer not found");
  await prisma.$transaction([prisma.customer.update({ where: { id: customer.id }, data: { isActive } }), ...(isActive ? [] : [prisma.customerRefreshSession.updateMany({ where: { customerId: customer.id, revokedAt: null }, data: { revokedAt: new Date() } })])]);
  ok(res, { id: customer.id, isActive });
}));
export default router;
