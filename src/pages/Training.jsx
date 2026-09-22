import { useState } from "react";
import { Link } from "react-router-dom";
import { SectionHeading, Tag } from "../components/ui";
import SmartImage from "../components/SmartImage";
import { programs, filterCategories } from "../data/programs";
import { images } from "../data/images";
import { IconArrowRight } from "../components/icons";

export default function Training() {
  const [active, setActive] = useState("All");
  const filtered = active === "All" ? programs : programs.filter((p) => p.category === active);

  return (
    <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <SectionHeading
        eyebrow="Training Programs"
        title="Structured Learning for Meaningful Growth"
        description="Explore programs across counselling, nutrition, wellbeing and professional development — each designed with clear structure and practical outcomes."
      />

      <div className="mt-8 flex flex-wrap gap-2">
        {filterCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActive(cat)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              active === cat
                ? "bg-green text-ivory"
                : "border border-charcoal/15 text-charcoal-soft hover:border-charcoal/30 hover:text-charcoal"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <div
            key={p.slug}
            className="group flex flex-col rounded-2xl border border-charcoal/10 bg-white/50 p-4 transition hover:border-charcoal/20 hover:shadow-lg"
          >
            <SmartImage image={images.programs[p.slug]} tone="sage" label={p.category} />
            <div className="mt-4 flex-1">
              <Tag>{p.category}</Tag>
              <h3 className="mt-3 font-serif-display text-lg text-charcoal">{p.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-soft">{p.description}</p>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-charcoal-soft">
                <span>{p.duration}</span>
                <span>·</span>
                <span>{p.mode}</span>
              </div>
              <p className="mt-2 text-xs text-terracotta">{p.fee}</p>
            </div>
            <Link
              to={`/training/${p.slug}`}
              className="mt-4 flex items-center gap-1.5 text-sm font-medium text-green group-hover:text-green-deep"
            >
              View Details <IconArrowRight />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
