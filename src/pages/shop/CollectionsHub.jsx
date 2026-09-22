import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCollections } from "../../services/api";

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
      {/* Header */}
      <section className="bg-ivory-dark/60 py-12 sm:py-16 text-center">
        <div className="mx-auto max-w-4xl px-5 sm:px-8 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
            Curated Series
          </span>
          <h1 className="font-serif-display text-3xl sm:text-5xl text-charcoal">
            Aadya Editorial Collections
          </h1>
          <p className="max-w-xl mx-auto text-sm sm:text-base text-charcoal-soft leading-relaxed">
            Thematically curated home decor, handcrafted metalwork, and serene lifestyle objects grouped by materiality, mood, and living space.
          </p>
        </div>
      </section>

      {/* Grid of Collections */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-2">
          {collections.map((col) => (
            <Link
              key={col.id}
              to={`/collections/${col.slug}`}
              className="group overflow-hidden rounded-3xl border border-charcoal/10 bg-white transition hover:border-terracotta/40 hover:shadow-xl"
            >
              <div className="aspect-[16/10] w-full overflow-hidden bg-ivory-dark/40">
                <img
                  src={col.heroImage}
                  alt={col.name}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
              </div>
              <div className="p-8 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
                  {col.tagline}
                </span>
                <h2 className="font-serif-display text-2xl text-charcoal group-hover:text-terracotta transition">
                  {col.name}
                </h2>
                <p className="text-sm text-charcoal-soft leading-relaxed">
                  {col.description}
                </p>
                <div className="pt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-terracotta group-hover:underline">
                  <span>Explore Series ({col.itemCount} Objects)</span>
                  <span>→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
