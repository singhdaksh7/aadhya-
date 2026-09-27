import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";

function sanitizeText(str) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>?/gm, "").trim();
}

export async function checkVerifiedPurchase(customerId, productId) {
  if (!customerId || !productId) return false;
  const order = await prisma.order.findFirst({
    where: {
      customerId,
      status: { not: "CANCELLED" },
      OR: [
        { paymentStatus: "PAID" },
        { status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] } },
      ],
      items: {
        some: {
          productId,
        },
      },
    },
  });
  return !!order;
}

export async function getProductReviewSummary(productId) {
  const reviews = await prisma.productReview.findMany({
    where: {
      productId,
      status: "APPROVED",
    },
    select: {
      rating: true,
    },
  });

  const reviewCount = reviews.length;
  if (reviewCount === 0) {
    return {
      averageRating: 0,
      reviewCount: 0,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const averageRating = Math.round((sum / reviewCount) * 10) / 10;

  const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    if (ratingBreakdown[r.rating] !== undefined) {
      ratingBreakdown[r.rating]++;
    }
  }

  return {
    averageRating,
    reviewCount,
    ratingBreakdown,
  };
}

export async function listPublicProductReviews(productId, query = {}) {
  const page = Math.max(1, parseInt(query.page || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(query.limit || "10", 10)));
  const skip = (page - 1) * limit;

  const where = {
    productId,
    status: "APPROVED",
  };

  if (query.verifiedOnly === "true" || query.verifiedOnly === true) {
    where.isVerifiedPurchase = true;
  }

  let orderBy = { createdAt: "desc" };
  if (query.sortBy === "highest") {
    orderBy = [{ rating: "desc" }, { createdAt: "desc" }];
  } else if (query.sortBy === "lowest") {
    orderBy = [{ rating: "asc" }, { createdAt: "desc" }];
  }

  const [items, totalItems, summary] = await Promise.all([
    prisma.productReview.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        isVerifiedPurchase: true,
        createdAt: true,
        customer: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.productReview.count({ where }),
    getProductReviewSummary(productId),
  ]);

  const totalPages = Math.ceil(totalItems / limit) || 1;

  return {
    items: items.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      isVerifiedPurchase: r.isVerifiedPurchase,
      createdAt: r.createdAt,
      customerName: r.customer?.name || "Customer",
    })),
    meta: {
      page,
      limit,
      totalItems,
      totalPages,
    },
    summary,
  };
}

export async function createCustomerReview(customerId, input) {
  const { productId, rating, title, comment } = input;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true },
  });

  if (!product || !product.isActive) {
    throw ApiError.notFound("Product not found or inactive.");
  }

  const ratingInt = parseInt(rating, 10);
  if (isNaN(ratingInt) || ratingInt < 1 || ratingInt > 5) {
    throw ApiError.badRequest("Rating must be an integer between 1 and 5.");
  }

  const sanitizedComment = sanitizeText(comment);
  if (!sanitizedComment || sanitizedComment.length < 3) {
    throw ApiError.badRequest("Review comment must be at least 3 characters long.");
  }
  if (sanitizedComment.length > 2000) {
    throw ApiError.badRequest("Review comment cannot exceed 2000 characters.");
  }

  const sanitizedTitle = title ? sanitizeText(title).slice(0, 120) : null;

  const existing = await prisma.productReview.findUnique({
    where: {
      customerId_productId: {
        customerId,
        productId,
      },
    },
  });

  if (existing) {
    throw ApiError.badRequest("You have already reviewed this product. You can edit your review from your account.");
  }

  const isVerifiedPurchase = await checkVerifiedPurchase(customerId, productId);

  const review = await prisma.productReview.create({
    data: {
      productId,
      customerId,
      rating: ratingInt,
      title: sanitizedTitle,
      comment: sanitizedComment,
      status: "PENDING",
      isVerifiedPurchase,
    },
  });

  return review;
}

