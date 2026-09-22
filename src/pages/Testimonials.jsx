import { SectionHeading } from "../components/ui";
import AvatarInitial from "../components/AvatarInitial";
import { testimonials } from "../data/testimonials";

export default function Testimonials() {
  return (
    <div>
      <section className="bg-ivory-dark py-16">
        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <SectionHeading
            eyebrow="Testimonials"
            title="What People Say"
            description="Generic demo testimonials shown for presentation purposes."
            align="center"
            className="mx-auto"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.id} className="rounded-2xl border border-charcoal/10 bg-white/50 p-6">
              <p className="font-serif-display text-lg italic leading-relaxed text-charcoal">
                "{t.quote}"
              </p>
              <div className="mt-4 flex items-center gap-3">
                <AvatarInitial name={t.name} />
                <div>
                  <p className="text-sm font-medium text-charcoal">{t.name}</p>
                  <p className="text-xs text-charcoal-soft">{t.context}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
