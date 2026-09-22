import { SectionHeading, Button } from "../components/ui";
import Placeholder from "../components/Placeholder";
import SmartImage from "../components/SmartImage";
import { images } from "../data/images";

export default function About() {
  return (
    <div>
      <section className="bg-ivory-dark py-16">
        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <SectionHeading
            eyebrow="About"
            title="About Aadya Society"
            description="Aadya Society brings together learning, wellbeing and research under one integrated, thoughtfully designed platform."
            align="center"
            className="mx-auto"
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <SmartImage image={images.about.community} tone="green" ratio="aspect-[5/4]" priority />
          <div className="space-y-8">
            <div>
              <h2 className="font-serif-display text-2xl text-charcoal">Vision</h2>
              <p className="mt-3 text-sm leading-relaxed text-charcoal-soft">
                A world where learning, emotional wellbeing and research-informed practice are
                accessible and connected — not siloed experiences.
              </p>
            </div>
            <div>
              <h2 className="font-serif-display text-2xl text-charcoal">Mission</h2>
              <p className="mt-3 text-sm leading-relaxed text-charcoal-soft">
                To build structured, thoughtful programs and services that bring together
                training, consultation and research in one integrated space.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ivory-dark py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading eyebrow="Leadership" title="Founder" />
          <div className="mt-8 flex flex-col items-start gap-6 rounded-2xl border border-charcoal/10 bg-white/50 p-6 sm:flex-row sm:items-center">
            <Placeholder tone="sage" ratio="aspect-square" className="w-28 shrink-0" />
            <div>
              <h3 className="font-serif-display text-xl text-charcoal">Dr. Aqsa</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-soft">
                Founder profile content will be updated with client-approved information.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <SectionHeading eyebrow="People" title="Team" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-charcoal/10 bg-white/50 p-6 text-center">
              <Placeholder tone="beige" ratio="aspect-square" className="mx-auto w-24" />
              <p className="mt-4 text-sm font-medium text-charcoal">Team Member {i}</p>
              <p className="mt-1 text-xs text-charcoal-soft">
                Profile content will be updated with client-approved information.
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-terracotta/10 py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading eyebrow="Related Initiatives" title="Connected Initiatives" />
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-charcoal/10 bg-white/60 p-6">
              <h3 className="font-serif-display text-lg text-charcoal">Tushaqsa</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-soft">
                A handcrafted home decor initiative bringing warmth into everyday spaces.
              </p>
              <Button to="/shop" variant="ghost" className="mt-3">
                Explore Tushaqsa
              </Button>
            </div>
            <div className="rounded-2xl border border-charcoal/10 bg-white/60 p-6">
              <h3 className="font-serif-display text-lg text-charcoal">Research Thinkpod</h3>
              <p className="mt-2 text-sm leading-relaxed text-charcoal-soft">
                Ideas, research and conversations exploring wellbeing and learning.
              </p>
              <Button to="/thinkpod" variant="ghost" className="mt-3">
                Explore Thinkpod
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
