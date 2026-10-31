import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";

const ORDER = [{ sortOrder: "asc" }, { createdAt: "desc" }];

export async function listPublicWhatsNew(now = new Date()) {
  const items = await prisma.whatsNewItem.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    },
    orderBy: ORDER,
  });
  return items.map((i) => ({
    id: i.id,
    title: i.title,
    subtitle: i.subtitle,
    imageUrl: i.imageUrl,
    badge: i.badge,
    ctaLabel: i.ctaLabel,
    ctaUrl: i.ctaUrl,
    startDate: i.startDate,
    endDate: i.endDate,
  }));
}

export function listAdminWhatsNew() {
  return prisma.whatsNewItem.findMany({ orderBy: ORDER });
}

export async function getWhatsNew(id) {
  const item = await prisma.whatsNewItem.findUnique({ where: { id } });
  if (!item) throw ApiError.notFound("What's New item not found");
  return item;
}

export function createWhatsNew(input) {
  return prisma.whatsNewItem.create({ data: input });
}

export async function updateWhatsNew(id, input) {
  await getWhatsNew(id);
  return prisma.whatsNewItem.update({ where: { id }, data: input });
}

export async function deleteWhatsNew(id) {
  await getWhatsNew(id);
  await prisma.whatsNewItem.delete({ where: { id } });
}
