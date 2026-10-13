import { useState } from "react";
import { Button } from "../components/ui";
import { IconCheck } from "../components/icons";
import { useSiteSettings } from "../hooks/useSiteSettings";
import { commercialContext } from "../lib/commercialText";
import SystemPage from "./SystemPage";

const enquiryTypes = ["Order or delivery", "Product question", "Returns", "Books", "General"];
const fieldCls = "w-full rounded-xl border store-border store-bg px-4 py-2.5 text-sm outline-none store-ring-primary";

// The page copy (title, intro, hours, banner, SEO) is managed in Admin → Pages ("contact"). The enquiry
// form and the contact details below it stay in code: the form is interactive, and the details come
// from Store Settings (support email / phone / business address) so they are maintained in one place.
function ContactExtras() {
  const ctx = commercialContext(useSiteSettings());
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", enquiryType: enquiryTypes[0], message: "" });
  const details = [
    ["Email", ctx.supportEmail],
    ["Phone", ctx.supportPhone],
    ["Location", ctx.businessAddress],
  ].filter(([, value]) => Boolean(value));

  return (
    <div className={`grid gap-10 ${details.length ? "lg:grid-cols-2" : ""}`} data-testid="contact-extras">
      <div>
        {submitted ? (
          <div className="rounded-2xl border store-border bg-sage-light p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/60 text-green-deep">
              <IconCheck />
            </div>
            <p className="mt-4 font-serif-display text-xl text-green-deep">Thank you. This is a demo enquiry flow.</p>
          </div>
        ) : (
          <form
            className="space-y-4"
            data-testid="contact-form"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldCls} />
            <input required type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldCls} />
            <input required type="tel" placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fieldCls} />
            <select value={form.enquiryType} onChange={(e) => setForm({ ...form, enquiryType: e.target.value })} className={fieldCls}>
              {enquiryTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <textarea required rows={5} placeholder="Your message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={fieldCls} />
            <Button type="submit" className="w-full">Send Enquiry</Button>
          </form>
        )}
      </div>

      {details.length > 0 && (
        <div className="space-y-4" data-testid="contact-details">
          {details.map(([label, value]) => (
            <div key={label} className="rounded-2xl border store-border store-surface p-6">
              <p className="text-xs uppercase tracking-wide store-muted/70">{label}</p>
              <p className="mt-1 text-sm store-muted">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Contact() {
  return (
    <SystemPage slug="contact" eyebrow="Contact" fallbackTitle="Contact Us">
      <ContactExtras />
    </SystemPage>
  );
}
