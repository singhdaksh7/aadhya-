import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";

export async function listCustomerWishlist(customerId) {
  const items = await prisma.wishlistItem.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          salePrice: true,
          stockQuantity: true,
          isActive: true,
          trackInventory: true,
          images: {
            select: { url: true, altText: true },
            orderBy: { isPrimary: "desc" },
            take: 1,
          },
        },
      },
      variant: {
        select: {
          id: true,
          name: true,
          sku: true,
          priceOverride: true,
          stockQuantity: true,
          isActive: true,
        },
      },
    },
  });

  return items.map((item) => ({
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    productName: item.product?.name,
    productSlug: item.product?.slug,
    price: item.product?.price,
    salePrice: item.product?.salePrice,
    stockQuantity: item.product?.stockQuantity,
    isProductActive: item.product?.isActive,
    image: item.product?.images?.[0]?.url || null,
    product: item.product
      ? {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          price: item.product.price,
          salePrice: item.product.salePrice,
          stockQuantity: item.product.stockQuantity,
          isActive: item.product.isActive,
          images: item.product.images,
        }
      : null,
    variant: item.variant
      ? {
          id: item.variant.id,
          name: item.variant.name,
          sku: item.variant.sku,
          priceOverride: item.variant.priceOverride,
          stockQuantity: item.variant.stockQuantity,
          isActive: item.variant.isActive,
        }
      : null,
    createdAt: item.createdAt,
  }));
}

export async function addToWishlist(customerId, { productId, variantId }) {
  if (!productId) {
    throw ApiError.badRequest("productId is required.");
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true },
  });

  if (!product) {
    throw ApiError.notFound("Product not found.");
  }

  if (!product.isActive) {
    throw ApiError.badRequest("Product is inactive and cannot be added to wishlist.");
  }

  let validVariantId = null;
  if (variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant || variant.productId !== productId) {
      throw ApiError.badRequest("Invalid product variant.");
    }
    validVariantId = variant.id;
  }

  const existing = await prisma.wishlistItem.findFirst({
    where: {
      customerId,
      productId,
      variantId: validVariantId,
    },
  });

  if (existing) {
    return existing;
  }

  const wishlistItem = await prisma.wishlistItem.create({
    data: {
      customerId,
      productId,
      variantId: validVariantId,
    },
  });

  return wishlistItem;
}

export async function removeFromWishlist(customerId, targetId) {
  if (!targetId) {
    throw ApiError.badRequest("Item ID or product ID is required.");
  }

  const item = await prisma.wishlistItem.findFirst({
    where: {
      customerId,
      OR: [{ id: targetId }, { productId: targetId }],
    },
  });

  if (!item) {
    throw ApiError.notFound("Wishlist item not found.");
  }

  await prisma.wishlistItem.delete({
    where: { id: item.id },
  });

  return { success: true };
}
