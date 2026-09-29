import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ProductCard from "../../components/ProductCard";
import { ProductGridSkeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { fetchSearch } from "../../lib/api";
import { getSessionId } from "../../lib/attribution";
import RecentlyViewed from "../../components/shop/RecentlyViewed";

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "newest", label: "Newest" },
];

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [inputValue, setInputValue] = useState(query);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState("relevance");
  const [inStockOnly, setInStockOnly] = useState(false);

  useEffect(() => setInputValue(query), [query]);

  useEffect(() => {
    if (!query.trim()) {
      setResult(null);
      return;
    }
    setIsLoading(true);
    fetchSearch(query, getSessionId())
      .then((res) => setResult(res.data))
      .finally(() => setIsLoading(false));
  }, [query]);

  const products = useMemo(() => {
    let list = result?.products || [];
    if (inStockOnly) list = list.filter((p) => p.inStock !== false);
    list = [...list];
    if (sortBy === "price-low") list.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
    else if (sortBy === "price-high") list.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
    else if (sortBy === "newest") list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return list;
  }, [result, sortBy, inStockOnly]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSearchParams(inputValue.trim() ? { q: inputValue.trim() } : {});
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <form onSubmit={handleSubmit} className="mb-8 flex items-center gap-3">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search products, categories, collections..."
          className="w-full rounded-full border border-[var(--theme-border)] store-bg px-5 py-3 text-sm focus:outline-none focus:border-[var(--theme-primary)]"
        />
        <button type="submit" className="rounded-full store-bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-wider text-white">
          Search
        </button>
      </form>

      {!query.trim() && (
        <EmptyState
          title="Search Aadya"
          description="Type a product name, category, collection, brand, or author to get started."
          actionLink="/shop"
          actionText="Browse Shop"
        />
      )}

      {query.trim() && (
        <>
          {result?.suggestions?.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {result.suggestions.map((s) => (
                <Link
                  key={`${s.type}-${s.slug}`}
                  to={s.type === "category" ? `/shop/category/${s.slug}` : `/collections/${s.slug}`}
                  className="rounded-full border border-[var(--theme-border)] store-surface px-3.5 py-1.5 text-xs store-text hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]"
                >
                  {s.type === "category" ? "Category" : "Collection"}: {s.label}
                </Link>
              ))}
            </div>
          )}

          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm store-muted">
              {isLoading ? "Searching..." : `${result?.totalResults ?? 0} result${result?.totalResults === 1 ? "" : "s"} for "${query}"`}
            </p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs store-muted">
                <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
                In stock only
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-full border border-[var(--theme-border)] store-bg px-3 py-1.5 text-xs"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <ProductGridSkeleton />
          ) : products.length === 0 ? (
            <EmptyState
              title={`No results for "${query}"`}
              description="Try a different spelling, a broader term, or browse categories below."
              actionLink="/shop"
              actionText="Browse Shop"
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </>
      )}

      <RecentlyViewed />
    </div>
  );
}
