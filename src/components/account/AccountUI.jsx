import { Link } from "react-router-dom";

// Shared building blocks for the customer account area, taken from the dashboard's visual language:
// rounded-3xl cards, small uppercase eyebrow + serif heading, soft ivory panels and pill badges.

export const ORDER_STATUS_LABELS = {
  PENDING: "Awaiting payment",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};
const PAYMENT_STATUS_LABELS = {
  PENDING: "Payment pending",
  PAID: "Paid",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
};

const TONES = {
  success: "bg-sage-light text-green-deep",
  info: "store-bg-primary-soft store-primary",
  neutral: "bg-beige store-text",
  danger: "bg-red-50 text-red-700",
};
const ORDER_TONE = { DELIVERED: "success", CONFIRMED: "info", PROCESSING: "info", SHIPPED: "info", OUT_FOR_DELIVERY: "info", PENDING: "neutral", CANCELLED: "danger" };
const PAYMENT_TONE = { PAID: "success", PENDING: "neutral", FAILED: "danger", REFUNDED: "neutral", PARTIALLY_REFUNDED: "neutral" };

export function StatusPill({ kind = "order", value, className = "" }) {
  if (!value) return null;
  const labels = kind === "payment" ? PAYMENT_STATUS_LABELS : ORDER_STATUS_LABELS;
  const tone = (kind === "payment" ? PAYMENT_TONE : ORDER_TONE)[value] || "neutral";
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${TONES[tone]} ${className}`}>{labels[value] || String(value).replace(/_/g, " ").toLowerCase()}</span>;
}

export const formatDate = (value, withTime = false) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) });
};

export function SectionCard({ eyebrow, title, action, children, className = "", id, labelledBy }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`rounded-3xl border border-[var(--theme-border)]/10 store-bg p-6 shadow-sm sm:p-7 ${className}`}>
      {(eyebrow || title || action) && (
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.16em] store-primary">{eyebrow}</p>}
            {title && <h2 id={labelledBy} className="mt-1 font-serif-display text-2xl store-text">{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyPanel({ title, description, actionLabel, to }) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--theme-border)]/20 bg-ivory-dark/30 p-10 text-center sm:p-14">
      <p className="font-serif-display text-xl store-text">{title}</p>
      {description && <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed store-muted">{description}</p>}
      {to && <Link to={to} className="mt-6 inline-block rounded-full store-bg-primary px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-ivory">{actionLabel}</Link>}
    </div>
  );
}

export function SkeletonRows({ rows = 3 }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-ivory-dark/60" />)}
    </div>
  );
}

const STEPS = [
  ["CONFIRMED", "Placed"],
  ["PROCESSING", "Processing"],
  ["SHIPPED", "Shipped"],
  ["OUT_FOR_DELIVERY", "Out for delivery"],
  ["DELIVERED", "Delivered"],
];

// Horizontal progress tracker (vertical on narrow screens is unnecessary: it wraps into a 5-column grid).
export function OrderProgress({ status }) {
  if (status === "CANCELLED") return <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">This order was cancelled.</p>;
  const current = status === "PENDING" ? -1 : Math.max(0, STEPS.findIndex(([key]) => key === status));
  return (
    <>
    <ol className="grid grid-cols-5 gap-1" aria-label="Order progress">
      {STEPS.map(([key, label], i) => {
        const done = i <= current;
        return (
          <li key={key} className="relative flex flex-col items-center text-center">
            {i > 0 && <span aria-hidden="true" className={`absolute right-1/2 top-3 h-0.5 w-full ${i <= current ? "store-bg-primary" : "bg-[var(--theme-border)]/15"}`} />}
            <span aria-hidden="true" className={`relative z-10 grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${done ? "store-bg-primary text-ivory" : "border border-[var(--theme-border)]/25 store-bg store-muted"}`}>{done ? "✓" : i + 1}</span>
            <span className={`mt-2 hidden text-[11px] font-semibold uppercase leading-tight tracking-wide sm:block ${done ? "store-text" : "store-muted"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
    <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wide store-text sm:hidden">{current >= 0 ? STEPS[current][1] : "Awaiting payment"}</p>
    </>
  );
}

const API_ORIGIN = (import.meta.env?.VITE_API_URL || "/api").replace(/\/api\/?$/, "");
const imageUrl = (url) => (!url ? null : /^https?:\/\//.test(url) ? url : `${API_ORIGIN}${url}`);

// Small square product picture with a calm fallback tile when there is no image or it fails to load.
export function ItemThumb({ src, name, size = "h-14 w-14" }) {
  const url = imageUrl(src);
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-ivory-dark/70 ${size}`}>
      <span aria-hidden="true" className="font-serif-display text-lg store-muted">{String(name || "?").trim().charAt(0).toUpperCase()}</span>
      {url && <img src={url} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} className="absolute inset-0 h-full w-full object-cover" />}
    </span>
  );
}
