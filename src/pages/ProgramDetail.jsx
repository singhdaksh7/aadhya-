import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { programs } from "../data/programs";
import { testimonials } from "../data/testimonials";
import { faqs } from "../data/faq";
import { Button, Modal, Tag } from "../components/ui";
import SmartImage from "../components/SmartImage";
import AvatarInitial from "../components/AvatarInitial";
import { images } from "../data/images";
import { IconCheck } from "../components/icons";
import NotFound from "./NotFound";

export default function ProgramDetail() {
  const { slug } = useParams();
  const program = programs.find((p) => p.slug === slug);
  const [modal, setModal] = useState(null); // "register" | "message" | null
  const [submitted, setSubmitted] = useState(false);

  if (!program) return <NotFound />;

  const trainingFaqs = faqs.filter((f) => f.category === "Training").slice(0, 3);

  const closeModal = () => {
    setModal(null);
    setSubmitted(false);
  };

  return (
    <div>
      <section className="bg-ivory-dark">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2">
          <div>
            <Link to="/training" className="text-sm font-medium text-green hover:text-green-deep">
              ← Back to Training Programs
            </Link>
            <Tag className="mt-4">{program.category}</Tag>
            <h1 className="mt-4 font-serif-display text-3xl text-charcoal sm:text-4xl">{program.name}</h1>
            <p className="mt-4 text-base leading-relaxed text-charcoal-soft">{program.summary}</p>
            <div className="mt-6 flex flex-wrap gap-6 text-sm text-charcoal-soft">
              <div>
                <p className="text-xs uppercase tracking-wide text-charcoal-soft/70">Duration</p>
                <p className="mt-1 font-medium text-charcoal">{program.duration}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-charcoal-soft/70">Mode</p>
                <p className="mt-1 font-medium text-charcoal">{program.mode}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-charcoal-soft/70">Level</p>
                <p className="mt-1 font-medium text-charcoal">{program.level}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-charcoal-soft/70">Fee</p>
                <p className="mt-1 font-medium text-terracotta">{program.fee}</p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button onClick={() => setModal("register")}>Register Interest</Button>
              <Button variant="secondary" onClick={() => setModal("message")}>
                Message Us
              </Button>
            </div>
          </div>
          <SmartImage image={images.programs[program.slug]} tone="green" ratio="aspect-[5/4]" label={program.name} priority />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-3">
        <div className="space-y-12 lg:col-span-2">
          <div>
            <h2 className="font-serif-display text-2xl text-charcoal">About This Program</h2>
            <p className="mt-4 text-sm leading-relaxed text-charcoal-soft">{program.summary}</p>
          </div>

          <div>
            <h2 className="font-serif-display text-2xl text-charcoal">Who It Is For</h2>
            <ul className="mt-4 space-y-2">
              {program.whoFor.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-charcoal-soft">
                  <span className="mt-0.5 text-green"><IconCheck /></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-serif-display text-2xl text-charcoal">What You Will Explore</h2>
            <ul className="mt-4 space-y-2">
              {program.explore.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-charcoal-soft">
                  <span className="mt-0.5 text-green"><IconCheck /></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-serif-display text-2xl text-charcoal">Program Modules</h2>
            <ul className="mt-4 space-y-3">
              {program.modules.map((m, i) => (
                <li key={m} className="rounded-xl border border-charcoal/10 bg-white/50 px-4 py-3 text-sm text-charcoal">
                  {m}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-serif-display text-2xl text-charcoal">Learning Format</h2>
            <p className="mt-4 text-sm leading-relaxed text-charcoal-soft">{program.format}</p>
          </div>

          <div>
            <h2 className="font-serif-display text-2xl text-charcoal">Certification</h2>
            <p className="mt-4 text-sm leading-relaxed text-charcoal-soft">
              Certificate availability may depend on the final program structure.
            </p>
          </div>

          <div>
            <h2 className="font-serif-display text-2xl text-charcoal">Trainer</h2>
            <p className="mt-4 text-sm leading-relaxed text-charcoal-soft">{program.trainer}</p>
          </div>

          <div>
            <h2 className="font-serif-display text-2xl text-charcoal">FAQ</h2>
            <div className="mt-4 space-y-3">
              {trainingFaqs.map((f) => (
                <div key={f.question} className="rounded-xl border border-charcoal/10 bg-white/50 p-4">
                  <p className="text-sm font-medium text-charcoal">{f.question}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-charcoal-soft">{f.answer}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-serif-display text-2xl text-charcoal">Testimonials</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {testimonials.slice(0, 2).map((t) => (
                <div key={t.id} className="rounded-xl bg-sage-light p-4">
                  <p className="text-sm italic text-green-deep">"{t.quote}"</p>
                  <div className="mt-3 flex items-center gap-2">
                    <AvatarInitial name={t.name} className="h-8 w-8 text-sm" />
                    <p className="text-xs font-medium text-green-deep">{t.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-2xl border border-charcoal/10 bg-white/60 p-6">
            <p className="text-xs uppercase tracking-wide text-charcoal-soft/70">Interested?</p>
            <p className="mt-2 font-serif-display text-xl text-charcoal">{program.fee}</p>
            <Button onClick={() => setModal("register")} className="mt-4 w-full">
              Register Interest
            </Button>
            <Button variant="secondary" onClick={() => setModal("message")} className="mt-3 w-full">
              Message Us
            </Button>
          </div>
        </aside>
      </section>

      <Modal
        open={modal === "register"}
        onClose={closeModal}
        title={submitted ? "Interest Registered" : "Register Interest"}
      >
        {submitted ? (
          <p className="text-sm leading-relaxed text-charcoal-soft">
            Demo booking confirmed for presentation purposes. Our team would reach out with next steps in the live version.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <Field label="Full Name" placeholder="Your name" />
            <Field label="Email" type="email" placeholder="you@example.com" />
            <Field label="Phone" type="tel" placeholder="Your phone number" />
            <Button type="submit" className="w-full">
              Submit Interest
            </Button>
          </form>
        )}
      </Modal>

      <Modal open={modal === "message"} onClose={closeModal} title="Message Us">
        {submitted ? (
          <p className="text-sm leading-relaxed text-charcoal-soft">
            Demo booking confirmed for presentation purposes. This is a frontend-only flow.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <Field label="Full Name" placeholder="Your name" />
            <Field label="Email" type="email" placeholder="you@example.com" />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-charcoal">Message</label>
              <textarea
                required
                rows={4}
                className="w-full rounded-xl border border-charcoal/15 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-green"
                placeholder="Your question about this program"
              />
            </div>
            <Button type="submit" className="w-full">
              Send Message
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, ...rest }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-charcoal">{label}</label>
      <input
        required
        className="w-full rounded-xl border border-charcoal/15 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-green"
        {...rest}
      />
    </div>
  );
}
