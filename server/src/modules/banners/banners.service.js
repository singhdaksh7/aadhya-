import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../utils/ApiError.js";

// Default seed banners matching approved Aadya storefront hero banners
const DEFAULT_SEED_BANNERS = [
  {
    name: "Hero Banner 1 - Decor that Feels Like Home",
    placement: "HOME_HERO",
    desktopImage: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1800&auto=format&fit=crop",
    mobileImage: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=800&auto=format&fit=crop",
    eyebrow: "Aadya Home & Lifestyle",
    title: "Decor that",
    highlightText: "Feels Like Home",
    subtitle: "Discover handcrafted oil lamps, unglazed clay vessels, linen textiles, and slow design objects created for peaceful sanctuaries.",
    primaryCtaLabel: "Shop Home Decor",
    primaryCtaUrl: "/shop",
    secondaryCtaLabel: "Explore Collections",
    secondaryCtaUrl: "/collections",
    textPosition: "LEFT",
    textTheme: "DARK",
    isActive: true,
    sortOrder: 1,
  },
  {
    name: "Hero Banner 2 - Artisan Heritage & Sacred Proportions",
    placement: "HOME_HERO",
    desktopImage: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=1800&auto=format&fit=crop",
    mobileImage: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=800&auto=format&fit=crop",
    eyebrow: "Artisan Heritage",
    title: "Slow Living",
    highlightText: "Sacred Proportions",
    subtitle: "Every piece carries centuries of craftsmanship from India's celebrated artisan clusters, bringing warmth to modern spaces.",
    primaryCtaLabel: "View New Drops",
    primaryCtaUrl: "/new-arrivals",
    secondaryCtaLabel: "Our Craft Story",
    secondaryCtaUrl: "/about",
    textPosition: "LEFT",
    textTheme: "DARK",
    isActive: true,
    sortOrder: 2,
  },
];

export async function ensureDefaultBanners() {
  const count = await prisma.banner.count();
  if (count === 0) {
    await prisma.banner.createMany({
      data: DEFAULT_SEED_BANNERS,
    });
  }
}

export async function listPublicBanners(placement = "HOME_HERO") {
  await ensureDefaultBanners();
  const now = new Date();

  return prisma.banner.findMany({
    where: {
      placement,
      isActive: true,
      OR: [{ startDate: null }, { startDate: { lte: now } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function listAdminBanners() {
  await ensureDefaultBanners();
  return prisma.banner.findMany({
    orderBy: [{ placement: "asc" }, { sortOrder: "asc" }],
  });
}

export async function createBanner(input) {
  return prisma.banner.create({
    data: {
      name: input.name,
      placement: input.placement || "HOME_HERO",
      desktopImage: input.desktopImage,
      mobileImage: input.mobileImage || null,
      eyebrow: input.eyebrow || null,
      title: input.title,
      highlightText: input.highlightText || null,
      subtitle: input.subtitle || null,
      primaryCtaLabel: input.primaryCtaLabel || null,
      primaryCtaUrl: input.primaryCtaUrl || null,
      secondaryCtaLabel: input.secondaryCtaLabel || null,
      secondaryCtaUrl: input.secondaryCtaUrl || null,
      textPosition: input.textPosition || "LEFT",
      textTheme: input.textTheme || "DARK",
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateBanner(id, input) {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Banner not found");

  return prisma.banner.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.placement !== undefined ? { placement: input.placement } : {}),
      ...(input.desktopImage !== undefined ? { desktopImage: input.desktopImage } : {}),
      ...(input.mobileImage !== undefined ? { mobileImage: input.mobileImage } : {}),
      ...(input.eyebrow !== undefined ? { eyebrow: input.eyebrow } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.highlightText !== undefined ? { highlightText: input.highlightText } : {}),
      ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
      ...(input.primaryCtaLabel !== undefined ? { primaryCtaLabel: input.primaryCtaLabel } : {}),
      ...(input.primaryCtaUrl !== undefined ? { primaryCtaUrl: input.primaryCtaUrl } : {}),
      ...(input.secondaryCtaLabel !== undefined ? { secondaryCtaLabel: input.secondaryCtaLabel } : {}),
      ...(input.secondaryCtaUrl !== undefined ? { secondaryCtaUrl: input.secondaryCtaUrl } : {}),
      ...(input.textPosition !== undefined ? { textPosition: input.textPosition } : {}),
      ...(input.textTheme !== undefined ? { textTheme: input.textTheme } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate ? new Date(input.startDate) : null } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate ? new Date(input.endDate) : null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
}

export async function deleteBanner(id) {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound("Banner not found");

  await prisma.banner.delete({ where: { id } });
}
