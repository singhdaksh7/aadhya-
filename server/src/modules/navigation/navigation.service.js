import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";

export async function getNavigationByCode(code) {
  const menu = await prisma.navigationMenu.findUnique({
    where: { code },
    include: {
      items: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!menu || !menu.isActive) {
    return { code, title: code, items: [] };
  }

  // Build tree from flat items
  const map = new Map();
  menu.items.forEach((item) => map.set(item.id, { ...item, children: [] }));
  const rootItems = [];
  menu.items.forEach((item) => {
    const node = map.get(item.id);
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId).children.push(node);
    } else {
      rootItems.push(node);
    }
  });

  return { ...menu, items: rootItems };
}

export async function listMenus() {
  return prisma.navigationMenu.findMany({
    include: {
      _count: { select: { items: true } },
    },
    orderBy: { code: "asc" },
  });
}

export async function createMenu(input) {
  const existing = await prisma.navigationMenu.findUnique({ where: { code: input.code } });
  if (existing) throw ApiError.conflict(`Menu with code '${input.code}' already exists`);

  return prisma.navigationMenu.create({
    data: {
      code: input.code,
      title: input.title,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateMenu(id, input) {
  const menu = await prisma.navigationMenu.findUnique({ where: { id } });
  if (!menu) throw ApiError.notFound("Menu not found");

  return prisma.navigationMenu.update({
    where: { id },
    data: {
      ...(input.title ? { title: input.title } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
}

export async function addMenuItem(menuId, input) {
  const menu = await prisma.navigationMenu.findUnique({ where: { id: menuId } });
  if (!menu) throw ApiError.notFound("Menu not found");

  return prisma.navigationItem.create({
    data: {
      menuId,
      parentId: input.parentId ?? null,
      title: input.title,
      url: input.url ?? null,
      type: input.type ?? "CUSTOM",
      targetId: input.targetId ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      icon: input.icon ?? null,
      badgeText: input.badgeText ?? null,
    },
  });
}

export async function updateMenuItem(itemId, input) {
  const item = await prisma.navigationItem.findUnique({ where: { id: itemId } });
  if (!item) throw ApiError.notFound("Menu item not found");

  return prisma.navigationItem.update({
    where: { id: itemId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.url !== undefined ? { url: input.url } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.targetId !== undefined ? { targetId: input.targetId } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.badgeText !== undefined ? { badgeText: input.badgeText } : {}),
    },
  });
}

export async function deleteMenuItem(itemId) {
  const item = await prisma.navigationItem.findUnique({ where: { id: itemId } });
  if (!item) throw ApiError.notFound("Menu item not found");

  await prisma.navigationItem.delete({ where: { id: itemId } });
}
