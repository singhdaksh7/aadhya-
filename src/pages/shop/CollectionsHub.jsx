import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCollections } from "../../services/api";
import { canonicalUrl } from "../../lib/seo";

export default function CollectionsHub() {
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCollections().then((res) => {
      setCollections(res.data || []);
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="space-y-12 pb-20">
      <title>Curated Collections — Aadya Society</title>
      <meta
        name="description"
        content="Explore Aadya Society's editorial collections — handcrafted metalwork, home decor, and lifestyle objects grouped by materiality and mood."
      />
      <link rel="canonical" href={canonicalUrl("/collections")} />
      {/* Header */}
      <section className="store-surface py-12 sm:py-16 text-center">
        <div className="mx-auto max-w-4xl px-5 sm:px-8 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-widest store-primary">
            Curated Series
          </span>
          <h1 className="font-serif-display text-3xl sm:text-5xl store-text">
            Aadya Editorial Collections
          </h1>
          <p className="max-w-xl mx-auto text-sm sm:text-base store-muted leading-relaxed">
            Thematically curated home decor, handcrafted metalwork, and serene lifestyle objects grouped by materiality, mood, and living space.
          </p>
        </div>
      </section>

      {/* Grid of Collections */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        {isLoading ? (
          <div className="py-12 text-center text-xs font-semibold uppercase tracking-wider store-muted">
            Loading collections...
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2">
            {collections.map((col) => (
              <Link
                key={col.id}
                to={`/collections/${col.slug}`}
                className="group overflow-hidden rounded-3xl border border-[var(--theme-border)] store-bg transition hover:border-[var(--theme-primary)]/40 hover:shadow-xl"
              >
              <div className="aspect-[16/10] w-full overflow-hidden store-surface">
                <img
                  src={col.heroImage}
                  alt={col.name}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
              </div>
              <div className="p-8 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-widest store-primary">
                  {col.tagline}
                </span>
                <h2 className="font-serif-display text-2xl store-text group-hover:text-[var(--theme-primary)] transition">
                  {col.name}
                </h2>
                <p className="text-sm store-muted leading-relaxed">
                  {col.description}
                </p>
                <div className="pt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider store-primary group-hover:underline">
                  <span>Explore Series ({col.itemCount} Objects)</span>
                  <span>→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      </section>
    </div>
  );
}
