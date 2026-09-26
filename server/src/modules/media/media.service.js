import { prisma } from "../../lib/prisma.js";
import { saveBuffer, removeByUrl } from "../uploads/storage.js";
import path from "node:path";
import crypto from "node:crypto";

export async function listMedia({ search, mimeType, page = 1, limit = 24 } = {}) {
  const where = {};
  if (search) {
    where.OR = [
      { fileName: { contains: search, mode: "insensitive" } },
      { originalName: { contains: search, mode: "insensitive" } },
      { altText: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } }
    ];
  }
  if (mimeType) {
    where.mimeType = { startsWith: mimeType };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit)
    }),
    prisma.mediaAsset.count({ where })
  ]);

  return { items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
}

export async function getMediaById(id) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) {
    const error = new Error("Media asset not found");
    error.statusCode = 404;
    throw error;
  }
  return asset;
}

export async function createMediaAsset(file, metadata = {}, adminId = null) {
  if (!file || !file.buffer) {
    const error = new Error("File buffer is missing");
    error.statusCode = 400;
    throw error;
  }

  const url = await saveBuffer(file.buffer, file.mimetype);
  const fileName = path.basename(url);
  const storageKey = url;

  return prisma.mediaAsset.create({
    data: {
      fileName,
      originalName: file.originalname || fileName,
      url,
      storageKey,
      storageDriver: "local",
      mimeType: file.mimetype,
      size: file.size || file.buffer.length,
      altText: metadata.altText || null,
      title: metadata.title || null,
      createdByAdminId: adminId || null
    }
  });
}

export async function updateMediaMetadata(id, data) {
  await getMediaById(id);
  return prisma.mediaAsset.update({
    where: { id },
    data: {
      altText: data.altText !== undefined ? data.altText : undefined,
      title: data.title !== undefined ? data.title : undefined
    }
  });
}

export async function deleteMediaAsset(id, { force = false } = {}) {
  const asset = await getMediaById(id);

  if (!force) {
    const urlPattern = asset.url;
    const [pageRef, blogRef, faqRef] = await Promise.all([
      prisma.page.findFirst({
        where: {
          OR: [
            { featuredImage: urlPattern },
            { content: { contains: urlPattern } }
          ]
        }
      }),
      prisma.blogPost.findFirst({
        where: {
          OR: [
            { featuredImage: urlPattern },
            { content: { contains: urlPattern } }
          ]
        }
      }),
      prisma.fAQItem.findFirst({
        where: { answer: { contains: urlPattern } }
      })
    ]);

    if (pageRef || blogRef || faqRef) {
      const error = new Error("Media asset is currently referenced in CMS content. Set force=true to delete anyway.");
      error.statusCode = 409;
      error.details = { pageRef: Boolean(pageRef), blogRef: Boolean(blogRef), faqRef: Boolean(faqRef) };
      throw error;
    }
  }

  await removeByUrl(asset.url);
  return prisma.mediaAsset.delete({ where: { id } });
}
