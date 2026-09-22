import { prisma } from "../../lib/prisma.js";
import { slugify } from "../../utils/slugify.js";
import { ApiError } from "../../utils/ApiError.js";

async function ensureUniqueSlug(baseSlug, ignoreId) {
  let slug = baseSlug;
  let suffix = 1;
  // Small catalog — a linear uniqueness probe is fine here.
  while (
    await prisma.category.findFirst({
      where: { slug, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
    })
  ) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
  return slug;
}

export async function listCategories({ includeInactive = false } = {}) {
  return prisma.category.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });
}

export async function getCategoryById(id) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!category) throw ApiError.notFound("Category not found");
  return category;
}

export async function getCategoryBySlug(slug) {
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category || !category.isActive) throw ApiError.notFound("Category not found");
  return category;
}

export async function createCategory(input) {
  const baseSlug = slugify(input.slug || input.name);
  const slug = await ensureUniqueSlug(baseSlug);

  if (input.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
    if (!parent) throw ApiError.badRequest("parentId does not reference an existing category");
  }

  return prisma.category.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      parentId: input.parentId ?? null,
      image: input.image ?? null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateCategory(id, input) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Category not found");

  if (input.parentId === id) {
    throw ApiError.badRequest("A category cannot be its own parent");
  }
  if (input.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
    if (!parent) throw ApiError.badRequest("parentId does not reference an existing category");
  }

  let slug = existing.slug;
  if (input.slug || input.name) {
    const baseSlug = slugify(input.slug || input.name);
    if (baseSlug !== existing.slug) {
      slug = await ensureUniqueSlug(baseSlug, id);
    }
  }

  return prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      slug,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
}

export async function deleteCategory(id) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!existing) throw ApiError.notFound("Category not found");

  if (existing._count.products > 0 || existing._count.children > 0) {
    throw ApiError.conflict(
      "This category has products or subcategories attached. Deactivate it instead of deleting it.",
      { productCount: existing._count.products, subcategoryCount: existing._count.children }
    );
  }

  await prisma.category.delete({ where: { id } });
}
