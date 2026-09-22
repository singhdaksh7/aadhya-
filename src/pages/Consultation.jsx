import { useState } from "react";
import { SectionHeading, Button, Modal } from "../components/ui";
import SmartImage from "../components/SmartImage";
import { consultations } from "../data/consultations";
import { images } from "../data/images";
import { IconCheck } from "../components/icons";

const dates = ["Mon, 15 Sep", "Tue, 16 Sep", "Wed, 17 Sep", "Thu, 18 Sep", "Fri, 19 Sep"];
const times = ["10:00 AM", "11:30 AM", "2:00 PM", "4:00 PM", "5:30 PM"];

export default function Consultation() {
  const [service, setService] = useState(null);
  const [step, setStep] = useState(0);
  const [date, setDate] = useState(null);
  const [time, setTime] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  const openBooking = (s) => {
    setService(s);
    setStep(1);
    setDate(null);
    setTime(null);
    setForm({ name: "", phone: "", email: "" });
  };

  const close = () => {
    setService(null);
    setStep(0);
  };

  const canNext = () => {
    if (step === 1) return !!date;
    if (step === 2) return !!time;
    if (step === 3) return form.name && form.phone && form.email;
    return true;
  };

  return (
    <div>
      <section className="bg-ivory-dark py-16">
        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <SectionHeading
            eyebrow="Consultation"
            title="Personalised Support, At Your Pace"
            description="Book a private session with our team — a space to talk, reflect and receive guidance tailored to you."
            align="center"
            className="mx-auto"
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          {consultations.map((c) => (
            <div key={c.id} className="flex flex-col rounded-2xl border border-charcoal/10 bg-white/50 p-6">
              <SmartImage image={images.consultations[c.id]} tone="terracotta" ratio="aspect-[16/9]" />
              <h3 className="mt-5 font-serif-display text-xl text-charcoal">{c.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-charcoal-soft">{c.description}</p>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-charcoal-soft">{c.duration}</span>
                <span className="font-medium text-terracotta">{c.fee}</span>
              </div>
              <Button className="mt-5" onClick={() => openBooking(c)}>
                Book Session
              </Button>
            </div>
          ))}
        </div>
      </section>

      <Modal open={!!service} onClose={close} title={service?.name}>
        {service && (
          <div>
            {step < 4 && (
              <div className="mb-6 flex items-center gap-2">
                {["Date", "Time", "Details", "Confirm"].map((label, i) => (
                  <div key={label} className="flex flex-1 items-center gap-2">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                        step > i ? "bg-green text-ivory" : step === i + 1 ? "bg-terracotta text-ivory" : "bg-charcoal/10 text-charcoal-soft"
                      }`}
                    >
                      {step > i ? <IconCheck /> : i + 1}
                    </div>
                    {i < 3 && <div className="h-px flex-1 bg-charcoal/10" />}
                  </div>
                ))}
              </div>
            )}

            {step === 1 && (
              <div>
                <p className="mb-3 text-sm font-medium text-charcoal">Choose a date</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {dates.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDate(d)}
                      className={`rounded-xl border px-3 py-2.5 text-sm transition ${
                        date === d
                          ? "border-green bg-sage-light text-green-deep"
                          : "border-charcoal/15 text-charcoal-soft hover:border-charcoal/30"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <p className="mb-3 text-sm font-medium text-charcoal">Choose a time — {date}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {times.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTime(t)}
                      className={`rounded-xl border px-3 py-2.5 text-sm transition ${
                        time === t
                          ? "border-green bg-sage-light text-green-deep"
                          : "border-charcoal/15 text-charcoal-soft hover:border-charcoal/30"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm font-medium text-charcoal">Your details</p>
                <input
                  required
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                <input
                  required
                  type="email"
                  placeholder="Email address"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-xl border border-charcoal/15 bg-white/70 px-4 py-2.5 text-sm outline-none focus:border-green"
                />
              </div>
            )}

            {step === 4 && (
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage-light text-green-deep">
                  <IconCheck />
                </div>
                <h4 className="mt-4 font-serif-display text-xl text-charcoal">Demo booking confirmed for presentation purposes.</h4>
                <div className="mt-4 space-y-1 text-sm text-charcoal-soft">
                  <p>{service.name}</p>
                  <p>{date} · {time}</p>
                  <p>{form.name}</p>
                </div>
                <Button className="mt-6 w-full" onClick={close}>
                  Done
                </Button>
              </div>
            )}

            {step < 4 && (
              <div className="mt-6 flex justify-between gap-3">
                {step > 1 ? (
                  <Button variant="secondary" onClick={() => setStep(step - 1)}>
                    Back
                  </Button>
                ) : (
                  <span />
                )}
                <Button disabled={!canNext()} onClick={() => setStep(step + 1)} className={!canNext() ? "opacity-40" : ""}>
                  {step === 3 ? "Confirm Booking" : "Continue"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
