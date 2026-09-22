import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdmin, requireRole } from "../../middleware/adminAuth.js";
import { hashPassword } from "../../utils/password.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { created, ok } from "../../utils/apiResponse.js";

const createSchema = z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254), password: z.string().min(12).max(200), role: z.enum(["SUPER_ADMIN", "ADMIN"]).default("ADMIN") });
const patchSchema = z.object({ name: z.string().trim().min(1).max(120).optional(), email: z.string().trim().email().max(254).optional(), password: z.string().min(12).max(200).optional(), role: z.enum(["SUPER_ADMIN", "ADMIN"]).optional(), isActive: z.boolean().optional() }).refine((data) => Object.keys(data).length > 0);
const safe = ({ passwordHash, ...admin }) => admin;
async function protectLastSuperAdmin(id, change) {
  const existing = await prisma.adminUser.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Admin user not found");
  if (existing.role === "SUPER_ADMIN" && (change.role === "ADMIN" || change.isActive === false)) {
    const active = await prisma.adminUser.count({ where: { role: "SUPER_ADMIN", isActive: true } });
    if (existing.isActive && active <= 1) throw ApiError.badRequest("At least one active SUPER_ADMIN is required");
  }
  return existing;
}
const router = Router(); router.use(requireAdmin, requireRole("SUPER_ADMIN"));
router.get("/", asyncHandler(async (_req, res) => ok(res, (await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } })).map(safe))));
router.post("/", asyncHandler(async (req, res) => { const input = createSchema.parse(req.body); const { password, ...admin } = input; try { const row = await prisma.adminUser.create({ data: { ...admin, email: admin.email.toLowerCase(), passwordHash: await hashPassword(password) } }); created(res, safe(row)); } catch (error) { if (error.code === "P2002") throw ApiError.conflict("Email is already in use"); throw error; } }));
router.patch("/:id", asyncHandler(async (req, res) => { const input = patchSchema.parse(req.body); await protectLastSuperAdmin(req.params.id, input); try { const data = { ...input, ...(input.email ? { email: input.email.toLowerCase() } : {}), ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}) }; delete data.password; ok(res, safe(await prisma.adminUser.update({ where: { id: req.params.id }, data }))); } catch (error) { if (error.code === "P2002") throw ApiError.conflict("Email is already in use"); throw error; } }));
router.patch("/:id/status", asyncHandler(async (req, res) => { const input = z.object({ isActive: z.boolean() }).parse(req.body); await protectLastSuperAdmin(req.params.id, input); ok(res, safe(await prisma.adminUser.update({ where: { id: req.params.id }, data: input }))); }));
export default router;
