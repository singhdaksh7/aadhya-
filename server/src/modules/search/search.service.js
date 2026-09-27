import { prisma } from "../../lib/prisma.js";
import { recordEvent } from "../analytics/analytics.service.js";

// Storefront search across products (incl. book author), categories and
// collections in one call, plus lightweight suggestions. Also logs a
// `search` analytics event server-side (query + result count) — this is
// the single place a storefront search executes, so it's a more reliable
// signal than trusting the client to separately report it.
export async function search({ query, sessionId, customerId } = {}) {
  const q = (query || "").trim();
  if (!q) return { query: q, products: [], categories: [], collections: [], suggestions: [], totalResults: 0 };

  const [products, categories, collections] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
          { shortDescription: { contains: q, mode: "insensitive" } },
          { tags: { has: q } },
          { bookDetail: { author: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, bookDetail: true, category: { select: { name: true, slug: true } } },
      take: 20,
    }),
    prisma.category.findMany({
      where: { isActive: true, name: { contains: q, mode: "insensitive" } },
      take: 5,
    }),
    prisma.collection.findMany({
      where: { isActive: true, title: { contains: q, mode: "insensitive" } },
      take: 5,
    }),
  ]);

  const totalResults = products.length + categories.length + collections.length;

  recordEvent({
    type: "search",
    sessionId,
    customerId,
    metadata: { query: q, resultCount: totalResults },
  }).catch(() => {});

  const suggestions = [
    ...categories.map((c) => ({ type: "category", label: c.name, slug: c.slug })),
    ...collections.map((c) => ({ type: "collection", label: c.title, slug: c.slug })),
  ].slice(0, 8);

  return { query: q, products, categories, collections, suggestions, totalResults };
}
