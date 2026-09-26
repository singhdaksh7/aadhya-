import { prisma } from "../../lib/prisma.js";
import { sanitizeRichText } from "../../utils/sanitizer.js";

export async function listPublicBlogPosts({ category, tag, search, featuredOnly, page = 1, limit = 12 } = {}) {
  const now = new Date();
  const where = {
    status: "PUBLISHED",
    publishDate: { lte: now }
  };

  if (category) {
    where.category = { equals: category, mode: "insensitive" };
  }
  if (featuredOnly === "true" || featuredOnly === true) {
    where.isFeatured = true;
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { excerpt: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } }
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { publishDate: "desc" },
      skip,
      take: Number(limit),
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        featuredImage: true,
        author: true,
        category: true,
        tags: true,
        isFeatured: true,
        publishDate: true,
        createdAt: true
      }
    }),
    prisma.blogPost.count({ where })
  ]);

  return { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
}

export async function getPublicBlogPostBySlug(slug, { allowDraft = false } = {}) {
  const normalizedSlug = slug.toLowerCase().trim();
  const post = await prisma.blogPost.findUnique({
    where: { slug: normalizedSlug }
  });

  if (!post) {
    const error = new Error("Blog post not found");
    error.statusCode = 404;
    throw error;
  }

  const isPublishedAndActive = post.status === "PUBLISHED" && new Date(post.publishDate) <= new Date();
  if (!allowDraft && !isPublishedAndActive) {
    const error = new Error("Blog post not found or not published");
    error.statusCode = 404;
    throw error;
  }

  return post;
}

export async function listAdminBlogPosts({ search, category, status, page = 1, limit = 50 } = {}) {
  const where = {};
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } }
    ];
  }
  if (category) {
    where.category = category;
  }
  if (status) {
    where.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit)
    }),
    prisma.blogPost.count({ where })
  ]);

  return { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
}

export async function getBlogPostById(id) {
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) {
    const error = new Error("Blog post not found");
    error.statusCode = 404;
    throw error;
  }
  return post;
}

export async function createBlogPost(data) {
  const normalizedSlug = data.slug.toLowerCase().trim();
  const existing = await prisma.blogPost.findUnique({ where: { slug: normalizedSlug } });
  if (existing) {
    const error = new Error(`Blog post with slug "${normalizedSlug}" already exists`);
    error.statusCode = 400;
    throw error;
  }

  const sanitizedContent = sanitizeRichText(data.content);

  return prisma.blogPost.create({
    data: {
      title: data.title,
      slug: normalizedSlug,
      excerpt: data.excerpt || null,
      featuredImage: data.featuredImage || null,
      content: sanitizedContent,
      author: data.author || "Aadya Editorial",
      category: data.category || "General",
      tags: data.tags || [],
      isFeatured: Boolean(data.isFeatured),
      status: data.status || "DRAFT",
      publishDate: (data.publishDate && !isNaN(new Date(data.publishDate).getTime())) ? new Date(data.publishDate) : new Date(),
      seoTitle: data.seoTitle || null,
      seoDescription: data.seoDescription || null
    }
  });
}

export async function updateBlogPost(id, data) {
  const existing = await getBlogPostById(id);

  let normalizedSlug = existing.slug;
  if (data.slug && data.slug.toLowerCase().trim() !== existing.slug) {
    normalizedSlug = data.slug.toLowerCase().trim();
    const collision = await prisma.blogPost.findUnique({ where: { slug: normalizedSlug } });
    if (collision) {
      const error = new Error(`Blog post with slug "${normalizedSlug}" already exists`);
      error.statusCode = 400;
      throw error;
    }
  }

  const updateData = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.slug !== undefined) updateData.slug = normalizedSlug;
  if (data.excerpt !== undefined) updateData.excerpt = data.excerpt || null;
  if (data.featuredImage !== undefined) updateData.featuredImage = data.featuredImage || null;
  if (data.content !== undefined) updateData.content = sanitizeRichText(data.content);
  if (data.author !== undefined) updateData.author = data.author || null;
  if (data.category !== undefined) updateData.category = data.category || null;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.isFeatured !== undefined) updateData.isFeatured = Boolean(data.isFeatured);
  if (data.status !== undefined) updateData.status = data.status;
  if (data.publishDate !== undefined) updateData.publishDate = (data.publishDate && !isNaN(new Date(data.publishDate).getTime())) ? new Date(data.publishDate) : new Date();
  if (data.seoTitle !== undefined) updateData.seoTitle = data.seoTitle || null;
  if (data.seoDescription !== undefined) updateData.seoDescription = data.seoDescription || null;

  return prisma.blogPost.update({
    where: { id },
    data: updateData
  });
}

export async function deleteBlogPost(id) {
  await getBlogPostById(id);
  return prisma.blogPost.delete({ where: { id } });
}

export async function togglePublishBlogPost(id, { status }) {
  const existing = await getBlogPostById(id);
  const targetStatus = status || (existing.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED");
  return prisma.blogPost.update({
    where: { id },
    data: { status: targetStatus }
  });
}
