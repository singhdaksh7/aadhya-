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
    <div className="bg-white text-charcoal space-y-10 pb-20">
      {/* Header Banner */}
      <section className="bg-white border-b border-charcoal/10 py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          {/* Breadcrumbs */}
          <nav className="mb-3 flex items-center gap-2 text-xs text-charcoal-soft">
            <Link to="/" className="hover:text-terracotta">Home</Link>
            <span>/</span>
            <Link to="/shop" className="hover:text-terracotta">Shop</Link>
            {activeCategoryObj && (
              <>
                <span>/</span>
                <span className="text-charcoal font-medium">{activeCategoryObj.name}</span>
              </>
            )}
            {activeCollectionObj && (
              <>
                <span>/</span>
                <span className="text-charcoal font-medium">{activeCollectionObj.name}</span>
              </>
            )}
          </nav>

          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
              {activeCategoryObj?.name || activeCollectionObj?.name || eyebrow}
            </span>
            <h1 className="font-serif-display text-3xl sm:text-4xl text-charcoal font-bold">
              {activeCategoryObj?.name || activeCollectionObj?.name || title}
            </h1>
            <p className="text-xs sm:text-sm text-charcoal-soft leading-relaxed">
              {activeCategoryObj?.description || activeCollectionObj?.description || description}
            </p>

            {/* Dynamic Child Subcategories Bar */}
            {activeCategoryObj?.children?.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-charcoal/10">
                <span className="text-xs font-semibold text-charcoal-soft uppercase tracking-wider mr-1">Subcategories:</span>
                {activeCategoryObj.children.map((sub) => (
                  <Link
                    key={sub.id}
                    to={`/shop/category/${sub.slug}`}
                    className="rounded-full border border-charcoal/20 bg-[#FAF6F0] px-3.5 py-1 text-xs font-medium text-charcoal hover:border-terracotta hover:bg-white hover:text-terracotta transition"
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
          <aside className="hidden lg:block lg:col-span-3 space-y-8 pr-6 border-r border-charcoal/10">
            <div className="flex items-center justify-between pb-3 border-b border-charcoal/10">
              <h3 className="font-serif-display text-lg text-charcoal font-bold">Filters</h3>
              <button
                onClick={resetFilters}
                className="text-xs font-semibold text-terracotta hover:underline"
              >
                Reset All
              </button>
            </div>

            {/* Category Filter */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Category</h4>
              <div className="space-y-1 text-xs sm:text-sm">
                <button
                  onClick={() => setSelectedCategory("all")}
                  className={`block w-full text-left py-2 px-3 rounded-lg transition ${
                    selectedCategory === "all" ? "bg-terracotta text-white font-semibold" : "text-charcoal-soft hover:bg-charcoal/5 hover:text-charcoal"
                  }`}
                >
                  All Categories
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.slug)}
                    className={`flex items-center justify-between w-full text-left py-2 px-3 rounded-lg transition ${
                      selectedCategory === cat.slug ? "bg-terracotta text-white font-semibold" : "text-charcoal-soft hover:bg-charcoal/5 hover:text-charcoal"
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
              <h4 className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Collection</h4>
              <div className="space-y-1 text-xs sm:text-sm">
                <button
                  onClick={() => setSelectedCollection("all")}
                  className={`block w-full text-left py-2 px-3 rounded-lg transition ${
                    selectedCollection === "all" ? "bg-terracotta text-white font-semibold" : "text-charcoal-soft hover:bg-charcoal/5 hover:text-charcoal"
                  }`}
                >
                  All Collections
                </button>
                {collections.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => setSelectedCollection(col.slug)}
                    className={`block w-full text-left py-2 px-3 rounded-lg transition ${
                      selectedCollection === col.slug ? "bg-terracotta text-white font-semibold" : "text-charcoal-soft hover:bg-charcoal/5 hover:text-charcoal"
                    }`}
                  >
                    {col.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Filter Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-charcoal-soft">
                <span>Max Price</span>
                <span className="text-terracotta font-bold">₹{maxPrice.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="6000"
                step="250"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-terracotta cursor-pointer"
              />
            </div>

            {/* Availability Filter */}
            <div className="pt-2">
              <label className="flex items-center gap-3 text-xs sm:text-sm text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded border-charcoal/30 accent-terracotta h-4 w-4"
                />
                <span>In Stock Items Only</span>
              </label>
            </div>
          </aside>

          {/* Product Grid Area */}
          <main className="lg:col-span-9 space-y-6">
            {/* Sorting & Filter Trigger Bar */}
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-charcoal/10">
              <p className="text-xs font-semibold text-charcoal-soft uppercase tracking-wider">
                Showing {products.length} {products.length === 1 ? "Object" : "Objects"}
              </p>

              <div className="flex items-center gap-3">
                {/* Mobile Filter Toggle */}
                <button
                  onClick={() => setMobileFilterOpen(true)}
                  className="flex items-center gap-2 rounded-full border border-charcoal/20 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-charcoal lg:hidden"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filters
                </button>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="hidden sm:inline text-charcoal-soft font-medium uppercase tracking-wider">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="rounded-full border border-charcoal/20 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-charcoal focus:border-terracotta focus:outline-none"
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
            className="absolute inset-0 bg-charcoal/50 backdrop-blur-sm"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-xs overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-charcoal/10 pb-4">
              <h3 className="font-serif-display text-xl text-charcoal font-bold">Filter Catalog</h3>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="rounded-full p-2 text-charcoal-soft hover:bg-charcoal/5"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-6">
              {/* Category */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-2">Category</h4>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-charcoal/20 bg-white px-4 py-3 text-sm text-charcoal focus:border-terracotta focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Collection */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-2">Collection</h4>
                <select
                  value={selectedCollection}
                  onChange={(e) => setSelectedCollection(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-charcoal/20 bg-white px-4 py-3 text-sm text-charcoal focus:border-terracotta focus:outline-none"
                >
                  <option value="all">All Collections</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* In Stock */}
              <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-charcoal/10 bg-white px-4 py-2.5 text-sm text-charcoal cursor-pointer hover:border-charcoal/20">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded border-charcoal/30 accent-terracotta h-4 w-4"
                />
                <span>In Stock Items Only</span>
              </label>

              <button
                onClick={() => setMobileFilterOpen(false)}
                className="w-full min-h-[44px] rounded-full bg-terracotta py-3 text-xs font-semibold uppercase tracking-wider text-white shadow-xs hover:bg-terracotta-dark"
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
