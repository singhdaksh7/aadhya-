import { prisma } from "../../lib/prisma.js";
import { sanitizeRichText } from "../../utils/sanitizer.js";

export async function getPublicFaqs({ category } = {}) {
  const whereCategory = { isActive: true };
  if (category) {
    whereCategory.OR = [
      { slug: category.toLowerCase().trim() },
      { name: { contains: category, mode: "insensitive" } }
    ];
  }

  const categories = await prisma.fAQCategory.findMany({
    where: whereCategory,
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" }
      }
    }
  });

  return categories.filter(cat => cat.items.length > 0 || !category);
}

// Categories Admin
export async function listFaqCategories() {
  return prisma.fAQCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { items: true } }
    }
  });
}

export async function createFaqCategory(data) {
  const normalizedSlug = data.slug.toLowerCase().trim();
  const existing = await prisma.fAQCategory.findUnique({ where: { slug: normalizedSlug } });
  if (existing) {
    const error = new Error(`FAQ category with slug "${normalizedSlug}" already exists`);
    error.statusCode = 400;
    throw error;
  }

  return prisma.fAQCategory.create({
    data: {
      name: data.name,
      slug: normalizedSlug,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true
    }
  });
}

export async function updateFaqCategory(id, data) {
  const existing = await prisma.fAQCategory.findUnique({ where: { id } });
  if (!existing) {
    const error = new Error("FAQ category not found");
    error.statusCode = 404;
    throw error;
  }

  let normalizedSlug = existing.slug;
  if (data.slug && data.slug.toLowerCase().trim() !== existing.slug) {
    normalizedSlug = data.slug.toLowerCase().trim();
    const collision = await prisma.fAQCategory.findUnique({ where: { slug: normalizedSlug } });
    if (collision) {
      const error = new Error(`FAQ category with slug "${normalizedSlug}" already exists`);
      error.statusCode = 400;
      throw error;
    }
  }

  return prisma.fAQCategory.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      slug: normalizedSlug,
      sortOrder: data.sortOrder ?? existing.sortOrder,
      isActive: data.isActive ?? existing.isActive
    }
  });
}

export async function deleteFaqCategory(id) {
  const existing = await prisma.fAQCategory.findUnique({ where: { id } });
  if (!existing) {
    const error = new Error("FAQ category not found");
    error.statusCode = 404;
    throw error;
  }
  return prisma.fAQCategory.delete({ where: { id } });
}

export async function reorderFaqCategories(items) {
  const updates = items.map(item =>
    prisma.fAQCategory.update({
      where: { id: item.id },
      data: { sortOrder: item.sortOrder }
    })
  );
  return prisma.$transaction(updates);
}

// Items Admin
export async function listFaqItems({ categoryId, search } = {}) {
  const where = {};
  if (categoryId) {
    where.categoryId = categoryId;
  }
  if (search) {
    where.OR = [
      { question: { contains: search, mode: "insensitive" } },
      { answer: { contains: search, mode: "insensitive" } }
    ];
  }

  return prisma.fAQItem.findMany({
    where,
    orderBy: [
      { category: { sortOrder: "asc" } },
      { sortOrder: "asc" }
    ],
    include: {
      category: true
    }
  });
}

export async function createFaqItem(data) {
  const category = await prisma.fAQCategory.findUnique({ where: { id: data.categoryId } });
  if (!category) {
    const error = new Error("FAQ Category not found");
    error.statusCode = 404;
    throw error;
  }

  const sanitizedAnswer = sanitizeRichText(data.answer);

  return prisma.fAQItem.create({
    data: {
      categoryId: data.categoryId,
      question: data.question,
      answer: sanitizedAnswer,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true
    },
    include: { category: true }
  });
}

export async function updateFaqItem(id, data) {
  const existing = await prisma.fAQItem.findUnique({ where: { id } });
  if (!existing) {
    const error = new Error("FAQ Item not found");
    error.statusCode = 404;
    throw error;
  }

  if (data.categoryId) {
    const category = await prisma.fAQCategory.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      const error = new Error("FAQ Category not found");
      error.statusCode = 404;
      throw error;
    }
  }

  const updateData = {};
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.question !== undefined) updateData.question = data.question;
  if (data.answer !== undefined) updateData.answer = sanitizeRichText(data.answer);
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return prisma.fAQItem.update({
    where: { id },
    data: updateData,
    include: { category: true }
  });
}

export async function deleteFaqItem(id) {
  const existing = await prisma.fAQItem.findUnique({ where: { id } });
  if (!existing) {
    const error = new Error("FAQ Item not found");
    error.statusCode = 404;
    throw error;
  }
  return prisma.fAQItem.delete({ where: { id } });
}

export async function reorderFaqItems(items) {
  const updates = items.map(item =>
    prisma.fAQItem.update({
      where: { id: item.id },
      data: { sortOrder: item.sortOrder }
    })
  );
  return prisma.$transaction(updates);
}
