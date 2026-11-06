import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImageFallback } from "../CardImage";
import { optimizedUrl } from "../../lib/imageVariants";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const TAP_ZOOM = 2.5;
const SWIPE_PX = 50;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function Arrow({ dir, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous image" : "Next image"}
      className={`absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[var(--theme-primary)] shadow-md transition hover:bg-white ${dir === "prev" ? "left-2 sm:left-4" : "right-2 sm:right-4"}`}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir === "prev" ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"} />
      </svg>
    </button>
  );
}

const ctl = "flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-xl font-semibold text-white transition hover:bg-white/30 disabled:opacity-40";

/**
 * Full-screen viewer over the SAME gallery as the PDP. Controlled: the parent owns `index`.
 * The already-cached PDP-sized image shows instantly; the original (high resolution) file is requested
 * only here, on demand, and swapped in once decoded.
 */
export default function ImageLightbox({ images, index, onIndexChange, onClose, alt = "Product image" }) {
  const count = images.length;
  const multi = count > 1;
  const dialogRef = useRef(null);
  const stageRef = useRef(null);
  const closeRef = useRef(null);
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 });
  const [hiResReady, setHiResReady] = useState({});
  const [failed, setFailed] = useState({});
  const [dragging, setDragging] = useState(false);
  const [, setHiResFailed] = useState({});
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const lastTap = useRef(0);

  const go = useCallback((delta) => { if (count > 1) onIndexChange((index + delta + count) % count); }, [count, index, onIndexChange]);

  // Different image => start un-zoomed.
  useEffect(() => { setZoom({ scale: 1, x: 0, y: 0 }); }, [index]);

  const bound = useCallback((scale, x, y) => {
    const r = stageRef.current?.getBoundingClientRect();
    const mx = r ? (r.width * (scale - 1)) / 2 : 0;
    const my = r ? (r.height * (scale - 1)) / 2 : 0;
    return { scale, x: clamp(x, -mx, mx), y: clamp(y, -my, my) };
  }, []);
  const zoomBy = useCallback((factor) => {
    setZoom((z) => {
      const scale = clamp(+(z.scale * factor).toFixed(3), MIN_SCALE, MAX_SCALE);
      return scale === MIN_SCALE ? { scale, x: 0, y: 0 } : bound(scale, z.x, z.y);
    });
  }, [bound]);
  const toggleZoom = useCallback(() => setZoom((z) => (z.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: TAP_ZOOM, x: 0, y: 0 })), []);

  // Scroll lock, focus management, keyboard.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const opener = document.activeElement;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "+" || e.key === "=") zoomBy(1.4);
      else if (e.key === "-" || e.key === "_") zoomBy(1 / 1.4);
      else if (e.key === "Tab") {
        const f = dialogRef.current?.querySelectorAll("button:not([disabled])");
        if (!f?.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (opener && typeof opener.focus === "function") opener.focus();
    };
  }, [go, zoomBy, onClose]);

  // Pointer gestures: drag-pan when zoomed, pinch, swipe between images when not zoomed, tap/double-tap zoom.
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);
    const pts = [...pointers.current.values()];
    gesture.current = pts.length === 2
      ? { type: "pinch", d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1, s0: zoom.scale, moved: true }
      : { type: "drag", x0: e.clientX, y0: e.clientY, zx: zoom.x, zy: zoom.y, t0: Date.now(), moved: false };
  };
  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.type === "pinch") {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const scale = clamp(g.s0 * (d / g.d0), MIN_SCALE, MAX_SCALE);
      setZoom((z) => (scale === 1 ? { scale, x: 0, y: 0 } : bound(scale, z.x, z.y)));
      return;
    }
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) g.moved = true;
    if (zoom.scale > 1) setZoom(bound(zoom.scale, g.zx + dx, g.zy + dy));
  };
  const onPointerUp = (e) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setDragging(false);
    if (!g) return;
    if (g.type === "pinch") { if (pointers.current.size === 0) gesture.current = null; return; }
    gesture.current = null;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (zoom.scale === 1 && multi && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) { go(dx < 0 ? 1 : -1); return; }
    if (g.moved) return;
    if (e.pointerType === "mouse") { toggleZoom(); return; }
    const now = Date.now();
    if (now - lastTap.current < 320) { lastTap.current = 0; toggleZoom(); } else lastTap.current = now;
  };
  const onPointerCancel = (e) => { pointers.current.delete(e.pointerId); gesture.current = null; setDragging(false); };
  const onWheel = (e) => zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);

  const original = images[index];
  const preview = optimizedUrl(original);
  const isFailed = failed[index] || !original;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Product image viewer"
      data-testid="image-lightbox"
      className="fixed inset-0 z-[100] flex flex-col bg-black/95"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2 text-white">
        <span data-testid="lightbox-counter" className="min-w-[3rem] text-sm tabular-nums opacity-80" aria-live="polite">
          {multi ? `${index + 1} / ${count}` : ""}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" className={ctl} onClick={() => zoomBy(1 / 1.4)} disabled={zoom.scale <= MIN_SCALE} aria-label="Zoom out">−</button>
          <button type="button" className={ctl} onClick={() => zoomBy(1.4)} disabled={zoom.scale >= MAX_SCALE} aria-label="Zoom in">+</button>
          <button ref={closeRef} type="button" className={ctl} onClick={onClose} aria-label="Close image viewer">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
      <div
        ref={stageRef}
        data-testid="lightbox-stage"
        className="absolute inset-0 overflow-hidden"
        style={{ touchAction: "none", cursor: zoom.scale > 1 ? "grab" : "zoom-in" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onWheel={onWheel}
      >
        {isFailed ? (
          <ImageFallback className="!bg-transparent text-white" />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`, transition: dragging ? "none" : "transform 160ms ease-out" }}
          >
            {/* PDP-sized image (already cached) shows immediately; the original loads on top of it. */}
            <img src={preview} alt="" draggable={false} aria-hidden="true" className="absolute max-h-full max-w-full select-none object-contain" onError={() => setFailed((f) => ({ ...f, [index]: true }))} />
            <img
              key={original}
              data-testid="lightbox-image"
              src={original}
              alt={alt}
              draggable={false}
              onLoad={() => setHiResReady((h) => ({ ...h, [index]: true }))}
              onError={() => setHiResFailed((f) => ({ ...f, [index]: true }))}
              className={`relative max-h-full max-w-full select-none object-contain transition-opacity duration-200 ${hiResReady[index] ? "opacity-100" : "opacity-0"}`}
            />
          </div>
        )}
      </div>
      {/* Arrows are siblings of the gesture stage so pointer capture there never swallows their clicks. */}
      {multi && <Arrow dir="prev" onClick={() => go(-1)} />}
      {multi && <Arrow dir="next" onClick={() => go(1)} />}
      </div>
    </div>,
    document.body
  );
}
