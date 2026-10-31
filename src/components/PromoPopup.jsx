import React, { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchPromoPopup, resolveProductImageUrl } from "../lib/api";
import { IconClose } from "./icons";
import { recordPopupSeen, safePopupHref, shouldShowPopup, isBlockedPath } from "../lib/promoPopup";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// One fetch per page load; route changes reuse it.
let popupRequest = null;
export function resetPromoPopupCache() {
  popupRequest = null;
}
function loadPopup() {
  if (!popupRequest) {
    popupRequest = fetchPromoPopup()
      .then((res) => (res && Object.prototype.hasOwnProperty.call(res, "data") ? res.data : res) || null)
      .catch(() => null);
  }
  return popupRequest;
}

/**
 * Admin-managed promotional popup. Renders nothing until the configured delay has elapsed, so it
 * never shifts layout; it is a fixed overlay (a bottom sheet on phones, a centered card on larger screens).
 */
export default function PromoPopup() {
  const { pathname } = useLocation();
  const [popup, setPopup] = useState(null);
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    let active = true;
    if (isBlockedPath(pathname)) return undefined;
    loadPopup().then((data) => {
      if (active) setPopup(data);
    });
    return () => {
      active = false;
    };
  }, [pathname]);

  // Schedule (or cancel) the popup whenever the route or the campaign changes.
  useEffect(() => {
    if (!popup || !shouldShowPopup(popup, pathname)) {
      setOpen(false);
      return undefined;
    }
    const delayMs = Math.max(0, Number(popup.delaySeconds) || 0) * 1000;
    const timer = window.setTimeout(() => {
      // Re-check at fire time: another tab may have shown it meanwhile.
      if (!shouldShowPopup(popup, pathname)) return;
      returnFocusRef.current = document.activeElement;
      recordPopupSeen(popup);
      setOpen(true);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [popup, pathname]);

  const close = React.useCallback(() => {
    if (popup) recordPopupSeen(popup, Date.now(), { dismissed: true });
    setOpen(false);
  }, [popup]);

  // Focus management: move focus in on open, trap Tab, close on ESC, restore focus on close.
  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    const focusables = () => (dialog ? Array.from(dialog.querySelectorAll(FOCUSABLE)) : []);
    (focusables()[0] || dialog)?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) {
        event.preventDefault();
        dialog?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;
      if (event.shiftKey && (activeEl === first || !dialog.contains(activeEl))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeEl === last || !dialog.contains(activeEl))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const previous = returnFocusRef.current;
      if (previous && typeof previous.focus === "function" && document.contains(previous)) previous.focus();
    };
  }, [open, close]);

  if (!open || !popup) return null;

  const desktopImg = resolveProductImageUrl(popup.desktopImage);
  const mobileImg = resolveProductImageUrl(popup.mobileImage) || desktopImg;
  const href = safePopupHref(popup.ctaUrl);
  const external = /^https?:\/\//i.test(href);
  const ctaClass = "inline-flex items-center justify-center rounded-full store-bg-primary px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-white shadow-md transition store-primary-hover";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-charcoal/60 p-4 sm:items-center"
      data-testid="promo-popup-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={popup.description ? descId : undefined}
        tabIndex={-1}
        data-testid="promo-popup"
        className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl outline-none sm:max-w-3xl sm:flex-row"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          data-testid="promo-popup-close"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-charcoal shadow transition hover:bg-white"
        >
          <IconClose className="h-4 w-4" />
        </button>

        {desktopImg && (
          <div className="relative aspect-[16/9] w-full shrink-0 bg-charcoal/5 sm:aspect-auto sm:w-1/2">
            <picture>
              {mobileImg && <source media="(max-width: 639px)" srcSet={mobileImg} />}
              <img src={desktopImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
            </picture>
          </div>
        )}

        <div className="flex flex-1 flex-col justify-center gap-3 overflow-y-auto p-6 sm:p-10">
          <h2 id={titleId} className="font-serif-display text-2xl font-semibold leading-snug store-text sm:text-3xl">
            {popup.title}
          </h2>
          {popup.description && (
            <p id={descId} className="text-sm leading-relaxed store-muted">
              {popup.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {popup.ctaLabel && href && (
              external ? (
                <a href={href} target="_blank" rel="noopener noreferrer" onClick={close} className={ctaClass} data-testid="promo-popup-cta">
                  {popup.ctaLabel}
                </a>
              ) : (
                <Link to={href} onClick={close} className={ctaClass} data-testid="promo-popup-cta">
                  {popup.ctaLabel}
                </Link>
              )
            )}
            <button type="button" onClick={close} className="text-xs font-semibold uppercase tracking-wider store-muted underline-offset-4 hover:underline" data-testid="promo-popup-dismiss">
              {popup.dismissLabel || "Maybe later"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
