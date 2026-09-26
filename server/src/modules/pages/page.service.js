import { prisma } from "../../lib/prisma.js";
import { sanitizeRichText } from "../../utils/sanitizer.js";

export async function listPages({ search, pageType, status, page = 1, limit = 50 } = {}) {
  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } }
    ];
  }
  if (pageType) {
    where.pageType = pageType;
  }
  if (status) {
    where.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    prisma.page.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: Number(limit),
      include: { sections: { orderBy: { sortOrder: "asc" } } }
    }),
    prisma.page.count({ where })
  ]);

  return { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
}

export async function getPageById(id) {
  const page = await prisma.page.findUnique({
    where: { id },
    include: { sections: { orderBy: { sortOrder: "asc" } } }
  });
  if (!page) {
    const error = new Error("CMS Page not found");
    error.statusCode = 404;
    throw error;
  }
  return page;
}

export async function getPageBySlug(slug, { allowDraft = false } = {}) {
  const normalizedSlug = slug.toLowerCase().trim();
  const page = await prisma.page.findUnique({
    where: { slug: normalizedSlug },
    include: { sections: { orderBy: { sortOrder: "asc" }, where: { isActive: true } } }
  });

  if (!page) {
    const error = new Error("CMS Page not found");
    error.statusCode = 404;
    throw error;
  }

  if (!allowDraft && page.status !== "PUBLISHED") {
    const error = new Error("CMS Page not found or not published");
    error.statusCode = 404;
    throw error;
  }

  return page;
}

export async function createPage(data) {
  const normalizedSlug = data.slug.toLowerCase().trim();
  const existing = await prisma.page.findUnique({ where: { slug: normalizedSlug } });
  if (existing) {
    const error = new Error(`Page with slug "${normalizedSlug}" already exists`);
    error.statusCode = 400;
    throw error;
  }

  const sanitizedContent = data.content ? sanitizeRichText(data.content) : null;
  const isPublished = data.status === "PUBLISHED";

  return prisma.page.create({
    data: {
      name: data.name,
      slug: normalizedSlug,
      pageType: data.pageType || "STANDARD",
      status: data.status || "DRAFT",
      content: sanitizedContent,
      featuredImage: data.featuredImage || null,
      excerpt: data.excerpt || null,
      seoTitle: data.seoTitle || null,
      seoDescription: data.seoDescription || null,
      publishedAt: isPublished ? (data.publishedAt ? new Date(data.publishedAt) : new Date()) : null
    }
  });
}

export async function updatePage(id, data) {
  const existing = await getPageById(id);

  let normalizedSlug = existing.slug;
  if (data.slug && data.slug.toLowerCase().trim() !== existing.slug) {
    normalizedSlug = data.slug.toLowerCase().trim();
    const collision = await prisma.page.findUnique({ where: { slug: normalizedSlug } });
    if (collision) {
      const error = new Error(`Page with slug "${normalizedSlug}" already exists`);
      error.statusCode = 400;
      throw error;
    }
  }

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.slug !== undefined) updateData.slug = normalizedSlug;
  if (data.pageType !== undefined) updateData.pageType = data.pageType;
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "PUBLISHED" && !existing.publishedAt) {
      updateData.publishedAt = new Date();
    }
  }
  if (data.content !== undefined) updateData.content = data.content ? sanitizeRichText(data.content) : null;
  if (data.featuredImage !== undefined) updateData.featuredImage = data.featuredImage || null;
  if (data.excerpt !== undefined) updateData.excerpt = data.excerpt || null;
  if (data.seoTitle !== undefined) updateData.seoTitle = data.seoTitle || null;
  if (data.seoDescription !== undefined) updateData.seoDescription = data.seoDescription || null;

  return prisma.page.update({
    where: { id },
    data: updateData,
    include: { sections: { orderBy: { sortOrder: "asc" } } }
  });
}

export async function deletePage(id) {
  await getPageById(id);
  return prisma.page.delete({ where: { id } });
}

export async function togglePublishPage(id, { status }) {
  const existing = await getPageById(id);
  const targetStatus = status || (existing.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED");
  const publishedAt = targetStatus === "PUBLISHED" ? (existing.publishedAt || new Date()) : existing.publishedAt;

  return prisma.page.update({
    where: { id },
    data: { status: targetStatus, publishedAt }
  });
}
