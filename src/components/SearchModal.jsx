import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { searchProducts } from "../services/api";
import { formatInr } from "../lib/format";
import { IconClose } from "./icons";

export default function SearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsLoading(true);
      searchProducts(query).then((res) => {
        setResults(res.data || []);
        setIsLoading(false);
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onClose();
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSelectProduct = (slug) => {
    onClose();
    navigate(`/products/${slug}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-charcoal/60 backdrop-blur-sm animate-fade-up">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-charcoal/10 bg-ivory shadow-2xl">
        {/* Search Input Header */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center border-b border-charcoal/10 px-6 py-4">
          <svg className="h-5 w-5 text-charcoal/40 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search home decor, brassware, books, wellness..."
            className="w-full bg-transparent text-base font-medium text-charcoal placeholder-charcoal/40 focus:outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-charcoal/50 hover:bg-charcoal/5 hover:text-charcoal"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </form>

        {/* Live Search Results / Quick Suggestions */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {isLoading && (
            <p className="text-center py-6 text-sm text-charcoal-soft">Searching Aadya collections...</p>
          )}

          {!isLoading && query.trim() && results.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm font-medium text-charcoal">No objects found for "{query}"</p>
              <p className="mt-1 text-xs text-charcoal-soft">Try searching for 'brass', 'vessel', 'book', or 'diffuser'</p>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft">Matching Products ({results.length})</p>
              <div className="grid gap-3">
                {results.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleSelectProduct(product.slug)}
                    className="flex items-center gap-4 rounded-xl border border-charcoal/5 bg-white p-3 text-left transition hover:border-terracotta/30 hover:shadow-sm"
                  >
                    <img
                      src={product.images?.[0] || product.image}
                      alt={product.name}
                      className="h-14 w-14 rounded-lg object-cover bg-ivory-dark/40"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-terracotta">
                        {product.category}
                      </span>
                      <h4 className="text-sm font-serif-display text-charcoal truncate">{product.name}</h4>
                      {product.author && <p className="text-xs text-charcoal-soft italic">By {product.author}</p>}
                    </div>
                    <span className="text-sm font-medium text-terracotta">
                      {formatInr(product.salePrice || product.price)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!query.trim() && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-3">Popular Searches</p>
                <div className="flex flex-wrap gap-2">
                  {["Brass Diya Set", "Terracotta Vessel", "Crafts Monograph", "Soapstone Diffuser", "Block Print Cushion", "Copper Carafe"].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setQuery(tag)}
                      className="rounded-full border border-charcoal/15 bg-white/80 px-3.5 py-1.5 text-xs text-charcoal transition hover:border-terracotta hover:text-terracotta"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-soft mb-3">Browse Categories</p>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  {[
                    { name: "Home Decor", slug: "home-decor" },
                    { name: "Handcrafted Decor", slug: "handcrafted-decor" },
                    { name: "Wellness Decor", slug: "wellness-decor" },
                    { name: "Books", slug: "books" },
                    { name: "Gifts & Lifestyle", slug: "gifts" }
                  ].map((cat) => (
                    <button
                      key={cat.slug}
                      onClick={() => {
                        onClose();
                        navigate(`/collections/${cat.slug}`);
                      }}
                      className="rounded-xl border border-charcoal/10 bg-ivory-dark/40 p-3 text-left font-serif-display text-charcoal transition hover:bg-beige-light hover:text-terracotta"
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
