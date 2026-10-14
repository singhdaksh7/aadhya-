import React from "react";

export const fInputCls = "w-full rounded-lg border border-charcoal/20 p-2 text-xs focus:border-charcoal/40 focus:outline-none";
export const fLabelCls = "text-[11px] font-semibold uppercase tracking-wider text-charcoal-soft block mb-1";

export function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function renumber(list) {
  return list.map((item, i) => ({ ...item, sortOrder: i + 1 }));
}

export function moveItem(list, index, dir) {
  const target = index + dir;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function FieldError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-[11px] text-red-600">
      {message}
    </p>
  );
}

/** Up / down / enable / delete controls shared by every repeatable footer list. */
export function RowControls({ index, total, enabled, onMove, onToggle, onDelete, name }) {
  const btn = "rounded border border-charcoal/20 px-2 py-1 text-xs hover:bg-charcoal/5 disabled:opacity-30";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" className={btn} disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move ${name} up`}>
        ↑
      </button>
      <button type="button" className={btn} disabled={index === total - 1} onClick={() => onMove(1)} aria-label={`Move ${name} down`}>
        ↓
      </button>
      {onToggle && (
        <label className="flex items-center gap-1 text-[11px] font-medium text-charcoal cursor-pointer">
          <input type="checkbox" checked={enabled !== false} onChange={(e) => onToggle(e.target.checked)} aria-label={`Enable ${name}`} />
          Enabled
        </label>
      )}
      <button type="button" className={`${btn} text-red-600`} onClick={onDelete} aria-label={`Delete ${name}`}>
        Delete
      </button>
    </div>
  );
}

export function SectionCard({ title, hint, children, action }) {
  return (
    <div className="space-y-3 rounded-xl border border-charcoal/10 bg-charcoal/[0.02] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-charcoal">{title}</h3>
          {hint && <p className="text-[11px] text-charcoal-soft">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function AddButton({ onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-dashed border-charcoal/30 px-3 py-1.5 text-xs font-semibold text-charcoal hover:bg-charcoal/5 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
