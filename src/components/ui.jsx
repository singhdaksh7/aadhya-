import { Link } from "react-router-dom";
import { IconClose } from "./icons";

export function Button({ as = "button", to, href, variant = "primary", className = "", children, ...rest }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium tracking-wide transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "bg-green text-ivory hover:bg-green-deep",
    secondary: "border border-charcoal/25 text-charcoal hover:border-charcoal hover:bg-charcoal/5",
    terracotta: "bg-terracotta text-ivory hover:brightness-95",
    ghost: "text-charcoal-soft hover:text-charcoal underline underline-offset-4",
    // For use on dark or photographic backgrounds (e.g. the green final-CTA section).
    // Kept as whole, non-overridden variants so utility classes never collide on the
    // same property — mixing a variant's classes with a conflicting className override
    // is what caused the invisible "Book a Consultation" button (ivory text on ivory bg).
    onDark:
      "bg-ivory text-green-deep hover:bg-sage-light active:bg-sage focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ivory focus-visible:ring-offset-2 focus-visible:ring-offset-green-deep",
    onDarkOutline:
      "border border-ivory/70 text-ivory hover:border-ivory hover:bg-ivory/10 active:bg-ivory/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ivory focus-visible:ring-offset-2 focus-visible:ring-offset-green-deep",
  };
  const cls = `${base} ${variants[variant] ?? variants.primary} ${className}`;

  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

export function SectionHeading({ eyebrow, title, description, align = "left", className = "" }) {
  return (
    <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""} ${className}`}>
      {eyebrow && (
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-terracotta">
          {eyebrow}
        </p>
      )}
      <h2 className="font-serif-display text-3xl leading-tight text-charcoal sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-charcoal-soft">{description}</p>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children, maxWidth = "max-w-lg" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative z-10 w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-3xl bg-ivory p-6 shadow-2xl sm:p-8`}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          {title && <h3 className="font-serif-display text-2xl text-charcoal">{title}</h3>}
          <button
            onClick={onClose}
            className="ml-auto rounded-full p-1.5 text-charcoal-soft transition hover:bg-charcoal/5 hover:text-charcoal"
            aria-label="Close"
          >
            <IconClose />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tag({ children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-sage-light px-3 py-1 text-xs font-medium tracking-wide text-green-deep ${className}`}
    >
      {children}
    </span>
  );
}
