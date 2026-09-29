import { useState } from "react";
import { SectionHeading, Button } from "../components/ui";
import { IconCheck } from "../components/icons";
import { useSiteSettings } from "../hooks/useSiteSettings";

const enquiryTypes = ["Training", "Consultation", "Research", "Events", "Shop", "General"];

export default function Contact() {
  const { supportEmail, supportPhone, general } = useSiteSettings();
  const addressParts = [
    general?.businessAddress,
    general?.businessAddressLine2,
    general?.city,
    general?.state,
    general?.postalCode,
    general?.country,
  ].filter((part) => Boolean(part && String(part).trim()));
  const address = addressParts.join(", ");
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    enquiryType: enquiryTypes[0],
    message: "",
  });

  return (
    <div>
      <section className="bg-ivory-dark py-16">
        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <SectionHeading
            eyebrow="Contact"
            title="Get in Touch"
            description="Have a question about a program, consultation or our research? Send us a message."
            align="center"
            className="mx-auto"
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2">
        <div>
          {submitted ? (
            <div className="rounded-2xl border store-border bg-sage-light p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/60 text-green-deep">
                <IconCheck />
              </div>
              <p className="mt-4 font-serif-display text-xl text-green-deep">
                Thank you. This is a demo enquiry flow.
              </p>
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
                className="w-full rounded-xl border store-border store-bg px-4 py-2.5 text-sm outline-none store-ring-primary"
              />
              <input
                required
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border store-border store-bg px-4 py-2.5 text-sm outline-none store-ring-primary"
              />
              <input
                required
                type="tel"
                placeholder="Phone number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-xl border store-border store-bg px-4 py-2.5 text-sm outline-none store-ring-primary"
              />
              <select
                value={form.enquiryType}
                onChange={(e) => setForm({ ...form, enquiryType: e.target.value })}
                className="w-full rounded-xl border store-border store-bg px-4 py-2.5 text-sm outline-none store-ring-primary"
              >
                {enquiryTypes.map((t) => (
                  <option key={t} value={t}>
                    {t} Enquiry
                  </option>
                ))}
              </select>
              <textarea
                required
                rows={5}
                placeholder="Your message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full rounded-xl border store-border store-bg px-4 py-2.5 text-sm outline-none store-ring-primary"
              />
              <Button type="submit" className="w-full">
                Send Enquiry
              </Button>
            </form>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border store-border store-surface p-6">
            <p className="text-xs uppercase tracking-wide store-muted/70">Email</p>
            <p className="mt-1 text-sm store-muted">{supportEmail || "Contact email to be added by client."}</p>
          </div>
          <div className="rounded-2xl border store-border store-surface p-6">
            <p className="text-xs uppercase tracking-wide store-muted/70">Phone</p>
            <p className="mt-1 text-sm store-muted">{supportPhone || "Contact number to be added by client."}</p>
          </div>
          <div className="rounded-2xl border store-border store-surface p-6">
            <p className="text-xs uppercase tracking-wide store-muted/70">Location</p>
            <p className="mt-1 text-sm store-muted">{address || "Location details to be added by client."}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
