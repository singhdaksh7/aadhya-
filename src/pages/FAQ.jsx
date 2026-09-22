import { useState } from "react";
import { SectionHeading } from "../components/ui";
import { faqs, faqCategories } from "../data/faq";
import { IconChevronDown } from "../components/icons";

export default function FAQ() {
  const [active, setActive] = useState("All");
  const [openIndex, setOpenIndex] = useState(null);
  const filtered = active === "All" ? faqs : faqs.filter((f) => f.category === active);

  return (
    <div>
      <section className="bg-ivory-dark py-16">
        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <SectionHeading
            eyebrow="FAQ"
            title="Frequently Asked Questions"
            align="center"
            className="mx-auto"
          />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <div className="flex flex-wrap justify-center gap-2">
          {faqCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActive(cat);
                setOpenIndex(null);
              }}
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

        <div className="mt-10 space-y-3">
          {filtered.map((f, i) => (
            <div key={f.question} className="rounded-2xl border border-charcoal/10 bg-white/50">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-sm font-medium text-charcoal">{f.question}</span>
                <span
                  className={`shrink-0 text-charcoal-soft transition-transform ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                >
                  <IconChevronDown />
                </span>
              </button>
              {openIndex === i && (
                <div className="px-5 pb-4 text-sm leading-relaxed text-charcoal-soft">
                  {f.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
