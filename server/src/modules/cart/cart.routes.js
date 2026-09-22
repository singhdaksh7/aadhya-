import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";
import { requireCustomer } from "../../middleware/customerAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";

const router = Router(); router.use(requireCustomer);
const line = z.object({ slug: z.string().trim().min(1), variantId: z.string().uuid().nullable().optional(), quantity: z.number().int().min(1).max(999) });
const include = { items: { include: { product: { include: { images: true } }, variant: true } } };
async function cartFor(customerId) { return prisma.cart.upsert({ where: { customerId }, create: { customerId }, update: {}, include }); }
function serialize(cart) { return cart.items.filter((i) => i.product.isActive && (!i.variant || i.variant.isActive)).map((i) => ({ product: i.product, variant: i.variant, quantity: i.quantity })); }
async function resolve(input) {
  const product = await prisma.product.findFirst({ where: { slug: input.slug, isActive: true }, include: { variants: { where: { isActive: true } } } });
  if (!product) throw ApiError.notFound("Product not found"); let variant = null;
  if (input.variantId) { variant = product.variants.find((v) => v.id === input.variantId); if (!variant) throw ApiError.badRequest("Variant is unavailable or does not belong to this product"); }
  else if (product.variants.length) throw ApiError.badRequest("Select an active variant for this product");
  return { product, variant, max: variant ? variant.stockQuantity : (product.trackInventory ? product.stockQuantity : 999) };
}
async function put(customerId, input, add = false, { strict = true } = {}) {
  const { product, variant, max } = await resolve(input); const cart = await cartFor(customerId); const variantId = variant?.id ?? null;
  // A direct request that asks to add/set a positive quantity against zero
  // available stock is a forged/stale request, not a removal — reject it
  // outright rather than silently clamping to 0 and reporting success. Merge
  // (strict:false) intentionally keeps its documented clamp-to-available
  // behavior instead, since a guest cart line going out of stock between add
  // and login shouldn't abort merging the rest of the cart.
  if (strict && max <= 0 && input.quantity > 0) throw ApiError.badRequest("This product is currently out of stock");
  const old = cart.items.find((i) => i.productId === product.id && i.variantId === variantId)?.quantity || 0; const quantity = Math.min(add ? old + input.quantity : input.quantity, max);
  if (quantity < 1) await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId: product.id, variantId } });
  else if (variantId) await prisma.cartItem.upsert({ where: { cartId_productId_variantId: { cartId: cart.id, productId: product.id, variantId } }, create: { cartId: cart.id, productId: product.id, variantId, quantity }, update: { quantity } });
  else { const existing = cart.items.find((i) => i.productId === product.id && i.variantId === null); if (existing) await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity } }); else await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity } }); }
  return serialize(await cartFor(customerId));
}
router.get("/", asyncHandler(async (req, res) => ok(res, serialize(await cartFor(req.customer.id)))));
router.post("/items", asyncHandler(async (req, res) => ok(res, await put(req.customer.id, line.parse(req.body), true))));
router.patch("/items/:slug", asyncHandler(async (req, res) => { ok(res, await put(req.customer.id, line.parse({ ...req.body, slug: req.params.slug }))); }));
router.delete("/items/:slug", asyncHandler(async (req, res) => { const { variantId } = line.pick({ variantId: true }).parse(req.body); const cart = await cartFor(req.customer.id); await prisma.cartItem.deleteMany({ where: { cartId: cart.id, product: { slug: req.params.slug }, variantId: variantId ?? null } }); ok(res, { deleted: true }); }));
router.delete("/", asyncHandler(async (req, res) => { const cart = await cartFor(req.customer.id); await prisma.cartItem.deleteMany({ where: { cartId: cart.id } }); ok(res, { deleted: true }); }));
router.post("/merge", asyncHandler(async (req, res) => { const lines = z.object({ items: z.array(line).max(100) }).parse(req.body).items; for (const item of lines) await resolve(item); for (const item of lines) await put(req.customer.id, item, true, { strict: false }); ok(res, serialize(await cartFor(req.customer.id))); }));
export default router;
