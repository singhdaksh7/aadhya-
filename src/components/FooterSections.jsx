import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { resolveMediaUrl } from "../lib/api";
import { isSafeFooterUrl, isExternalUrl, isTelOrMailto, sortByOrder } from "../lib/footerUrls";

const text = (v) => (typeof v === "string" ? v.trim() : "");

/** Link that picks <a target=_blank> for external, <a> for tel/mailto, <Link> for relative. */
export function SafeFooterLink({ url, children, className = "", allowTelMailto = false }) {
  if (!isSafeFooterUrl(url, { allowTelMailto })) return <span className={className}>{children}</span>;
  if (isExternalUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  if (isTelOrMailto(url)) {
    return (
      <a href={url} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={url} className={className}>
      {children}
    </Link>
  );
}

export function CompanyBlock({ block }) {
  if (!block || block.enabled === false) return null;
  const lines = (Array.isArray(block.lines) ? block.lines : []).map(text).filter(Boolean);
  if (!lines.length) return null;
  const heading = text(block.heading);
  return (
    <div data-testid="footer-company-block" className="pt-2 text-xs text-[#FAF6F0]/70 space-y-0.5 break-words">
      {heading && <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest store-accent">{heading}</p>}
      {lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  );
}

export function ContactItems({ items }) {
  const rows = sortByOrder(Array.isArray(items) ? items : []).filter((it) => it && it.enabled !== false && (text(it.value) || text(it.label)));
  if (!rows.length) return null;
  return (
    <div data-testid="footer-contact-items" className="pt-2 text-xs text-[#FAF6F0]/70 break-words">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest store-accent">Contact</p>
      <ul className="space-y-1">
        {rows.map((it, i) => {
          const label = text(it.label);
          const value = text(it.value) || label;
          const url = text(it.url);
          return (
            <li key={it.id || i}>
              {text(it.value) && label && <span className="text-[#FAF6F0]/60">{label}: </span>}
              {url && isSafeFooterUrl(url, { allowTelMailto: true }) ? (
                <SafeFooterLink url={url} allowTelMailto className="font-medium hover:text-white transition underline-offset-2 hover:underline">
                  {value}
                </SafeFooterLink>
              ) : (
                <span className="font-medium">{value}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SeoBand({ sections }) {
  const list = sortByOrder(Array.isArray(sections) ? sections : [])
    .filter((s) => s && s.enabled !== false)
    .map((s) => ({
      ...s,
      heading: text(s.heading),
      text: text(s.text),
      links: (Array.isArray(s.links) ? s.links : []).filter((l) => text(l?.label) && isSafeFooterUrl(l?.url)),
    }))
    .filter((s) => s.heading || s.text || s.links.length);
  if (!list.length) return null;
  return (
    <div data-testid="footer-seo-band" className="mt-12 space-y-6 border-t border-white/10 pt-8">
      {list.map((s, i) => (
        <section key={s.id || i} data-testid="footer-seo-section" className="min-w-0">
          {s.heading && <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-widest store-accent">{s.heading}</h4>}
          {s.text && <p className="mb-2 text-xs leading-relaxed text-[#FAF6F0]/70 break-words whitespace-pre-line">{s.text}</p>}
          {s.links.length > 0 && (
            <p className="text-xs leading-6 text-[#FAF6F0]/70 break-words">
              {s.links.map((l, j) => (
                <React.Fragment key={j}>
                  {j > 0 && (
                    <span aria-hidden="true" className="mx-1.5 text-white/30">
                      |
                    </span>
                  )}
                  <SafeFooterLink url={l.url} className="inline-block max-w-full align-baseline hover:text-white transition">
                    {l.label}
                  </SafeFooterLink>
                </React.Fragment>
              ))}
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

export function PaymentBadges({ badges }) {
  const list = (Array.isArray(badges) ? badges : []).filter((b) => b && text(b.image));
  const [failed, setFailed] = useState({});
  useEffect(() => {
    setFailed({});
  }, [badges]);
  const shown = list.filter((b, i) => !failed[b.id || i]);
  if (!shown.length) return null;
  return (
    <div data-testid="footer-payment-badges" className="flex flex-wrap items-center justify-center gap-2">
      {list.map((b, i) => {
        const key = b.id || i;
        if (failed[key]) return null;
        return (
          <img
            key={key}
            src={resolveMediaUrl(b.image)}
            alt={text(b.label)}
            title={text(b.label) || undefined}
            loading="lazy"
            className="h-6 w-auto max-w-[72px] rounded bg-white/90 object-contain px-1 py-0.5"
            onError={() => setFailed((f) => ({ ...f, [key]: true }))}
          />
        );
      })}
    </div>
  );
}

export function hasPaymentBadgeImages(badges) {
  return (Array.isArray(badges) ? badges : []).some((b) => b && text(b.image));
}

const PLACEMENTS = ["TOP", "BRAND", "BOTTOM"];

/** Admin-uploaded footer image. Renders nothing unless enabled with an image; removed entirely if it fails to load. */
export function FooterImage({ config, placement }) {
  const src = resolveMediaUrl(text(config?.image));
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);
  if (!config || config.enabled !== true || !src || broken) return null;
  const configured = PLACEMENTS.includes(config.placement) ? config.placement : "BRAND";
  if (configured !== placement) return null;
  const maxWidth = Math.min(1200, Math.max(40, Number(config.maxWidth) || 400));
  const link = text(config.linkUrl);
  const img = (
    <img
      src={src}
      alt={text(config.alt)}
      loading="lazy"
      onError={() => setBroken(true)}
      style={{ width: "100%", height: "auto", maxWidth: "100%" }}
      className="block"
    />
  );
  const center = placement !== "BRAND";
  return (
    <div
      data-testid={`footer-image-${placement.toLowerCase()}`}
      className={`${config.showOnMobile === false ? "hidden sm:block" : "block"} w-full ${placement === "BRAND" ? "pt-3" : placement === "TOP" ? "mb-10" : "mt-10"} ${center ? "mx-auto" : ""}`}
      style={{ maxWidth: `${maxWidth}px` }}
    >
      {link && isSafeFooterUrl(link) ? <SafeFooterLink url={link} className="block">{img}</SafeFooterLink> : img}
    </div>
  );
}
