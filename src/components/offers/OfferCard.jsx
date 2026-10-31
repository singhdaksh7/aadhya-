import React, { useState } from "react";
import { Button, Modal } from "../ui";

const inr = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function discountHeadline(offer) {
  return offer.discountType === "PERCENTAGE" ? `${offer.value}% OFF` : `${inr(offer.value)} OFF`;
}

export function validityText(offer) {
  if (offer.status === "UPCOMING" && offer.validFrom) return `Starts ${fmtDate(offer.validFrom)}`;
  if (offer.validUntil) return `Valid till ${fmtDate(offer.validUntil)}`;
  return "No expiry";
}

/** Copies text using the Clipboard API, falling back to a hidden textarea + execCommand. */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const okCopy = document.execCommand("copy");
    document.body.removeChild(ta);
    return okCopy;
  } catch {
    return false;
  }
}

function useCopy(code) {
  const [copied, setCopied] = useState(false);
  const copy = async (e) => {
    e?.stopPropagation?.();
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  return [copied, copy];
}

function StatusPill({ status }) {
  if (status === "UPCOMING") return <span className="rounded-full bg-sage-light px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-green">Coming soon</span>;
  if (status === "EXPIRING_SOON") return <span className="rounded-full bg-terracotta/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-terracotta">Ending soon</span>;
  return null;
}

export default function OfferCard({ offer }) {
  const [open, setOpen] = useState(false);
  const [copied, copy] = useCopy(offer.code);
  const conditions = [
    offer.minimumOrderAmount > 0 ? `Min. order ${inr(offer.minimumOrderAmount)}` : "No minimum order",
    offer.maximumDiscountAmount != null && offer.discountType === "PERCENTAGE" ? `Up to ${inr(offer.maximumDiscountAmount)} off` : null,
  ].filter(Boolean);

  return (
    <>
      <article
        data-testid="offer-card"
        className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-terracotta/30 bg-[var(--theme-surface)] shadow-sm transition hover:shadow-md sm:flex-row"
        onClick={() => setOpen(true)}
      >
        {/* Perforation notches */}
        <span aria-hidden="true" className="absolute -left-2.5 top-1/2 hidden h-5 w-5 -translate-y-1/2 rounded-full border border-terracotta/30 bg-white sm:block" />
        <span aria-hidden="true" className="absolute -right-2.5 top-1/2 hidden h-5 w-5 -translate-y-1/2 rounded-full border border-terracotta/30 bg-white sm:block" />

        <div className="flex flex-1 flex-col justify-center gap-1.5 p-5 sm:pl-7">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-charcoal-soft">{offer.title}</p>
            <StatusPill status={offer.status} />
          </div>
          <p className="font-serif-display text-3xl text-terracotta">{discountHeadline(offer)}</p>
          <p className="text-xs text-charcoal-soft">{conditions.join(" · ")}</p>
          <p className="text-xs text-charcoal-soft">{offer.applicability}</p>
          <p className="text-xs font-medium text-charcoal">{validityText(offer)}</p>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 border-t-2 border-dashed border-terracotta/40 p-5 sm:w-56 sm:border-l-2 sm:border-t-0">
          <span className="rounded-lg border border-dashed border-charcoal/30 bg-white px-4 py-2 font-mono text-lg font-bold tracking-widest text-charcoal" data-testid="offer-code">
            {offer.code}
          </span>
          <Button type="button" variant="terracotta" className="w-full !py-2" onClick={copy} aria-label={`Copy code ${offer.code}`}>
            {copied ? "Copied" : "Copy Code"}
          </Button>
        </div>
      </article>

      <OfferDetailsModal offer={offer} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function OfferDetailsModal({ offer, open, onClose }) {
  const [copied, copy] = useCopy(offer.code);
  return (
    <Modal open={open} onClose={onClose} title={offer.title}>
      <div className="space-y-4 text-sm text-charcoal">
        <p className="font-serif-display text-3xl text-terracotta">{discountHeadline(offer)}</p>
        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-dashed border-charcoal/30 bg-white px-4 py-2 font-mono text-lg font-bold tracking-widest">{offer.code}</span>
          <Button type="button" variant="terracotta" className="!py-2" onClick={copy}>{copied ? "Copied" : "Copy Code"}</Button>
        </div>
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2">
          <dt className="text-charcoal-soft">Minimum order</dt>
          <dd>{offer.minimumOrderAmount > 0 ? inr(offer.minimumOrderAmount) : "None"}</dd>
          <dt className="text-charcoal-soft">Maximum discount</dt>
          <dd>{offer.maximumDiscountAmount != null ? inr(offer.maximumDiscountAmount) : "No cap"}</dd>
          <dt className="text-charcoal-soft">Validity</dt>
          <dd>
            {offer.validFrom ? fmtDate(offer.validFrom) : "Now"} – {offer.validUntil ? fmtDate(offer.validUntil) : "No expiry"}
          </dd>
          <dt className="text-charcoal-soft">Applies to</dt>
          <dd>{offer.applicability}</dd>
        </dl>
        {offer.terms && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-charcoal-soft">Terms & conditions</p>
            <p className="whitespace-pre-line text-charcoal-soft">{offer.terms}</p>
          </div>
        )}
        <p className="text-xs text-charcoal-soft">Enter this code at checkout to apply the offer.</p>
      </div>
    </Modal>
  );
}
