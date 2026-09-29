import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ProductCard from "../../components/ProductCard";
import { ProductGridSkeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { getProducts, getCategories, getCollections } from "../../services/api";

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest Arrivals" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "rating", label: "Customer Rating" },
];

export default function ProductCatalog({
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
  const [categories, setCategories] = useState([]);
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const slugIsCollection = isCollectionRoute || Boolean(lockedCollection);
  const [selectedCategory, setSelectedCategory] = useState(lockedCategory || (slug && !slugIsCollection ? slug : "all"));
  const [selectedCollection, setSelectedCollection] = useState(lockedCollection || (slug && slugIsCollection ? slug : "all"));
  const [sortBy, setSortBy] = useState("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(6000);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  useEffect(() => {
    async function loadMetadata() {
      const [catsRes, colsRes] = await Promise.all([getCategories(), getCollections()]);
      setCategories(catsRes.data || []);
      setCollections(colsRes.data || []);
    }
    loadMetadata();
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchCatalog() {
      setIsLoading(true);
      const params = {
        categorySlug: selectedCategory !== "all" ? selectedCategory : undefined,
        collectionSlug: selectedCollection !== "all" ? selectedCollection : undefined,
        sortBy: sortBy,
        maxPrice: maxPrice < 6000 ? maxPrice : undefined
      };
      if (lockedType) params.category = lockedType;

      const res = await getProducts(params);
      if (!active) return;
      let list = res.data || [];
      if (inStockOnly) {
        list = list.filter((p) => p.inStock !== false && (p.stockQuantity ?? 1) > 0);
      }
      setProducts(list);
      setIsLoading(false);
    }

    fetchCatalog();
    return () => { active = false; };
  }, [selectedCategory, selectedCollection, sortBy, inStockOnly, maxPrice, lockedType]);

  const activeCategoryObj = categories.find((c) => c.slug === selectedCategory);
  const activeCollectionObj = collections.find((c) => c.slug === selectedCollection);

  const resetFilters = () => {
    setSelectedCategory("all");
    setSelectedCollection("all");
    setSortBy("featured");
    setInStockOnly(false);
    setMaxPrice(6000);
  };

  return (
    <div className="store-bg store-text space-y-10 pb-20">
      {/* Header Banner */}
      <section className="store-bg border-b border-[var(--theme-border)] py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          {/* Breadcrumbs */}
          <nav className="mb-3 flex items-center gap-2 text-xs store-muted">
            <Link to="/" className="hover:text-[var(--theme-primary)]">Home</Link>
            <span>/</span>
            <Link to="/shop" className="hover:text-[var(--theme-primary)]">Shop</Link>
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

            {/* Dynamic Child Subcategories Bar */}
            {activeCategoryObj?.children?.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--theme-border)]">
                <span className="text-xs font-semibold store-muted uppercase tracking-wider mr-1">Subcategories:</span>
                {activeCategoryObj.children.map((sub) => (
                  <Link
                    key={sub.id}
                    to={`/shop/category/${sub.slug}`}
                    className="rounded-full border border-[var(--theme-border)] store-surface px-3.5 py-1 text-xs font-medium store-text hover:border-[var(--theme-primary)] hover:bg-[var(--theme-background)] hover:text-[var(--theme-primary)] transition"
                  >
                    {sub.name} {sub._count?.products ? `(${sub._count.products})` : ""}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Catalog Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-10">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block lg:col-span-3 space-y-8 pr-6 border-r border-[var(--theme-border)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--theme-border)]">
              <h3 className="font-serif-display text-lg store-text font-bold">Filters</h3>
              <button
                onClick={resetFilters}
                className="text-xs font-semibold store-primary hover:underline"
              >
                Reset All
              </button>
            </div>

            {/* Category Filter */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider store-muted">Category</h4>
              <div className="space-y-1 text-xs sm:text-sm">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`block w-full text-left py-2 px-3 rounded-lg transition ${
                    selectedCategory === "all" ? "store-bg-primary text-white font-semibold" : "store-muted hover:bg-[var(--theme-border)]/40 hover:text-[var(--theme-text)]"
                  }`}
                >
                  All Categories
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.slug)}
                    className={`flex items-center justify-between w-full text-left py-2 px-3 rounded-lg transition ${
                      selectedCategory === cat.slug ? "store-bg-primary text-white font-semibold" : "store-muted hover:bg-[var(--theme-border)]/40 hover:text-[var(--theme-text)]"
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className="text-xs opacity-75">{cat.itemCount || 0}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Collection Filter */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider store-muted">Collection</h4>
              <div className="space-y-1 text-xs sm:text-sm">
                <button
                  onClick={() => setSelectedCollection("all")}
                  className={`block w-full text-left py-2 px-3 rounded-lg transition ${
                    selectedCollection === "all" ? "store-bg-primary text-white font-semibold" : "store-muted hover:bg-[var(--theme-border)]/40 hover:text-[var(--theme-text)]"
                  }`}
                >
                  All Collections
                </button>
                {collections.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => setSelectedCollection(col.slug)}
                    className={`block w-full text-left py-2 px-3 rounded-lg transition ${
                      selectedCollection === col.slug ? "store-bg-primary text-white font-semibold" : "store-muted hover:bg-[var(--theme-border)]/40 hover:text-[var(--theme-text)]"
                    }`}
                  >
                    {col.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Filter Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider store-muted">
                <span>Max Price</span>
                <span className="store-primary font-bold">₹{maxPrice.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="6000"
                step="250"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-[var(--theme-primary)] cursor-pointer"
              />
            </div>

            {/* Availability Filter */}
            <div className="pt-2">
              <label className="flex items-center gap-3 text-xs sm:text-sm store-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded border-[var(--theme-border)] accent-[var(--theme-primary)] h-4 w-4"
                />
                <span>In Stock Items Only</span>
              </label>
            </div>
          </aside>

          {/* Product Grid Area */}
          <main className="lg:col-span-9 space-y-6">
            {/* Sorting & Filter Trigger Bar */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-4 border-b border-[var(--theme-border)]">
              <p className="text-xs font-semibold store-muted uppercase tracking-wider">
                Showing {products.length} {products.length === 1 ? "Object" : "Objects"}
              </p>

              <div className="flex items-center gap-3">
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
            ) : products.length === 0 ? (
              <EmptyState
                title="No items found"
                description="We couldn't find any objects matching your selected filters."
                actionText="Reset Filters"
                onAction={resetFilters}
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3">
                {products.map((product) => (
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

            <div className="mt-6 space-y-6">
              {/* Category */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider store-muted mb-2">Category</h4>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[var(--theme-border)] store-bg px-4 py-3 text-sm store-text focus:border-[var(--theme-primary)] focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Collection */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider store-muted mb-2">Collection</h4>
                <select
                  value={selectedCollection}
                  onChange={(e) => setSelectedCollection(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[var(--theme-border)] store-bg px-4 py-3 text-sm store-text focus:border-[var(--theme-primary)] focus:outline-none"
                >
                  <option value="all">All Collections</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* In Stock */}
              <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-[var(--theme-border)] store-bg px-4 py-2.5 text-sm store-text cursor-pointer hover:border-[var(--theme-border)]">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded border-[var(--theme-border)] accent-[var(--theme-primary)] h-4 w-4"
                />
                <span>In Stock Items Only</span>
              </label>

              <button
                onClick={() => setMobileFilterOpen(false)}
                className="w-full min-h-[44px] rounded-full store-bg-primary py-3 text-xs font-semibold uppercase tracking-wider text-white shadow-xs hover:brightness-95"
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
