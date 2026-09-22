import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { created, noContent, ok } from "../../utils/apiResponse.js";
import { slugify } from "../../utils/slugify.js";

const dataSchema = z.object({ title: z.string().trim().min(1).max(200), slug: z.string().trim().max(220).optional(), description: z.string().trim().max(5000).nullable().optional(), heroImage: z.string().trim().url().nullable().optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().min(0).optional() });
const membershipSchema = z.object({ productIds: z.array(z.string().uuid()).max(500) });
const include = { products: { orderBy: { sortOrder: "asc" }, include: { product: { include: { images: { orderBy: { sortOrder: "asc" } }, category: true } } } } };

async function uniqueSlug(value, id) { let slug = slugify(value); let n = 1; while (await prisma.collection.findFirst({ where: { slug, ...(id ? { NOT: { id } } : {}) } })) slug = `${slugify(value)}-${++n}`; return slug; }
async function get(idOrSlug, activeOnly = false) { const row = await prisma.collection.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], ...(activeOnly ? { isActive: true } : {}) }, include }); if (!row) throw ApiError.notFound("Collection not found"); return row; }

export const publicCollectionRouter = Router();
publicCollectionRouter.get("/", asyncHandler(async (req, res) => { const rows = await prisma.collection.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }], include }); ok(res, rows); }));
publicCollectionRouter.get("/:slug", asyncHandler(async (req, res) => ok(res, await get(req.params.slug, true))));

export const adminCollectionRouter = Router();
adminCollectionRouter.use(requireAdmin);
adminCollectionRouter.get("/", asyncHandler(async (req, res) => ok(res, await prisma.collection.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }], include }))));
adminCollectionRouter.get("/:id", asyncHandler(async (req, res) => ok(res, await get(req.params.id))));
adminCollectionRouter.post("/", asyncHandler(async (req, res) => { const input = dataSchema.parse(req.body); const row = await prisma.collection.create({ data: { ...input, slug: await uniqueSlug(input.slug || input.title) }, include }); created(res, row); }));
adminCollectionRouter.patch("/:id", asyncHandler(async (req, res) => { const input = dataSchema.partial().parse(req.body); await get(req.params.id); const data = { ...input }; if (input.slug || input.title) data.slug = await uniqueSlug(input.slug || input.title, req.params.id); ok(res, await prisma.collection.update({ where: { id: req.params.id }, data, include })); }));
adminCollectionRouter.put("/:id/products", asyncHandler(async (req, res) => { const { productIds } = membershipSchema.parse(req.body); await get(req.params.id); const count = await prisma.product.count({ where: { id: { in: productIds } } }); if (count !== new Set(productIds).size) throw ApiError.badRequest("One or more products do not exist"); await prisma.$transaction([prisma.collectionProduct.deleteMany({ where: { collectionId: req.params.id } }), ...productIds.map((productId, sortOrder) => prisma.collectionProduct.create({ data: { collectionId: req.params.id, productId, sortOrder } }))]); ok(res, await get(req.params.id)); }));
adminCollectionRouter.delete("/:id", asyncHandler(async (req, res) => { await get(req.params.id); await prisma.collection.delete({ where: { id: req.params.id } }); noContent(res); }));
