import { useSiteSettings } from "../hooks/useSiteSettings";
import { commercialContext } from "../lib/commercialText";
import SystemPage from "./SystemPage";

// The page copy (title, intro, order-support guidance, SEO) is managed in Admin → Pages ("contact").
// The contact details below come from Store Settings (support email / phone / business address) so they
// are maintained in one place; a detail that is not configured is simply not shown. There is no enquiry
// form because the store has no endpoint to receive one: a form that discards messages would mislead
// customers, so the details above are the only channels until an inbox is configured.
function ContactDetails() {
  const ctx = commercialContext(useSiteSettings());
  const details = [
    ["Email", ctx.supportEmail, ctx.supportEmail ? `mailto:${ctx.supportEmail}` : ""],
    ["Phone", ctx.supportPhone, ctx.supportPhone ? `tel:${String(ctx.supportPhone).replace(/[^+\d]/g, "")}` : ""],
    ["Address", ctx.businessAddress, ""],
  ].filter(([, value]) => Boolean(value));

  if (!details.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2" data-testid="contact-details">
      {details.map(([label, value, href]) => (
        <div key={label} className="rounded-2xl border store-border store-surface p-6">
          <p className="text-xs uppercase tracking-wide store-muted/70">{label}</p>
          <p className="mt-1 break-words text-sm store-muted">
            {href ? <a href={href} className="underline">{value}</a> : value}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function Contact() {
  return (
    <SystemPage slug="contact" eyebrow="Contact" fallbackTitle="Contact Us">
      <ContactDetails />
    </SystemPage>
  );
}
