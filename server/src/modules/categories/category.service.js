import { prisma } from "../../lib/prisma.js";
import { slugify } from "../../utils/slugify.js";
import { ApiError } from "../../utils/ApiError.js";

async function ensureUniqueSlug(baseSlug, ignoreId) {
  let slug = baseSlug;
  let suffix = 1;
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

async function validateNoCircularParent(categoryId, targetParentId) {
  if (!targetParentId) return;
  if (categoryId && categoryId === targetParentId) {
    throw ApiError.badRequest("A category cannot be its own parent");
  }
  let currId = targetParentId;
  const visited = new Set();
  while (currId) {
    if (visited.has(currId)) {
      throw ApiError.badRequest("Circular hierarchy detected in category ancestors");
    }
    visited.add(currId);
    if (categoryId && currId === categoryId) {
      throw ApiError.badRequest("Circular relationship: cannot assign descendant as parent");
    }
    const parentCat = await prisma.category.findUnique({
      where: { id: currId },
      select: { parentId: true },
    });
    if (!parentCat) break;
    currId = parentCat.parentId;
  }
}

export async function listCategories({ includeInactive = false, tree = false } = {}) {
  const categories = await prisma.category.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { products: true, children: true } },
      parent: { select: { id: true, name: true, slug: true } }
    },
  });

  if (tree) {
    const map = new Map();
    categories.forEach((cat) => map.set(cat.id, { ...cat, children: [] }));
    const rootNodes = [];
    categories.forEach((cat) => {
      const node = map.get(cat.id);
      if (cat.parentId && map.has(cat.parentId)) {
        map.get(cat.parentId).children.push(node);
      } else {
        rootNodes.push(node);
      }
    });
    return rootNodes;
  }

  return categories;
}

export async function getCategoryById(id) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      children: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { _count: { select: { products: true } } }
      },
      parent: true,
      _count: { select: { products: true, children: true } },
    },
  });
  if (!category) throw ApiError.notFound("Category not found");
  return category;
}

export async function getCategoryBySlug(slug) {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      children: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { _count: { select: { products: true } } }
      },
      parent: true,
      _count: { select: { products: true } },
    }
  });
  if (!category || !category.isActive) throw ApiError.notFound("Category not found");
  return category;
}

export async function createCategory(input) {
  const baseSlug = slugify(input.slug || input.name);
  const slug = await ensureUniqueSlug(baseSlug);

  if (input.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
    if (!parent) throw ApiError.badRequest("parentId does not reference an existing category");
    await validateNoCircularParent(null, input.parentId);
  }

  return prisma.category.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      parentId: input.parentId ?? null,
      image: input.image ?? null,
      icon: input.icon ?? null,
      logo: input.logo ?? null,
      desktopBanner: input.desktopBanner ?? null,
      mobileBanner: input.mobileBanner ?? null,
      isFeatured: input.isFeatured ?? false,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
    },
  });
}

export async function updateCategory(id, input) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Category not found");

  if (input.parentId !== undefined) {
    if (input.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
      if (!parent) throw ApiError.badRequest("parentId does not reference an existing category");
      await validateNoCircularParent(id, input.parentId);
    }
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
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.logo !== undefined ? { logo: input.logo } : {}),
      ...(input.desktopBanner !== undefined ? { desktopBanner: input.desktopBanner } : {}),
      ...(input.mobileBanner !== undefined ? { mobileBanner: input.mobileBanner } : {}),
      ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
      ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
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

export async function getAllCategoryDescendantIds(categoryId) {
  const result = new Set([categoryId]);
  const queue = [categoryId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = await prisma.category.findMany({
      where: { parentId: currentId },
      select: { id: true },
    });
    for (const child of children) {
      if (!result.has(child.id)) {
        result.add(child.id);
        queue.push(child.id);
      }
    }
  }

  return Array.from(result);
}

