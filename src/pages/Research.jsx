import { useState } from "react";
import { SectionHeading, Tag, Modal } from "../components/ui";
import SmartImage from "../components/SmartImage";
import { research, researchTabs } from "../data/research";
import { images } from "../data/images";

export default function Research() {
  const [tab, setTab] = useState(researchTabs[0]);
  const [selected, setSelected] = useState(null);
  const filtered = research.filter((r) => r.type === tab);

  return (
    <div>
      <section className="bg-ivory-dark py-16">
        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <SectionHeading
            eyebrow="Research"
            title="Research & Publications"
            description="A demo editorial collection of research entries, publications and book chapters."
            align="center"
            className="mx-auto"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-8">
        <SmartImage
          image={images.research.hero}
          tone="charcoal"
          ratio="aspect-[21/9]"
          priority
        />
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="flex flex-wrap justify-center gap-2">
          {researchTabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === t
                  ? "bg-green text-ivory"
                  : "border border-charcoal/15 text-charcoal-soft hover:border-charcoal/30 hover:text-charcoal"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-10 space-y-5">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-2xl border border-charcoal/10 bg-white/50 p-6">
              <div className="flex flex-wrap items-center gap-3">
                <Tag>Demo Research Entry</Tag>
                <span className="text-xs text-charcoal-soft">{r.year}</span>
              </div>
              <h3 className="mt-3 font-serif-display text-xl text-charcoal">{r.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-soft">{r.abstract}</p>
              <button
                onClick={() => setSelected(r)}
                className="mt-3 text-sm font-medium text-green hover:text-green-deep"
              >
                Read More
              </button>
            </div>
          ))}
        </div>
      </section>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.title}>
        {selected && (
          <div className="space-y-4 text-sm leading-relaxed text-charcoal-soft">
            <div>
              <p className="text-xs uppercase tracking-wide text-charcoal-soft/70">Overview</p>
              <p className="mt-1">{selected.abstract}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-charcoal-soft/70">Authors</p>
              <p className="mt-1">{selected.authors}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-charcoal-soft/70">Abstract</p>
              <p className="mt-1">{selected.abstract}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-charcoal-soft/70">Publication Details</p>
              <p className="mt-1">Publication details placeholder — {selected.type}, {selected.year}.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
