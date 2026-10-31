const fmtDate = (v, withTime) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", withTime
    ? { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
};
const isHttp = (u) => typeof u === "string" && /^https?:\/\//i.test(u);

// Customer-safe shipment tracking. Renders ONLY the fields of the server's `tracking` object (courier, AWB,
// friendly status, ETA, link, milestone events). Returns nothing when there is no tracking yet.
export default function TrackingBlock({ tracking, className = "" }) {
  if (!tracking) return null;
  const events = [...(tracking.events || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
  return (
    <section aria-label="Shipment tracking" data-testid="tracking-block" className={`min-w-0 ${className}`}>
      <dl className="space-y-3 text-sm">
        {tracking.statusLabel && <div><dt className="text-xs font-semibold uppercase tracking-wider store-muted">Status</dt><dd className="mt-1 font-medium store-text">{tracking.statusLabel}</dd></div>}
        {tracking.courier && <div><dt className="text-xs font-semibold uppercase tracking-wider store-muted">Courier</dt><dd className="mt-1 store-text">{tracking.courier}</dd></div>}
        {tracking.awb && <div><dt className="text-xs font-semibold uppercase tracking-wider store-muted">AWB</dt><dd className="mt-1 break-all store-text">{tracking.awb}</dd></div>}
        {tracking.deliveredAt
          ? <div><dt className="text-xs font-semibold uppercase tracking-wider store-muted">Delivered on</dt><dd className="mt-1 store-text">{fmtDate(tracking.deliveredAt)}</dd></div>
          : tracking.estimatedDelivery && <div><dt className="text-xs font-semibold uppercase tracking-wider store-muted">Estimated delivery</dt><dd className="mt-1 store-text">{fmtDate(tracking.estimatedDelivery)}</dd></div>}
      </dl>
      {isHttp(tracking.trackingUrl) && (
        <a className="mt-4 inline-block rounded-full store-bg-primary px-5 py-2 text-xs font-semibold uppercase tracking-wider text-ivory" href={tracking.trackingUrl} target="_blank" rel="noopener noreferrer">
          Track shipment
        </a>
      )}
      {events.length > 0 && (
        <ol data-testid="tracking-timeline" className="relative mt-5 space-y-4 border-l border-[var(--theme-border)]/15 pl-6">
          {events.map((ev, idx) => (
            <li key={`${ev.status}-${ev.at}-${idx}`} className="relative">
              <span aria-hidden="true" className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-[var(--theme-background)] ${idx === 0 ? "store-bg-primary" : "bg-[var(--theme-border)]/30"}`} />
              <p className="text-sm font-medium store-text">{ev.label}</p>
              <p className="mt-0.5 text-xs store-muted">{fmtDate(ev.at, true)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