export async function listCustomerReviews(customerId) {
  const reviews = await prisma.productReview.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          images: {
            select: { url: true, altText: true },
            orderBy: { isPrimary: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  return reviews.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.product?.name,
    productSlug: r.product?.slug,
    productPrice: r.product?.price,
    productImage: r.product?.images?.[0]?.url || null,
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    status: r.status,
    isVerifiedPurchase: r.isVerifiedPurchase,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function updateCustomerReview(customerId, reviewId, input) {
  const review = await prisma.productReview.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw ApiError.notFound("Review not found.");
  }

  if (review.customerId !== customerId) {
    throw ApiError.forbidden("You do not have permission to update this review.");
  }

  const { rating, title, comment } = input;
  const ratingInt = rating ? parseInt(rating, 10) : review.rating;
  if (isNaN(ratingInt) || ratingInt < 1 || ratingInt > 5) {
    throw ApiError.badRequest("Rating must be an integer between 1 and 5.");
  }

  const sanitizedComment = comment !== undefined ? sanitizeText(comment) : review.comment;
  if (!sanitizedComment || sanitizedComment.length < 3) {
    throw ApiError.badRequest("Review comment must be at least 3 characters long.");
  }
  if (sanitizedComment.length > 2000) {
    throw ApiError.badRequest("Review comment cannot exceed 2000 characters.");
  }

  const sanitizedTitle = title !== undefined ? (title ? sanitizeText(title).slice(0, 120) : null) : review.title;

  const isVerifiedPurchase = await checkVerifiedPurchase(customerId, review.productId);

  const updated = await prisma.productReview.update({
    where: { id: reviewId },
    data: {
      rating: ratingInt,
      title: sanitizedTitle,
      comment: sanitizedComment,
      status: "PENDING",
      isVerifiedPurchase,
      moderatedAt: null,
      moderatedByAdminId: null,
    },
  });

  return updated;
}

export async function deleteCustomerReview(customerId, reviewId) {
  const review = await prisma.productReview.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw ApiError.notFound("Review not found.");
  }

  if (review.customerId !== customerId) {
    throw ApiError.forbidden("You do not have permission to delete this review.");
  }

  await prisma.productReview.delete({
    where: { id: reviewId },
  });

  return { success: true };
}

export async function listAdminReviews(query = {}) {
  const page = Math.max(1, parseInt(query.page || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10)));
  const skip = (page - 1) * limit;

  const where = {};

  if (query.status && ["PENDING", "APPROVED", "REJECTED"].includes(query.status.toUpperCase())) {
    where.status = query.status.toUpperCase();
  }

  if (query.rating) {
    const r = parseInt(query.rating, 10);
    if (!isNaN(r) && r >= 1 && r <= 5) {
      where.rating = r;
    }
  }

  if (query.search && query.search.trim()) {
    const s = query.search.trim();
    where.OR = [
      { comment: { contains: s, mode: "insensitive" } },
      { title: { contains: s, mode: "insensitive" } },
      { product: { name: { contains: s, mode: "insensitive" } } },
      { customer: { name: { contains: s, mode: "insensitive" } } },
      { customer: { email: { contains: s, mode: "insensitive" } } },
    ];
  }

  const [items, totalItems] = await Promise.all([
    prisma.productReview.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: { id: true, name: true, slug: true, images: { select: { url: true }, take: 1 } },
        },
        customer: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.productReview.count({ where }),
  ]);

  const totalPages = Math.ceil(totalItems / limit) || 1;

  return {
    items: items.map((r) => ({
      id: r.id,
      productId: r.productId,
      productName: r.product?.name,
      productSlug: r.product?.slug,
      productImage: r.product?.images?.[0]?.url || null,
      customerId: r.customerId,
      customerName: r.customer?.name,
      customerEmail: r.customer?.email,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      status: r.status,
      isVerifiedPurchase: r.isVerifiedPurchase,
      moderatedAt: r.moderatedAt,
      moderatedByAdminId: r.moderatedByAdminId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    meta: {
      page,
      limit,
      totalItems,
      totalPages,
    },
  };
}

export async function moderateAdminReview(adminUserId, reviewId, status) {
  const upperStatus = (status || "").toUpperCase();
  if (!["APPROVED", "REJECTED"].includes(upperStatus)) {
    throw ApiError.badRequest("Status must be APPROVED or REJECTED.");
  }

  const review = await prisma.productReview.findUnique({
    where: { id: reviewId },
    include: { product: { select: { name: true } } },
  });

  if (!review) {
    throw ApiError.notFound("Review not found.");
  }

  if (review.status === upperStatus) {
    return review;
  }

  const updated = await prisma.productReview.update({
    where: { id: reviewId },
    data: {
      status: upperStatus,
      moderatedAt: new Date(),
      moderatedByAdminId: adminUserId,
    },
  });

  // Create customer notification idempotently
  try {
    const notifTitle = upperStatus === "APPROVED" ? "Review Approved" : "Review Rejected";
    const notifMsg =
      upperStatus === "APPROVED"
        ? `Your review for "${review.product?.name || "product"}" has been approved and published.`
        : `Your review for "${review.product?.name || "product"}" was not approved.`;

    const existingNotif = await prisma.customerNotification.findFirst({
      where: {
        customerId: review.customerId,
        type: `REVIEW_${upperStatus}`,
        link: `/product/${review.productId}`,
      },
    });

    if (!existingNotif) {
      await prisma.customerNotification.create({
        data: {
          customerId: review.customerId,
          type: `REVIEW_${upperStatus}`,
          title: notifTitle,
          message: notifMsg,
          link: `/product/${review.productId}`,
        },
      });
    }
  } catch (err) {
    // Non-blocking notification creation error
    console.error("Failed to create customer notification for review moderation:", err);
  }

  return updated;
}

export async function deleteAdminReview(reviewId) {
  const review = await prisma.productReview.findUnique({
    where: { id: reviewId },
  });

  if (!review) {
    throw ApiError.notFound("Review not found.");
  }

  await prisma.productReview.delete({
    where: { id: reviewId },
  });

  return { success: true };
}
