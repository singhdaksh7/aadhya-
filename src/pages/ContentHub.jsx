import { useState } from "react";
import { SectionHeading, Tag } from "../components/ui";
import SmartImage from "../components/SmartImage";
import { contentItems, contentCategories } from "../data/content";
import { images } from "../data/images";

export default function ContentHub() {
  const [active, setActive] = useState("All");
  const filtered = active === "All" ? contentItems : contentItems.filter((c) => c.category === active);

  return (
    <div>
      <section className="bg-ivory-dark py-16">
        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <SectionHeading
            eyebrow="Content Hub"
            title="Articles, Videos & Resources"
            description="Editorial content spanning counselling, nutrition, wellbeing, research and lifestyle."
            align="center"
            className="mx-auto"
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="flex flex-wrap justify-center gap-2">
          {contentCategories.map((cat) => (
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
          {filtered.map((c) => (
            <div key={c.id} className="rounded-2xl border border-charcoal/10 bg-white/50 p-4">
              <SmartImage image={images.content[c.category]} tone="sage" label={c.type} />
              <div className="mt-4">
                <Tag>{c.category}</Tag>
                <h3 className="mt-3 font-serif-display text-lg text-charcoal">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-charcoal-soft">{c.excerpt}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
