import React from "react";
import { Link } from "react-router-dom";

export default function CircularCategoryNav({ categories = [] }) {
  if (!categories || categories.length === 0) return null;

  return (
    <div className="bg-ivory/50 border-b border-charcoal/10 py-6 overflow-x-auto no-scrollbar">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 flex items-center justify-start sm:justify-center gap-6 sm:gap-8 min-w-max">
        {categories.map((cat) => (
          <Link
            key={cat.id || cat.slug}
            to={`/shop/category/${cat.slug}`}
            className="group flex flex-col items-center space-y-2 text-center"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-charcoal/10 bg-white p-1 overflow-hidden group-hover:border-terracotta group-hover:shadow-md transition duration-300">
              <img
                src={cat.image || "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?q=80&w=200"}
                alt={cat.name}
                className="w-full h-full object-cover rounded-full group-hover:scale-110 transition duration-300"
              />
            </div>
            <span className="text-xs font-semibold text-charcoal group-hover:text-terracotta transition">
              {cat.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
