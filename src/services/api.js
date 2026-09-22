// Aadya Storefront API Service Layer
//
// Thin adapter over the real backend (src/lib/api.js), preserving the
// function names/shapes this layer originally exposed over mock data so the
// storefront pages that import from here didn't need a rewrite. The backend
// doesn't support every mock-era filter (isNew/isBestSeller/collectionSlug/
// price range/rating sort) as a query param, so those are applied client-side
// after fetching a broad page. Never falls back to fabricated data on error —
// a failed request surfaces as an empty result or a thrown/returned error,
// same as it would against the real backend directly.
import {
  fetchProducts,
  fetchProductBySlug,
  fetchCategories,
  fetchCollections,
  fetchCollectionBySlug,
} from "../lib/api";

function mapCollection(c) {
  if (!c) return c;
  return {
    ...c,
    name: c.title,
    itemCount: c.products?.length ?? 0,
    products: c.products?.map((cp) => cp.product) ?? c.products,
  };
}

export async function getProducts(params = {}) {
  const {
    category,
    categorySlug,
    collectionSlug,
    search,
    isNew,
    isBestSeller,
    minPrice,
    maxPrice,
    sortBy,
  } = params;

  const query = { limit: 100 };
  if (categorySlug) query.category = categorySlug;
  if (category === "BOOK" || category === "PHYSICAL") query.type = category;
  if (search) query.search = search;
  if (sortBy === "price-low") query.sort = "price_asc";
  else if (sortBy === "price-high") query.sort = "price_desc";
  else if (sortBy === "newest") query.sort = "newest";

  const res = await fetchProducts(query);
  let list = res.data || [];

  if (collectionSlug) {
    const colRes = await fetchCollectionBySlug(collectionSlug).catch(() => ({ data: null }));
    const ids = new Set((colRes.data?.products || []).map((cp) => cp.productId));
    list = list.filter((p) => ids.has(p.id));
  }
  if (isNew) list = list.filter((p) => p.isNew);
  if (isBestSeller) list = list.filter((p) => p.isBestSeller);
  if (minPrice !== undefined && minPrice !== null && minPrice !== "") {
    list = list.filter((p) => (p.salePrice ?? p.price) >= Number(minPrice));
  }
  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== "") {
    list = list.filter((p) => (p.salePrice ?? p.price) <= Number(maxPrice));
  }
  if (sortBy === "featured") {
    list = [...list].sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  }

  return { data: list, total: list.length };
}

export async function getProductBySlug(slug) {
  try {
    const res = await fetchProductBySlug(slug);
    return { data: res.data, reviews: [] };
  } catch (err) {
    return { error: { message: err.message }, data: null };
  }
}

export async function getCategories() {
  const res = await fetchCategories();
  return { data: res.data };
}

export async function getCollections() {
  const res = await fetchCollections();
  return { data: (res.data || []).map(mapCollection) };
}

export async function getCollectionBySlug(slug) {
  try {
    const res = await fetchCollectionBySlug(slug);
    return { data: mapCollection(res.data) };
  } catch {
    return { data: null };
  }
}

export async function searchProducts(query) {
  if (!query || !query.trim()) return { data: [], suggestions: [] };
  const res = await fetchProducts({ search: query.trim(), limit: 6 });
  return { data: res.data };
}
