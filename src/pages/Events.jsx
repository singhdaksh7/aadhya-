import { useState } from "react";
import { SectionHeading, Button, Modal, Tag } from "../components/ui";
import SmartImage from "../components/SmartImage";
import { upcomingEvents, pastEvents } from "../data/events";
import { images } from "../data/images";
import { IconCheck } from "../components/icons";

export default function Events() {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  const close = () => {
    setSelected(null);
    setSubmitted(false);
    setForm({ name: "", email: "", phone: "" });
  };

  return (
    <div>
      <section className="bg-ivory-dark py-16">
        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <SectionHeading
            eyebrow="Workshops & Events"
            title="Learning Together, Live"
            description="Join upcoming workshops and sessions, or browse what we've hosted before."
            align="center"
            className="mx-auto"
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <SectionHeading eyebrow="Upcoming" title="Upcoming Events" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {upcomingEvents.map((e) => (
            <div key={e.id} className="flex flex-col rounded-2xl border border-charcoal/10 bg-white/50 p-4">
              <SmartImage image={images.events.workshop} tone="beige" label={e.mode} />
              <div className="mt-4 flex-1">
                <Tag>{e.mode}</Tag>
                <h3 className="mt-3 font-serif-display text-lg text-charcoal">{e.title}</h3>
                <p className="mt-2 text-xs text-charcoal-soft">{e.date}</p>
                <p className="text-xs text-charcoal-soft">{e.time}</p>
                <p className="mt-3 text-sm leading-relaxed text-charcoal-soft">{e.description}</p>
              </div>
              <Button className="mt-4" onClick={() => setSelected(e)}>
                Register
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ivory-dark py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading eyebrow="Archive" title="Past Events" />
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {pastEvents.map((e) => (
              <div key={e.id} className="flex gap-4 rounded-2xl border border-charcoal/10 bg-white/50 p-4">
                <SmartImage image={images.events.workshop} tone="charcoal" ratio="aspect-square" className="w-20 shrink-0" />
                <div>
                  <h3 className="font-serif-display text-base text-charcoal">{e.title}</h3>
                  <p className="mt-1 text-xs text-charcoal-soft">{e.date} · {e.mode}</p>
                  <p className="mt-2 text-sm leading-relaxed text-charcoal-soft">{e.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Modal open={!!selected} onClose={close} title={submitted ? "Registered" : selected?.title}>
        {submitted ? (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage-light text-green-deep">
              <IconCheck />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-charcoal-soft">
              Demo registration confirmed for presentation purposes.
            </p>
            <Button className="mt-6 w-full" onClick={close}>
              Done
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <input
              required
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-charcoal/15 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-green"
            />
            <input
              required
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-charcoal/15 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-green"
            />
            <input
              required
              type="tel"
              placeholder="Phone number"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-xl border border-charcoal/15 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-green"
            />
            <Button type="submit" className="w-full">
              Submit Registration
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
