import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ProductCard from "../../components/ProductCard";
import { ProductGridSkeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { getProducts, getCategories, getCollections } from "../../services/api";
import { resolveMediaUrl } from "../../lib/api";
import { buildCategoryIndex, categoryChain, resolveCategoryBanner, resolveCategoryThumb } from "../../lib/categoryInheritance";
import { buildCategoryOptions, priceCeiling, rootOfCategory, subtreeIds } from "../../lib/catalogFilters";
import CatalogFilters from "../../components/shop/CatalogFilters";

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest Arrivals" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "rating", label: "Customer Rating" },
];

/**
 * The catalog keeps filter state (selected category/collection, price, stock). That state is seeded
 * from the route, so the whole catalog is re-keyed on every route change: moving between categories
 * (Home Decor -> Lighting) can never keep the previous category's state, filters or products.
 */
export default function ProductCatalog(props) {
  const { slug } = useParams();
  // Category/collection lists live in this wrapper (which survives route changes), so moving between
  // categories renders the right title, tiles and filters immediately instead of refetching them.
  const [meta, setMeta] = useState({ categories: [], collections: [] });
  useEffect(() => {
    let active = true;
    Promise.all([getCategories(), getCollections()])
      .then(([catsRes, colsRes]) => { if (active) setMeta({ categories: catsRes.data || [], collections: colsRes.data || [] }); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  const routeKey = [props.lockedCategory || "", props.lockedCollection || "", props.isCollectionRoute ? "c" : "k", slug || ""].join("|");
  return <CatalogView key={routeKey} {...props} categories={meta.categories} collections={meta.collections} />;
}

function CatalogView({
  categories,
  collections,
  eyebrow = "Aadya Storefront",
  title = "Objects for Thoughtful Living",
  description = "Explore handcrafted oil lamps, unglazed ceramic vessels, linen runners, and slow living monographs.",
  lockedCategory = null,
  lockedCollection = null,
  lockedType = null,
  isCollectionRoute = false
}) {
  const { slug } = useParams();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state is seeded from the route (the component is re-keyed per route, see ProductCatalog).
  const slugIsCollection = isCollectionRoute || Boolean(lockedCollection);
  const routeCategory = lockedCategory || (slug && !slugIsCollection ? slug : null);
  const routeCollection = lockedCollection || (slug && slugIsCollection ? slug : "all");
  const [selectedCategory, setSelectedCategory] = useState(routeCategory || "all");
  const [selectedCollection, setSelectedCollection] = useState(routeCollection);
  const [sortBy, setSortBy] = useState("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(null); // null = no price cap
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const categoryIndex = useMemo(() => buildCategoryIndex(categories), [categories]);
  // Filters are scoped to the page's category tree: its root ancestor's subtree (never unrelated roots).
  const routeCategoryObj = routeCategory ? categories.find((c) => c.slug === routeCategory) : null;
  const contextRoot = routeCategoryObj ? rootOfCategory(routeCategoryObj, categoryIndex) : null;
  // Until the category list arrives, fetch by the route slug itself (descendants are included server-side).
  const fetchCategory = contextRoot?.slug || routeCategory || undefined;

  useEffect(() => {
    let active = true; // a response for a previous category/collection/sort can never overwrite the current one
    async function fetchCatalog() {
      setIsLoading(true);
      const params = {
        categorySlug: fetchCategory,
        collectionSlug: selectedCollection !== "all" ? selectedCollection : undefined,
        sortBy,
      };
      if (lockedType) params.category = lockedType;
      try {
        const res = await getProducts(params);
        if (!active) return;
        setProducts(res.data || []);
      } catch {
        if (!active) return;
        setProducts([]);
      }
      setIsLoading(false);
    }
    fetchCatalog();
    return () => { active = false; };
  }, [fetchCategory, selectedCollection, sortBy, lockedType]);

  const priceMax = useMemo(() => priceCeiling(products), [products]);
  const effectiveMaxPrice = maxPrice == null ? priceMax : Math.min(maxPrice, priceMax);

  const selectedIds = useMemo(() => {
    if (selectedCategory === "all") return null;
    const cat = categories.find((c) => c.slug === selectedCategory);
    return cat ? subtreeIds(cat.id, categories) : null;
  }, [selectedCategory, categories]);

  const visibleProducts = useMemo(() => products.filter((p) => {
    if (selectedIds && p.categoryId && !selectedIds.has(p.categoryId)) return false;
    if (maxPrice != null && Number(p.salePrice ?? p.price) > effectiveMaxPrice) return false;
    if (inStockOnly && !(p.inStock !== false && (p.stockQuantity ?? 1) > 0)) return false;
    return true;
  }), [products, selectedIds, maxPrice, effectiveMaxPrice, inStockOnly]);

  const categoryOptions = useMemo(
    () => buildCategoryOptions({ categories, contextSlug: routeCategory, products, productsLoaded: !isLoading, selectedSlug: selectedCategory }),
    [categories, routeCategory, products, isLoading, selectedCategory],
  );

  const activeCategoryObj = categories.find((c) => c.slug === selectedCategory);
  const activeCollectionObj = collections.find((c) => c.slug === selectedCollection);

  // The public categories API is a flat list with parentId: banners/images are
  // inherited from the nearest ancestor, and children/ancestors are derived here.
  const banner = activeCategoryObj ? resolveCategoryBanner(activeCategoryObj, categoryIndex) : { desktop: null, mobile: null };
  const ancestors = activeCategoryObj ? categoryChain(activeCategoryObj, categoryIndex).slice(1).reverse() : [];
  const childCategories = activeCategoryObj ? categories.filter((c) => c.parentId === activeCategoryObj.id && c.isActive !== false) : [];

  const resetFilters = () => {
    setSelectedCategory(routeCategory || "all");
    setSelectedCollection(routeCollection);
    setSortBy("featured");
    setInStockOnly(false);
    setMaxPrice(null);
  };

  const filtersPanel = (
    <CatalogFilters
      categoryOptions={categoryOptions}
      showAllCategories={!routeCategory}
      selectedCategory={selectedCategory}
      onSelectCategory={setSelectedCategory}
      collections={collections}
      selectedCollection={selectedCollection}
      onSelectCollection={setSelectedCollection}
      maxPrice={effectiveMaxPrice}
      priceMax={priceMax}
      onMaxPrice={(v) => setMaxPrice(v >= priceMax ? null : v)}
      inStockOnly={inStockOnly}
      onInStockOnly={setInStockOnly}
      onReset={resetFilters}
    />
  );

  return (
    <div className="store-bg store-text space-y-10 pb-20">
      {/* Optional category banner: own banner, else the nearest ancestor's. The text header below is unchanged and still renders when none is set. */}
      {(banner.desktop || banner.mobile) && (
        <section data-testid="category-banner" className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-8">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-[var(--theme-border)] store-surface md:aspect-[5/2] md:max-h-[460px]">
            <picture>
              {banner.mobile && banner.desktop && banner.mobile !== banner.desktop && (
                <source media="(max-width: 767px)" srcSet={resolveMediaUrl(banner.mobile)} />
              )}
              <img
                src={resolveMediaUrl(banner.desktop || banner.mobile)}
                alt={`${activeCategoryObj.name} banner`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </picture>
          </div>
        </section>
      )}

      {/* Header Banner */}
      <section className="store-bg border-b border-[var(--theme-border)] py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          {/* Breadcrumbs */}
          <nav className="mb-3 flex items-center gap-2 text-xs store-muted">
            <Link to="/" className="hover:text-[var(--theme-primary)]">Home</Link>
            <span>/</span>
            <Link to="/shop" className="hover:text-[var(--theme-primary)]">Shop</Link>
            {ancestors.map((a) => (
              <React.Fragment key={a.id}>
                <span>/</span>
                <Link to={`/shop/category/${a.slug}`} className="hover:text-[var(--theme-primary)]">{a.name}</Link>
              </React.Fragment>
            ))}
            {activeCategoryObj && (
              <>
                <span>/</span>
                <span className="store-text font-medium">{activeCategoryObj.name}</span>
              </>
            )}
            {activeCollectionObj && (
              <>
                <span>/</span>
                <span className="store-text font-medium">{activeCollectionObj.name}</span>
              </>
            )}
          </nav>

          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-semibold uppercase tracking-widest store-primary">
              {activeCategoryObj?.name || activeCollectionObj?.name || eyebrow}
            </span>
            <h1 className="font-serif-display text-3xl sm:text-4xl store-text font-bold">
              {activeCategoryObj?.name || activeCollectionObj?.name || title}
            </h1>
            <p className="text-xs sm:text-sm store-muted leading-relaxed">
              {activeCategoryObj?.description || activeCollectionObj?.description || description}
            </p>

            {/* Subcategory tiles: own image, else inherited from the parent, else a neutral initial */}
            {childCategories.length > 0 && (
              <div data-testid="subcategory-tiles" className="mt-4 border-t border-[var(--theme-border)] pt-4">
                <span className="text-xs font-semibold store-muted uppercase tracking-wider">Subcategories</span>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-4">
                  {childCategories.map((sub) => {
                    const thumb = resolveCategoryThumb(sub, categoryIndex);
                    return (
                      <Link key={sub.id} to={`/shop/category/${sub.slug}`} data-testid="subcategory-tile" className="group flex w-20 flex-col items-center gap-2 text-center">
                        <span className="relative h-16 w-16 overflow-hidden rounded-full border border-[var(--theme-border)] store-surface transition group-hover:border-[var(--theme-primary)]">
                          {thumb ? (
                            <img src={resolveMediaUrl(thumb)} alt="" loading="lazy" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center font-serif-display text-lg store-muted">{sub.name.charAt(0)}</span>
                          )}
                        </span>
                        <span className="text-xs font-medium leading-tight store-text transition group-hover:text-[var(--theme-primary)]">{sub.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-10">
          {/* Desktop Filter Sidebar */}
          <aside data-testid="filter-sidebar" className="hidden lg:block lg:col-span-3 pr-6 border-r border-[var(--theme-border)]">
            {filtersPanel}
          </aside>

          {/* Product Grid Area */}
          <main className="lg:col-span-9 space-y-6">
            {/* Sorting & Filter Trigger Bar */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-4 border-b border-[var(--theme-border)]">
              <p className="text-xs font-semibold store-muted uppercase tracking-wider">
                Showing {visibleProducts.length} {visibleProducts.length === 1 ? "Object" : "Objects"}
              </p>

              <div className="flex max-w-full flex-wrap items-center gap-3">
                {/* Mobile Filter Toggle */}
                <button
                  onClick={() => setMobileFilterOpen(true)}
                  className="flex items-center gap-2 rounded-full border border-[var(--theme-border)] px-4 py-2 text-xs font-semibold uppercase tracking-wider store-text lg:hidden"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filters
                </button>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="hidden sm:inline store-muted font-medium uppercase tracking-wider">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="rounded-full border border-[var(--theme-border)] store-bg px-4 py-2 text-xs font-semibold uppercase tracking-wider store-text focus:border-[var(--theme-primary)] focus:outline-none"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Grid display */}
            {isLoading ? (
              <ProductGridSkeleton count={6} />
            ) : visibleProducts.length === 0 ? (
              <EmptyState
                title="No items found"
                description="We couldn't find any objects matching your selected filters."
                actionText="Reset Filters"
                onAction={resetFilters}
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </main>
        </div>
      </section>

      {/* Mobile Filter Drawer */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-[var(--theme-text)]/50 backdrop-blur-sm"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-xs overflow-y-auto store-bg p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--theme-border)] pb-4">
              <h3 className="font-serif-display text-xl store-text font-bold">Filter Catalog</h3>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="rounded-full p-2 store-muted hover:bg-[var(--theme-border)]/40"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              {filtersPanel}
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="mt-6 w-full min-h-[44px] rounded-full store-bg-primary py-3 text-xs font-semibold uppercase tracking-wider text-white shadow-xs hover:brightness-95"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
